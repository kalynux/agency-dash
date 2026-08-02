import { formatCurrency, formatDateTime as fmtDateTime } from '@/lib/format';
import { useCallback, useEffect, useState } from 'react';
import { Ban, Banknote, Clock, Loader2, Mail, MapPin, Phone, XCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShipmentStatusBadge } from '@/components/shipments/ShipmentStatusBadge';
import { AssignmentPanel } from '@/components/shipments/AssignmentPanel';
import { RejectShipmentDialog } from '@/components/shipments/RejectShipmentDialog';
import { getNextActions, canRejectStatus, isTerminalStatus } from '@/components/shipments/shipment-actions';
import { shipmentsService } from '@/services/shipments.service';
import { useShipmentActions } from '@/hooks/useShipmentActions';
import { useAgentsRoster } from '@/store/agents.store';
import { useIsMobile } from '@/hooks/use-mobile';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { describeAddress } from '@/types/shipment.types';
import type { ShipmentActionableStatus, ShipmentDetail } from '@/types/shipment.types';

function formatDateTime(iso: string): string {
  return fmtDateTime(iso);
}

export interface ShipmentDetailSheetProps {
  shipmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after any successful mutation so the parent can refresh its list + nav badge. */
  onChanged?: () => void;
}

/**
 * Full shipment detail. Renders as a centered modal dialog on desktop and as a
 * bottom sheet on mobile — same body, different container.
 */
export function ShipmentDetailSheet({ shipmentId, open, onOpenChange, onChanged }: ShipmentDetailSheetProps) {
  const isMobile = useIsMobile();
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const { agents } = useAgentsRoster();
  const actions = useShipmentActions();

  const load = useCallback(async (id: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await shipmentsService.getById(id);
      setDetail(data);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    onChanged?.();
    if (shipmentId) load(shipmentId);
  }, [onChanged, shipmentId, load]);

  useEffect(() => {
    if (open && shipmentId) load(shipmentId);
    if (!open) {
      setDetail(null);
      setLoadError(null);
    }
  }, [open, shipmentId, load]);

  const isCod = detail?.paymentMethod === 'cash_on_delivery';
  // COD shipments skip "agent_delivered → delivered" (delivery is confirmed via the agent's code
  // submission), but agent_delivered → failed is still allowed.
  const nextActions = detail ? getNextActions(detail.status) : [];
  const canReject = detail ? canRejectStatus(detail.status) : false;
  const isTerminal = detail ? isTerminalStatus(detail.status) : false;
  // Under the acceptance workflow, ANY shipment needs an accepted agent before pickup.
  const pickupBlocked = detail?.status === 'assigned' && !detail.agentId;

  const runStatus = async (status: ShipmentActionableStatus, label: string) => {
    const result = await actions.updateStatus(detail!.id, status, `Shipment marked “${label}”.`);
    if (result) refresh();
  };
  const TitleComp = isMobile ? SheetTitle : DialogTitle;

  const body = isLoading ? (
    <>
      <TitleComp className="sr-only">Shipment details</TitleComp>
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-16">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading shipment…
      </div>
    </>
  ) : loadError ? (
    <>
      <TitleComp className="sr-only">Shipment details</TitleComp>
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
        <Button variant="outline" onClick={() => shipmentId && load(shipmentId)}>
          Retry
        </Button>
      </div>
    </>
  ) : detail ? (
    <>
      <div className="px-5 pt-2 pb-2 pr-12 flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <TitleComp className="text-base leading-tight">{detail.orderNumber}</TitleComp>
            <p className="text-xs text-muted-foreground mt-0.5">
              {detail.items.length} item{detail.items.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <ShipmentStatusBadge status={detail.status} />
            {isCod && (
              <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600 bg-amber-50">
                <Banknote className="w-3 h-3" /> Cash on Delivery
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Separator className="flex-shrink-0" />

      <div className="flex-1 min-h-0 overflow-y-auto">
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
                    {/* The picture is what lets someone identify a parcel by
                        sight instead of reading labels. `images[0]` is the same
                        thumbnail the list row shows for this item. */}
                    {item.images.length > 0 && (
                      <img
                        src={item.images[0].url}
                        alt=""
                        crossOrigin="use-credentials"
                        className="w-12 h-12 rounded-md object-cover border flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
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
                  {/* `mode` says only who holds the parcel — the address reads
                      the same either way, so there is nothing to branch on but
                      the wording. */}
                  {item.pickupLocation && describeAddress(item.pickupLocation.address) && (
                    <div className="mt-2 pt-2 border-t flex items-start gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>
                        {item.pickupLocation.alreadyInYourStorage ? 'In your storage — ' : 'Pick up from '}
                        {item.pickupLocation.address.label
                          ? `${item.pickupLocation.address.label}, ${describeAddress(item.pickupLocation.address)}`
                          : describeAddress(item.pickupLocation.address)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* COD collection */}
          {detail.cod && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Cash Collection
              </h3>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-amber-900">
                    {formatCurrency(detail.cod.expectedAmount, detail.cod.currency)}
                  </p>
                  <p className="text-xs text-amber-700 capitalize">
                    {detail.cod.status}
                    {detail.cod.collectedAt && ` · ${formatDateTime(detail.cod.collectedAt)}`}
                  </p>
                </div>
                <Banknote className="w-5 h-5 text-amber-600 flex-shrink-0" />
              </div>
            </section>
          )}

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
                  {/* Snapshotted at checkout, so this is where they actually
                      ordered to — it no longer drifts with their saved default. */}
                  <span>
                    {detail.customer.deliveryAddress.formattedAddress ??
                      describeAddress(detail.customer.deliveryAddress) ??
                      '—'}
                  </span>
                </p>
              </div>
            </div>
          </section>

          {/* Agent assignment (offer / acceptance workflow) */}
          {!isTerminal && <AssignmentPanel detail={detail} agents={agents} onChanged={refresh} />}

          {/* Tracking number — generated at creation, read-only everywhere. The
              agency acronym prefix is snapshotted then, so renaming your magazin
              only changes future shipments. */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Tracking Number
            </h3>
            <p className="font-mono text-sm">{detail.trackingNumber ?? '—'}</p>
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
              <p className="text-xs text-destructive mt-2 flex items-start gap-1">
                <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  Rejected: {detail.rejection.reason.replace(/_/g, ' ')}
                  {detail.rejection.note && ` — ${detail.rejection.note}`}
                </span>
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Sticky footer — status actions */}
      {(nextActions.length > 0 || canReject) && (
        <div className="px-5 py-4 border-t flex-shrink-0 flex flex-wrap items-center gap-2">
          {nextActions.map((next) => (
            <Button
              key={next.status}
              size="sm"
              variant={next.variant === 'destructive' ? 'destructive' : 'default'}
              disabled={
                actions.pendingKey === `status:${detail.id}` ||
                (pickupBlocked && next.status === 'picked_up')
              }
              title={pickupBlocked && next.status === 'picked_up' ? 'An agent must accept the offer first' : undefined}
              onClick={() => runStatus(next.status, next.label)}
            >
              {actions.pendingKey === `status:${detail.id}` ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                next.label
              )}
            </Button>
          ))}
          {canReject && (
            <Button
              size="sm"
              variant="outline"
              className={cn(
                'gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive',
                nextActions.length > 0 && 'ml-auto',
              )}
              onClick={() => setRejectOpen(true)}
            >
              <Ban className="w-3.5 h-3.5" /> Reject
            </Button>
          )}
        </div>
      )}
    </>
  ) : null;

  const detailUi = isMobile ? (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Definite height + overflow-hidden so the header/footer pin and only the
          body scrolls — a bottom sheet with `h-auto` won't give the flex body a
          bounded height to scroll within. */}
      <SheetContent side="bottom" className="h-[90vh] flex flex-col rounded-t-2xl px-0 pb-0 gap-0 overflow-hidden">
        <div className="mx-auto w-10 h-1 bg-muted rounded-full mt-2 mb-1 flex-shrink-0" />
        {body}
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="p-0 gap-0 max-w-2xl sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {body}
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {detailUi}
      <RejectShipmentDialog
        shipmentId={detail?.id ?? shipmentId}
        orderNumber={detail?.orderNumber}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onRejected={refresh}
      />
    </>
  );
}
