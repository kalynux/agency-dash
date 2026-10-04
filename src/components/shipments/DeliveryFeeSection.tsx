import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Ban, Loader2, Pencil, Receipt, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeliveryFeeProposalDialog } from '@/components/shipments/DeliveryFeeProposalDialog';
import { canRejectStatus } from '@/components/shipments/shipment-actions';
import { useShipmentActions } from '@/hooks/useShipmentActions';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AgentSummary } from '@/types/agent.types';
import type { ShipmentDetail, ShipmentFeeComponents } from '@/types/shipment.types';
import {
  DELIVERY_FEE_PROPOSAL_WINDOW,
  MAX_DELIVERY_FEE_PROPOSALS,
  type DeliveryFeeProposal,
  type DeliveryFeeProposalActor,
  type DeliveryFeeProposalStatus,
} from '@/types/delivery-fee-proposal.types';

const KNOWN_STATUSES: readonly DeliveryFeeProposalStatus[] = ['pending', 'approved', 'rejected', 'withdrawn'];

const STATUS_CLASS: Record<DeliveryFeeProposalStatus, string> = {
  pending: 'text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-800',
  approved: 'text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-800',
  rejected: 'text-destructive border-destructive/40',
  withdrawn: 'text-muted-foreground',
};

function isKnownStatus(status: string): status is DeliveryFeeProposalStatus {
  return (KNOWN_STATUSES as readonly string[]).includes(status);
}

/** Who answers it. A proposal from an older server carries no `approver` — it was the vendor. */
function approverOf(p: DeliveryFeeProposal): string {
  return p.approver ?? 'vendor';
}

/** The customer accepted an increase on an online order and the top-up is still unpaid. */
function awaitingTopup(p: DeliveryFeeProposal): boolean {
  return p.status === 'pending' && !!p.customerApproval && p.topup?.status === 'awaiting_payment';
}

/** The customer, not the vendor, turned it down. */
function rejectedByCustomer(p: DeliveryFeeProposal): boolean {
  return p.status === 'rejected' && (p.respondedBy?.role === 'customer' || approverOf(p) === 'customer');
}

/**
 * The badge for a proposal. The four statuses are the API's; on a customer-paid
 * parcel they read differently, so they're refined from `approver`,
 * `customerApproval` and `topup` — each of which the server sets.
 */
type BadgeKey =
  | 'pending'
  | 'pendingCustomer'
  | 'awaitingPayment'
  | 'approved'
  | 'applied'
  | 'rejected'
  | 'rejectedByCustomer'
  | 'withdrawn';

function badgeKey(p: DeliveryFeeProposal & { status: DeliveryFeeProposalStatus }): BadgeKey {
  switch (p.status) {
    case 'pending':
      if (awaitingTopup(p)) return 'awaitingPayment';
      return approverOf(p) === 'customer' ? 'pendingCustomer' : 'pending';
    case 'approved':
      return approverOf(p) === 'none' ? 'applied' : 'approved';
    case 'rejected':
      return rejectedByCustomer(p) ? 'rejectedByCustomer' : 'rejected';
    default:
      return 'withdrawn';
  }
}

/**
 * The fee the shipment carries now: the approved one if a change went through,
 * else the gross fee from the earnings quote, else what the newest proposal saw
 * as "before". `null` when nothing says.
 */
function currentDeliveryFee(detail: ShipmentDetail): number | null {
  if (detail.deliveryFeeOverride) return detail.deliveryFeeOverride.amount;
  if (detail.agencyEarning) return detail.agencyEarning.deliveryFee;
  return detail.deliveryFeeProposals?.[0]?.feeBefore ?? null;
}

/**
 * How the posted fee was built at checkout, line by line. Every figure is the
 * server's: no total is computed here, because the ceiling (`capApplied`) means
 * the parts can add up to more than was charged.
 */
function FeeBreakdown({
  components,
  currency,
  overridden,
}: {
  components: ShipmentFeeComponents;
  currency: string;
  overridden: boolean;
}) {
  const { t } = useTranslation('shipments');
  const money = (value: number) => formatCurrency(value, currency);

  if (components.flatFallback) {
    return <p className="text-xs text-muted-foreground">{t('deliveryFee.breakdown.flatFallback')}</p>;
  }

  const lines: Array<{ label: string; amount: string }> = [];
  if (components.pickupBase > 0) lines.push({ label: t('deliveryFee.breakdown.base'), amount: money(components.pickupBase) });
  if (components.weightExtra > 0) lines.push({ label: t('deliveryFee.breakdown.weight'), amount: `+${money(components.weightExtra)}` });
  if (components.regionSurcharge > 0) {
    lines.push({ label: t('deliveryFee.breakdown.region'), amount: `+${money(components.regionSurcharge)}` });
  }
  if (components.storage > 0) {
    lines.push({
      label: t('deliveryFee.breakdown.storage'),
      amount: components.pickupBase > 0 ? `+${money(components.storage)}` : money(components.storage),
    });
  }

  const weight =
    components.weightGrams > 0
      ? t('deliveryFee.breakdown.weightLine', { kg: formatNumber(components.kg), grams: formatNumber(components.weightGrams) })
      : t('deliveryFee.breakdown.weightLineNoGrams', { kg: formatNumber(components.kg) });
  const region = components.outOfRegion ? t('deliveryFee.breakdown.outOfRegion') : t('deliveryFee.breakdown.inRegion');

  return (
    <div className="space-y-1.5 rounded-md bg-muted/50 p-2.5 text-xs">
      <p className="font-medium text-muted-foreground">{t('deliveryFee.breakdown.title')}</p>
      {lines.length > 0 && (
        <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
          {lines.map((line) => (
            <div key={line.label} className="contents">
              <span>{line.label}</span>
              <span className="text-end font-numeric">{line.amount}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-muted-foreground">
        {weight} · {region}
      </p>
      {components.capApplied && (
        <p className="font-medium text-amber-700 dark:text-amber-300">{t('deliveryFee.breakdown.capApplied')}</p>
      )}
      {overridden && <p className="text-muted-foreground">{t('deliveryFee.breakdown.overridden')}</p>}
    </div>
  );
}

export interface DeliveryFeeSectionProps {
  detail: ShipmentDetail;
  agents: AgentSummary[];
  onChanged: () => void;
  /** Open the existing decline dialog. */
  onDecline: () => void;
}

/**
 * One shipment's delivery fee: how it was built, who pays it, and renegotiating
 * it. The rules are the server's (api-doc/agency/shipments.md § Delivery-fee
 * proposals) and are mirrored here only to hide buttons that would be refused:
 * - only while `assigned` / `handing_over`;
 * - one pending at a time, at most two that aren't withdrawn (a change-of-agency
 *   difference raised by the platform doesn't count);
 * - Edit / Withdraw come from `availableActions`, never from our own guess.
 *
 * Who answers is the payer: the vendor on a shop-paid parcel; on a customer-paid
 * one a decrease applies at once and an increase waits for the customer (and,
 * online, for their top-up payment).
 */
export function DeliveryFeeSection({ detail, agents, onChanged, onDecline }: DeliveryFeeSectionProps) {
  const { t } = useTranslation(['shipments', 'common']);
  const { withdrawDeliveryFee, pendingKey } = useShipmentActions();
  const [dialog, setDialog] = useState<{ proposal: DeliveryFeeProposal | null } | null>(null);

  const proposals = detail.deliveryFeeProposals ?? [];
  const currency = detail.agencyEarning?.currency ?? detail.cod?.currency ?? proposals[0]?.currency ?? 'XAF';
  const fee = currentDeliveryFee(detail);
  const inWindow = (DELIVERY_FEE_PROPOSAL_WINDOW as readonly string[]).includes(detail.status);
  const pending = proposals.find((p) => p.status === 'pending');
  const hasPending = detail.deliveryFeeProposalPending === true || !!pending;
  // Yours and your agents' — a change-of-agency difference is the platform's.
  const ownProposals = proposals.filter((p) => p.origin !== 'change_agency');
  const counted = ownProposals.filter((p) => p.status !== 'withdrawn').length;
  const canPropose = inWindow && !hasPending && counted < MAX_DELIVERY_FEE_PROPOSALS;
  const latest = ownProposals[0];
  const afterRejection = latest?.status === 'rejected' && !hasPending;
  const customerDeclined = !!latest && afterRejection && rejectedByCustomer(latest);
  // Decline works only while `assigned` — a `handing_over` shipment answers 422.
  const canDecline = afterRejection && canRejectStatus(detail.status);

  const components = detail.feeComponents ?? null;
  const payer = detail.deliveryPayer ?? null;

  if (!inWindow && proposals.length === 0 && !detail.deliveryFeeOverride && !components && !payer) return null;

  const pickupBlockedText = !pending
    ? t('deliveryFee.pickupBlocked')
    : awaitingTopup(pending)
      ? t('deliveryFee.pickupBlockedTopup')
      : approverOf(pending) === 'customer'
        ? t('deliveryFee.pickupBlockedCustomer')
        : t('deliveryFee.pickupBlockedVendor');

  const who = (actor: DeliveryFeeProposalActor | null | undefined): string => {
    if (!actor) return t('common:values.notAvailable');
    switch (actor.role) {
      case 'agency':
        return t('deliveryFee.by.agency');
      case 'agent': {
        const name = actor.agentId ? agents.find((a) => a.id === actor.agentId)?.name : undefined;
        return name ?? t('deliveryFee.by.agent');
      }
      case 'vendor':
        return t('deliveryFee.by.vendor');
      case 'system':
        return t('deliveryFee.by.system');
      case 'customer':
        return t('deliveryFee.by.customer');
      default:
        return t('common:values.notAvailable');
    }
  };

  const withdrawnText = (p: DeliveryFeeProposal): string => {
    if (p.withdrawalReason === 'shipment_declined') return t('deliveryFee.withdrawnDeclined');
    if (p.withdrawalReason === 'agent_detached') return t('deliveryFee.withdrawnAgentLeft');
    return t('deliveryFee.withdrawnBy', { who: who(p.respondedBy) });
  };

  const withdraw = async (p: DeliveryFeeProposal) => {
    const result = await withdrawDeliveryFee(detail.id, p.id, onChanged);
    if (result) onChanged();
  };

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {t('deliveryFee.title')}
      </h3>

      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {fee !== null ? formatCurrency(fee, currency) : t('common:values.notAvailable')}
            </p>
            {payer && (
              <p className="text-xs text-muted-foreground">
                {payer === 'customer' ? t('deliveryFee.paidBy.customer') : t('deliveryFee.paidBy.vendor')}
              </p>
            )}
            {detail.deliveryFeeOverride && (
              <p className="text-xs text-muted-foreground">
                {t('deliveryFee.agreedOn', { date: formatDateTime(detail.deliveryFeeOverride.approvedAt) })}
              </p>
            )}
            {hasPending && <p className="text-xs text-amber-700 dark:text-amber-300">{pickupBlockedText}</p>}
          </div>
          {canPropose && (
            <Button
              size="sm"
              variant="outline"
              className="flex-shrink-0 gap-1.5"
              onClick={() => setDialog({ proposal: null })}
            >
              <Receipt className="w-3.5 h-3.5" />
              {afterRejection ? t('deliveryFee.proposeAgain') : t('deliveryFee.propose')}
            </Button>
          )}
        </div>

        {components && (
          <FeeBreakdown components={components} currency={currency} overridden={!!detail.deliveryFeeOverride} />
        )}

        {canDecline && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">
              {customerDeclined ? t('deliveryFee.afterCustomerRejection') : t('deliveryFee.afterRejection')}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              onClick={onDecline}
            >
              <Ban className="w-3.5 h-3.5" /> {t('deliveryFee.decline')}
            </Button>
          </div>
        )}
        {afterRejection && detail.status === 'handing_over' && (
          <p className="text-xs text-muted-foreground">
            {customerDeclined ? t('deliveryFee.afterCustomerRejectionHandover') : t('deliveryFee.afterRejectionHandover')}
          </p>
        )}

        {proposals.length > 0 && (
          <ul className="space-y-2">
            {proposals.map((p) => {
              const known = isKnownStatus(p.status);
              const badge = known ? badgeKey(p as DeliveryFeeProposal & { status: DeliveryFeeProposalStatus }) : null;
              // An unknown status is read-only, whatever `availableActions` says.
              const canEdit = known && p.availableActions.includes('edit');
              const canWithdraw = known && p.availableActions.includes('withdraw');
              return (
                <li key={p.id} className="rounded-md border p-2.5 space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {formatCurrency(p.feeBefore, p.currency)}
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground rtl:rotate-180" />
                      {formatCurrency(p.proposedFee, p.currency)}
                    </span>
                    <Badge variant="outline" className={cn('font-normal', known && STATUS_CLASS[p.status as DeliveryFeeProposalStatus])}>
                      {badge ? t(`deliveryFee.status.${badge}`) : t('deliveryFee.status.unknown')}
                    </Badge>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap break-words">{p.reason}</p>
                  <p className="text-muted-foreground">
                    {t('deliveryFee.proposedBy', { who: who(p.proposedBy), date: formatDateTime(p.createdAt) })}
                    {p.agencyEdited && p.proposedBy.role === 'agent' && ` · ${t('deliveryFee.agencyEdited')}`}
                  </p>
                  {p.origin === 'change_agency' && <p className="text-muted-foreground">{t('deliveryFee.changeAgencyNote')}</p>}
                  {p.origin === 'combined_request' && <p className="text-muted-foreground">{t('deliveryFee.combinedNote')}</p>}
                  {badge === 'applied' && p.origin !== 'combined_request' && (
                    <p className="text-muted-foreground">{t('deliveryFee.appliedDirectly')}</p>
                  )}
                  {awaitingTopup(p) && p.topup && (
                    <p className="text-amber-700 dark:text-amber-300">
                      {t('deliveryFee.topupAwaiting', { amount: formatCurrency(p.topup.amount, p.currency) })}
                    </p>
                  )}
                  {p.edits && p.edits.length > 0 && (
                    <ul className="space-y-0.5 border-s ps-2 text-muted-foreground">
                      {p.edits.map((e) => (
                        <li key={e.version}>
                          {t('deliveryFee.editEntry', {
                            who: who(e.editedBy),
                            date: formatDateTime(e.at),
                            before: formatCurrency(e.feeBefore, p.currency),
                            after: formatCurrency(e.feeAfter, p.currency),
                          })}
                        </li>
                      ))}
                    </ul>
                  )}
                  {p.status === 'rejected' && p.rejectionNote && (
                    <p className="text-destructive">
                      {rejectedByCustomer(p)
                        ? t('deliveryFee.rejectionNoteCustomer', { note: p.rejectionNote })
                        : t('deliveryFee.rejectionNote', { note: p.rejectionNote })}
                    </p>
                  )}
                  {p.status === 'withdrawn' && <p className="text-muted-foreground">{withdrawnText(p)}</p>}
                  {(canEdit || canWithdraw) && (
                    <div className="flex justify-end gap-2 pt-0.5">
                      {canEdit && (
                        <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setDialog({ proposal: p })}>
                          <Pencil className="w-3 h-3" /> {t('deliveryFee.edit')}
                        </Button>
                      )}
                      {canWithdraw && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1"
                          disabled={pendingKey === `fee-withdraw:${p.id}`}
                          onClick={() => void withdraw(p)}
                        >
                          {pendingKey === `fee-withdraw:${p.id}` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Undo2 className="w-3 h-3" />
                          )}
                          {t('deliveryFee.withdraw')}
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <DeliveryFeeProposalDialog
        shipmentId={detail.id}
        currentFee={fee}
        currency={currency}
        deliveryPayer={payer}
        proposal={dialog?.proposal ?? null}
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        onChanged={onChanged}
      />
    </section>
  );
}
