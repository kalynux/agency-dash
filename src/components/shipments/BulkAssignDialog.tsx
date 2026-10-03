import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Loader2, UserCheck, X, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useShipmentActions } from '@/hooks/useShipmentActions';
import { useAgencyCountry } from '@/hooks/useAgencyCountry';
import { getApiErrorMessage } from '@/lib/errors';
import { regionLabel } from '@/components/agents/contractTerms';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { AgentWorkload } from '@/components/agents/AgentWorkload';
import { OfferOverrideBadges } from '@/components/shipments/OfferOverrideBadges';
import { coverageRefusal } from '@/components/shipments/forceAssign';
import {
  bulkItemError,
  isForceableRefusal,
  type AtCapacityRefusal,
} from '@/components/shipments/bulkAssign';
import type { AgentSummary } from '@/types/agent.types';
import type { BulkAssignItem, ShipmentListItem } from '@/types/shipment.types';

export interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The selected shipments, in the order they were picked — the order sent and shown back. */
  shipments: ShipmentListItem[];
  agents: AgentSummary[];
  onRemove: (id: string) => void;
  /** Trim the selection to its first `count` rows (the `AGENT_AT_CAPACITY` cure). */
  onKeepFirst: (count: number) => void;
  /** Something was offered: reload the list. */
  onChanged: () => void;
  /** The user closed the results: clear the selection. */
  onDone: () => void;
}

interface Results {
  agentId: string;
  /** One per shipment sent, in the order sent; force resends replace their rows in place. */
  items: BulkAssignItem[];
  /** Order numbers of the shipments sent, kept so the rows read the same after the list reloads. */
  labels: Record<string, string>;
}

/**
 * Offer one agent up to ten shipments in one call
 * (`POST /api/agency/shipments/assign-agent`).
 *
 * The call answers `200` even when rows fail, so the outcome is shown per row,
 * in the order sent, with each failure worded by its `error.code` exactly as
 * the single assign words it. Rows refused only for the region or the COD cash
 * limit can be resent — those rows alone — with `force: true`. A whole-call
 * `AGENT_AT_CAPACITY` offers nothing; the user trims the selection and sends
 * again. See api-doc/agency/assignment.md → bulk offer.
 */
export function BulkAssignDialog({
  open,
  onOpenChange,
  shipments,
  agents,
  onRemove,
  onKeepFirst,
  onChanged,
  onDone,
}: BulkAssignDialogProps) {
  const { t } = useTranslation(['shipments', 'common']);
  const country = useAgencyCountry();
  const { assignAgentBulk, pendingKey } = useShipmentActions();
  const [agentId, setAgentId] = useState('');
  const [capacity, setCapacity] = useState<AtCapacityRefusal | null>(null);
  const [results, setResults] = useState<Results | null>(null);

  const pending = pendingKey === 'assign-bulk';
  const activeAgents = agents.filter((a) => a.membershipStatus === 'active');
  const nameFor = (id: string) => agents.find((a) => a.id === id)?.name ?? t('assignment.unnamedAgent');

  const reset = () => {
    setAgentId('');
    setCapacity(null);
    setResults(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    if (!next) {
      if (results) onDone();
      reset();
    }
    onOpenChange(next);
  };

  const chooseAgent = (id: string) => {
    setAgentId(id);
    setCapacity(null);
  };

  const submit = async () => {
    if (!agentId || shipments.length === 0) return;
    setCapacity(null);
    const sent = shipments;
    const result = await assignAgentBulk(
      { agentId, shipmentIds: sent.map((s) => s.id) },
      { onAtCapacity: setCapacity },
    );
    if (!result) return;
    setResults({
      agentId,
      items: result.items,
      labels: Object.fromEntries(sent.map((s) => [s.id, s.orderNumber])),
    });
    if (result.offered > 0) onChanged();
  };

  const forceableIds = results
    ? results.items
        .filter((i) => !i.ok && isForceableRefusal(bulkItemError(i.error)))
        .map((i) => i.shipmentId)
    : [];

  /** Resend only the rows `force` can carry, never one that was already offered. */
  const sendForced = async () => {
    if (!results || forceableIds.length === 0) return;
    setCapacity(null);
    const result = await assignAgentBulk(
      { agentId: results.agentId, shipmentIds: forceableIds, force: true },
      { onAtCapacity: setCapacity },
    );
    if (!result) return;
    const replaced = new Map(result.items.map((i) => [i.shipmentId, i]));
    setResults({
      ...results,
      items: results.items.map((i) => replaced.get(i.shipmentId) ?? i),
    });
    if (result.offered > 0) onChanged();
  };

  const capacityBanner = capacity && (
    <div
      role="alert"
      className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <p className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        {capacity.freeSlots === 0
          ? t('bulkAssign.atCapacityNone', { name: nameFor(results?.agentId ?? agentId) })
          : t('bulkAssign.atCapacity', {
              name: nameFor(results?.agentId ?? agentId),
              free: capacity.freeSlots,
              requested: capacity.requested ?? shipments.length,
              excess: Math.max(1, (capacity.requested ?? shipments.length) - capacity.freeSlots),
            })}
      </p>
      {!results && capacity.freeSlots > 0 && shipments.length > capacity.freeSlots && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onKeepFirst(capacity.freeSlots);
              setCapacity(null);
            }}
          >
            {t('bulkAssign.keepFirst', { count: capacity.freeSlots })}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('bulkAssign.title')}</DialogTitle>
          <DialogDescription>{t('bulkAssign.description')}</DialogDescription>
        </DialogHeader>

        {results ? (
          <ResultsView
            results={results}
            agentName={nameFor(results.agentId)}
            country={country}
            forceableCount={forceableIds.length}
            pending={pending}
            onSendForced={() => void sendForced()}
            capacityBanner={capacityBanner}
          />
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('bulkAssign.agentLabel')}</Label>
              <Select value={agentId} onValueChange={chooseAgent}>
                <SelectTrigger>
                  <SelectValue placeholder={t('assignment.choosePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {activeAgents.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {t('assignment.noActiveAgents')}
                    </div>
                  ) : (
                    activeAgents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="flex items-center gap-1">
                          {a.name}
                          <VerifiedBadge verified={a.verified} />
                          <AgentWorkload
                            active={a.activeShipmentCount}
                            forYou={a.activeShipmentsForYou}
                            className="ms-1 text-xs text-muted-foreground"
                          />
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t('bulkAssign.shipmentsLabel')}</Label>
              <ul className="divide-y rounded-lg border">
                {shipments.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{s.orderNumber}</span>
                      <span className="text-muted-foreground"> · {s.customer.name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      disabled={pending}
                      onClick={() => onRemove(s.id)}
                      aria-label={t('bulkAssign.remove', { order: s.orderNumber })}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            {capacityBanner}
          </div>
        )}

        <DialogFooter>
          {results ? (
            <Button onClick={() => handleOpenChange(false)} disabled={pending}>
              {t('bulkAssign.done')}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
                {t('common:actions.cancel')}
              </Button>
              <Button onClick={() => void submit()} disabled={!agentId || shipments.length === 0 || pending}>
                {pending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t('bulkAssign.submit', { count: shipments.length })
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ResultsViewProps {
  results: Results;
  agentName: string;
  country: string;
  forceableCount: number;
  pending: boolean;
  onSendForced: () => void;
  capacityBanner: ReactNode;
}

function ResultsView({
  results,
  agentName,
  country,
  forceableCount,
  pending,
  onSendForced,
  capacityBanner,
}: ResultsViewProps) {
  const { t } = useTranslation('shipments');
  // Counted from the rows rather than the response, so a force resend that
  // replaced some rows is reflected too.
  const offered = results.items.filter((i) => i.ok).length;
  const autoAccepted = results.items.filter((i) => i.ok && i.autoAccepted).length;
  const failed = results.items.length - offered;

  return (
    <div className="space-y-4">
      <div className="text-sm">
        <p className="font-medium">
          {t('bulkAssign.summary', { offered, requested: results.items.length, failed })}
        </p>
        {autoAccepted > 0 && (
          <p className="text-muted-foreground">{t('bulkAssign.summaryAutoAccepted', { count: autoAccepted })}</p>
        )}
      </div>

      <ul className="divide-y rounded-lg border">
        {results.items.map((item) => {
          const order = results.labels[item.shipmentId] ?? item.shipmentId.slice(-6);
          if (item.ok) {
            return (
              <li key={item.shipmentId} className="space-y-1.5 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{order}</span>
                  {item.autoAccepted ? (
                    <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200">
                      <UserCheck className="w-3 h-3" /> {t('bulkAssign.rowAutoAccepted')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {t('bulkAssign.rowOffered')}
                    </Badge>
                  )}
                </div>
                <OfferOverrideBadges offer={item.offer} />
              </li>
            );
          }
          const err = bulkItemError(item.error);
          const coverage = coverageRefusal(err);
          return (
            <li key={item.shipmentId} className="space-y-1 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{order}</span>
                <Badge variant="outline" className="gap-1 text-destructive border-destructive/30">
                  <XCircle className="w-3 h-3" /> {t('bulkAssign.rowFailed')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{getApiErrorMessage(err)}</p>
              {coverage && (
                <p className="text-xs text-muted-foreground">
                  {t('coverageForce.deliveryRegion')}:{' '}
                  {coverage.deliveryRegion
                    ? regionLabel(coverage.deliveryRegion, country)
                    : t('coverageForce.unknownRegion')}
                  {' · '}
                  {t('coverageForce.coveredRegions')}:{' '}
                  {coverage.coveredRegions.length > 0
                    ? coverage.coveredRegions.map((r) => regionLabel(r, country)).join(', ')
                    : t('coverageForce.unknownRegion')}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {forceableCount > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <p className="flex items-start gap-2 text-sm font-medium">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {t('bulkAssign.forceTitle', { count: forceableCount, name: agentName })}
          </p>
          <p className="text-xs">{t('bulkAssign.forceExplainer')}</p>
          <div className="flex justify-end pt-1">
            <Button type="button" size="sm" onClick={onSendForced} disabled={pending}>
              {pending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                t('bulkAssign.forceConfirm', { count: forceableCount })
              )}
            </Button>
          </div>
        </div>
      )}

      {capacityBanner}
    </div>
  );
}
