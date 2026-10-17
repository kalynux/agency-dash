import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ExternalLink, MessageSquareQuote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PayerFeeAnswer } from '@/components/shipments/PayerFeeAnswer';
import { payerAcceptedAwaitingPayment } from '@/components/shipments/delivery-fee-rules';
import type { ParcelSummary } from '@/components/shipments/combined/useParcelSummaries';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  DELIVERY_FEE_PROPOSAL_STATUSES,
  type DeliveryFeeProposal,
  type DeliveryFeeProposalStatus,
} from '@/types/delivery-fee-proposal.types';

type InboxBadge = 'awaitingYou' | 'acceptedAwaitingPayment' | 'accepted' | 'declined' | 'withdrawn';

const BADGE_CLASS: Record<InboxBadge, string> = {
  awaitingYou: 'text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-800',
  acceptedAwaitingPayment: 'text-sky-700 border-sky-300 dark:text-sky-300 dark:border-sky-800',
  accepted: 'text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-800',
  declined: 'text-destructive border-destructive/40',
  withdrawn: 'text-muted-foreground',
};

const BY_STATUS: Record<DeliveryFeeProposalStatus, InboxBadge> = {
  pending: 'awaitingYou',
  approved: 'accepted',
  rejected: 'declined',
  withdrawn: 'withdrawn',
};

function inboxBadge(p: DeliveryFeeProposal): InboxBadge | null {
  if (!(DELIVERY_FEE_PROPOSAL_STATUSES as readonly string[]).includes(p.status)) return null;
  if (payerAcceptedAwaitingPayment(p)) return 'acceptedAwaitingPayment';
  return BY_STATUS[p.status as DeliveryFeeProposalStatus];
}

export interface PayerProposalCardProps {
  proposal: DeliveryFeeProposal;
  /** The parcel's order and customer, read from the shipment — `null` while (or when) it can't be. */
  summary: ParcelSummary | null;
  onChanged: () => void;
}

/**
 * One fee the payer proposed, as the inbox lists it: who, which order, the
 * figure before → after, their reason, and the answer. The row carries only
 * ids, so the order number comes from the shipment (`summary`).
 */
export function PayerProposalCard({ proposal: p, summary, onChanged }: PayerProposalCardProps) {
  const { t } = useTranslation(['shipments', 'common']);
  const badge = inboxBadge(p);
  const money = (value: number) => formatCurrency(value, p.currency);
  const delta = p.proposedFee - p.feeBefore;
  // Words only — the buttons never look at who proposed.
  const proposer =
    p.proposedBy.role === 'customer'
      ? t('feeProposals.fromCustomer')
      : p.proposedBy.role === 'vendor'
        ? t('feeProposals.fromVendor')
        : null;
  const order = summary
    ? summary.customerName
      ? `${t('combined.order', { number: summary.orderNumber })} · ${summary.customerName}`
      : t('combined.order', { number: summary.orderNumber })
    : t('feeProposals.parcelFallback');
  const route =
    summary && (summary.from || summary.to)
      ? t('table.route', { from: summary.from ?? t('table.unknownPlace'), to: summary.to ?? t('table.unknownPlace') })
      : null;

  return (
    <article className="space-y-3 p-4" aria-label={order}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn('font-normal', badge && BADGE_CLASS[badge])}>
            {badge ? t(`deliveryFee.status.${badge}`) : t('deliveryFee.status.unknown')}
          </Badge>
          {proposer && <span className="text-sm font-medium">{proposer}</span>}
        </div>
        <span className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</span>
      </header>

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{order}</p>
          {route && <p className="truncate text-xs text-muted-foreground">{route}</p>}
          <Link
            to={`/dashboard/shipments?open=${encodeURIComponent(p.shipmentId)}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {t('combined.openShipment')}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        </div>
        <div className="text-end">
          <span className="inline-flex items-center gap-1.5 text-sm font-numeric">
            <span className="text-muted-foreground">{money(p.feeBefore)}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" aria-hidden />
            <span className="font-semibold">{money(p.proposedFee)}</span>
          </span>
          {delta !== 0 && (
            <p className="text-xs text-muted-foreground">
              {delta > 0
                ? t('feeProposals.higherBy', { amount: money(delta) })
                : t('feeProposals.lowerBy', { amount: money(-delta) })}
            </p>
          )}
        </div>
      </div>

      {p.reason && (
        <div className="flex gap-2 rounded-md bg-muted/50 p-2.5 text-sm">
          <MessageSquareQuote className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{t('feeProposals.theirReason')}</p>
            <p className="whitespace-pre-wrap break-words">{p.reason}</p>
          </div>
        </div>
      )}

      {payerAcceptedAwaitingPayment(p) && p.topup && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {t('deliveryFee.payer.awaitingPayment', { amount: money(p.topup.amount) })}
        </p>
      )}
      {p.status === 'rejected' && p.rejectionNote && (
        <p className="text-xs text-muted-foreground">{t('deliveryFee.payer.declineNoteSent', { note: p.rejectionNote })}</p>
      )}
      {p.respondedBy && p.status !== 'pending' && (
        <p className="text-xs text-muted-foreground">{t('feeProposals.closedOn', { date: formatDateTime(p.respondedBy.at ?? p.updatedAt) })}</p>
      )}

      <PayerFeeAnswer shipmentId={p.shipmentId} proposal={p} onChanged={onChanged} />
    </article>
  );
}
