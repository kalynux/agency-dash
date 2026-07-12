import { useCallback, useEffect, useState } from 'react';
import { Clock, Loader2, Mail, MapPin, Phone, XCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShipmentStatusBadge } from '@/components/shipments/ShipmentStatusBadge';
import { shipmentsService } from '@/services/shipments.service';
import { useShipmentActions } from '@/hooks/useShipmentActions';
import { useAgentStore } from '@/store';
import { ApiError } from '@/types/api';
import { cn } from '@/lib/utils';
import type {
  ShipmentActionableStatus,
  ShipmentDetail,
  ShipmentMutationResult,
  ShipmentRejectionReason,
  ShipmentStatus,
} from '@/types/shipment.types';

const REJECTION_REASONS: { value: ShipmentRejectionReason; label: string }[] = [
  { value: 'out_of_coverage_area', label: 'Out of coverage area' },
  { value: 'capacity_exceeded', label: 'Capacity exceeded' },
  { value: 'invalid_address', label: 'Invalid address' },
  { value: 'vendor_item_not_ready', label: 'Vendor item not ready' },
  { value: 'other', label: 'Other' },
];

const NEXT_ACTIONS: Partial<
  Record<ShipmentStatus, { status: ShipmentActionableStatus; label: string; variant?: 'default' | 'destructive' }[]>
> = {
  assigned: [{ status: 'picked_up', label: 'Mark Picked Up' }],
  picked_up: [{ status: 'in_transit', label: 'Mark In Transit' }],
  in_transit: [
    { status: 'agent_delivered', label: 'Mark Delivered' },
    { status: 'failed', label: 'Mark Failed', variant: 'destructive' },
  ],
  failed: [
    { status: 'in_transit', label: 'Retry Delivery' },
    { status: 'returned', label: 'Mark Returned', variant: 'destructive' },
  ],
};

const TERMINAL_STATUSES: ShipmentStatus[] = ['delivered', 'returned', 'rejected'];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export interface ShipmentDetailSheetProps {
  shipmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after any successful mutation so the parent can patch its list row + refresh the nav badge. */
  onChanged?: (result: ShipmentMutationResult) => void;
}

export function ShipmentDetailSheet({ shipmentId, open, onOpenChange, onChanged }: ShipmentDetailSheetProps) {
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [trackingDraft, setTrackingDraft] = useState('');
  const [agentDraft, setAgentDraft] = useState('');
  const [rejectReason, setRejectReason] = useState<ShipmentRejectionReason | ''>('');
  const { agents } = useAgentStore();

  const load = useCallback(async (id: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await shipmentsService.getById(id);
      setDetail(data);
      setTrackingDraft(data.trackingNumber ?? '');
      setAgentDraft(data.agentId ?? '');
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load this shipment.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const actions = useShipmentActions({
    onChanged: (result) => {
      onChanged?.(result);
      if (shipmentId) load(shipmentId);
    },
  });

  useEffect(() => {
    if (open && shipmentId) load(shipmentId);
    if (!open) {
      setDetail(null);
      setLoadError(null);
      setRejectReason('');
    }
  }, [open, shipmentId, load]);

  const activeAgents = agents.filter((a) => a.status === 'active');
  const nextActions = detail ? NEXT_ACTIONS[detail.status] ?? [] : [];
  const canReject = detail?.status === 'assigned';
  const isTerminal = detail ? TERMINAL_STATUSES.includes(detail.status) : false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] flex flex-col rounded-t-2xl px-0 pb-0">
        <div className="mx-auto w-10 h-1 bg-muted rounded-full mt-2 mb-1 flex-shrink-0" />

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-16">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading shipment…
          </div>
        ) : loadError ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
            <Button variant="outline" onClick={() => shipmentId && load(shipmentId)}>
              Retry
            </Button>
          </div>
        ) : detail ? (
          <>
            <SheetHeader className="px-5 pb-2 flex-shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle className="text-base leading-tight">{detail.orderNumber}</SheetTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {detail.items.length} item{detail.items.length === 1 ? '' : 's'}
                  </p>
                </div>
                <ShipmentStatusBadge status={detail.status} />
              </div>
            </SheetHeader>

            <Separator className="flex-shrink-0" />

            <ScrollArea className="flex-1 overflow-hidden">
              <div className="px-5 py-4 space-y-5">
                {/* Items */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Items
                  </h3>
                  <div className="space-y-2">
                    {detail.items.map((item) => (
                      <div key={item.orderItemId} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            {item.variantTitle && (
                              <p className="text-xs text-muted-foreground">{item.variantTitle}</p>
                            )}
                            <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                          </div>
                          <Badge variant="secondary" className="flex-shrink-0">
                            ×{item.quantity}
                          </Badge>
                        </div>
                        {item.pickupLocation && (
                          <div className="mt-2 pt-2 border-t flex items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>
                              {item.pickupLocation.alreadyInYourStorage
                                ? `In your storage — ${item.pickupLocation.address.label}, ${item.pickupLocation.address.city}`
                                : `Pick up from ${item.pickupLocation.address.label}, ${item.pickupLocation.address.city}`}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* Vendor & Customer */}
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Vendor
                    </h3>
                    <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                      <p className="text-sm font-medium">{detail.vendor.businessName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {detail.vendor.phone}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {detail.vendor.email}
                      </p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Customer
                    </h3>
                    <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                      <p className="text-sm font-medium">{detail.customer.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {detail.customer.phone}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-start gap-1">
                        <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>
                          {detail.customer.deliveryAddress.addressLine1}, {detail.customer.deliveryAddress.city},{' '}
                          {detail.customer.deliveryAddress.state}
                        </span>
                      </p>
                    </div>
                  </div>
                </section>

                {/* Agent assignment */}
                {!isTerminal && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Assigned Agent
                    </h3>
                    <div className="flex items-center gap-2">
                      <Select value={agentDraft} onValueChange={setAgentDraft}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeAgents.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        disabled={
                          !agentDraft || agentDraft === detail.agentId || actions.pendingKey === `assign:${detail.id}`
                        }
                        onClick={() => actions.assignAgent(detail.id, agentDraft)}
                      >
                        {actions.pendingKey === `assign:${detail.id}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          'Assign'
                        )}
                      </Button>
                    </div>
                    {detail.agent && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary flex-shrink-0 overflow-hidden">
                          {detail.agent.avatarUrl ? (
                            <img
                              src={detail.agent.avatarUrl}
                              alt={detail.agent.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            initials(detail.agent.name)
                          )}
                        </div>
                        <span>
                          {detail.agent.name} · {detail.agent.phone}
                        </span>
                      </div>
                    )}
                  </section>
                )}

                {/* Tracking number */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Tracking Number
                  </h3>
                  <div className="flex items-center gap-2">
                    <Input
                      value={trackingDraft}
                      onChange={(e) => setTrackingDraft(e.target.value)}
                      placeholder="e.g. FS-1234567890"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        !trackingDraft.trim() ||
                        trackingDraft.trim() === detail.trackingNumber ||
                        actions.pendingKey === `tracking:${detail.id}`
                      }
                      onClick={() => actions.updateTrackingNumber(detail.id, trackingDraft.trim())}
                    >
                      {actions.pendingKey === `tracking:${detail.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Save'
                      )}
                    </Button>
                  </div>
                </section>

                {/* Status history */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    History
                  </h3>
                  <div className="space-y-3">
                    {detail.statusHistory.map((entry, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                          <ShipmentStatusBadge status={entry.status} className="text-[10px]" />
                          <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(entry.changedAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {detail.rejection && (
                    <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Rejected: {detail.rejection.reason.replace(/_/g, ' ')}
                    </p>
                  )}
                </section>
              </div>
            </ScrollArea>

            {/* Sticky footer — status actions */}
            {(nextActions.length > 0 || canReject) && (
              <div className="px-5 py-4 border-t flex-shrink-0 flex flex-wrap items-center gap-2">
                {nextActions.map((next) => (
                  <Button
                    key={next.status}
                    size="sm"
                    variant={next.variant === 'destructive' ? 'destructive' : 'default'}
                    disabled={actions.pendingKey === `status:${detail.id}`}
                    onClick={() =>
                      actions.updateStatus(detail.id, next.status, `Shipment marked "${next.label}".`)
                    }
                  >
                    {actions.pendingKey === `status:${detail.id}` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      next.label
                    )}
                  </Button>
                ))}
                {canReject && (
                  <div className={cn('flex items-center gap-2', nextActions.length > 0 && 'ml-auto')}>
                    <Select value={rejectReason} onValueChange={(v) => setRejectReason(v as ShipmentRejectionReason)}>
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder="Reject reason…" />
                      </SelectTrigger>
                      <SelectContent>
                        {REJECTION_REASONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!rejectReason || actions.pendingKey === `reject:${detail.id}`}
                      onClick={() => rejectReason && actions.reject(detail.id, rejectReason)}
                    >
                      {actions.pendingKey === `reject:${detail.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Reject'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
