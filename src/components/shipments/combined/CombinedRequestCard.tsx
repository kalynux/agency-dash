import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Ban, ExternalLink, MessageSquareQuote, TicketPercent } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  COMBINED_DELIVERY_REQUEST_STATUSES,
  type CombinedDeliveryRequest,
  type CombinedDeliveryRequestStatus,
} from '@/types/combined-delivery-request.types';
import { parcelLabel } from './parcelLabel';
import type { ParcelSummary } from './useParcelSummaries';

const STATUS_CLASS: Record<CombinedDeliveryRequestStatus, string> = {
  open: 'text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-800',
  answered: 'text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-800',
  declined: 'text-destructive border-destructive/40',
  cancelled: 'text-muted-foreground',
};

function isKnownStatus(status: string): status is CombinedDeliveryRequestStatus {
  return (COMBINED_DELIVERY_REQUEST_STATUSES as readonly string[]).includes(status);
}

export interface CombinedRequestCardProps {
  request: CombinedDeliveryRequest;
  summaries: Record<string, ParcelSummary | null>;
  /** The notification that brought us here named one of this request's parcels. */
  highlighted?: boolean;
  onLower: (request: CombinedDeliveryRequest) => void;
  onDecline: (request: CombinedDeliveryRequest) => void;
}

/**
 * One customer's request for a single lower price on several parcels. Open
 * requests carry the two answers; answered ones show what each parcel went
 * from → to and the saving, as the server recorded them.
 */
export function CombinedRequestCard({ request, summaries, highlighted, onLower, onDecline }: CombinedRequestCardProps) {
  const { t } = useTranslation(['shipments', 'common']);
  const known = isKnownStatus(request.status);
  const isOpen = request.status === 'open';
  const answeredFee = new Map((request.answer?.fees ?? []).map((f) => [f.shipmentId, f]));
  const money = (value: number) => formatCurrency(value, request.currency);

  return (
    <article
      className={cn('space-y-3 p-4', highlighted && 'bg-primary/[0.04] ring-1 ring-inset ring-primary/40')}
      aria-label={t('combined.requestedOn', { date: formatDateTime(request.createdAt) })}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="outline" className={cn('font-normal', known && STATUS_CLASS[request.status as CombinedDeliveryRequestStatus])}>
            {known ? t(`combined.status.${request.status as CombinedDeliveryRequestStatus}`) : t('combined.status.unknown')}
          </Badge>
          <span className="text-sm font-medium">{t('combined.parcels', { count: request.shipments.length })}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {t('combined.requestedOn', { date: formatDateTime(request.createdAt) })}
        </span>
      </header>

      {request.note && (
        <div className="flex gap-2 rounded-md bg-muted/50 p-2.5 text-sm">
          <MessageSquareQuote className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{t('combined.customerNote')}</p>
            <p className="whitespace-pre-wrap break-words">{request.note}</p>
          </div>
        </div>
      )}

      <ul className="divide-y rounded-md border">
        {request.shipments.map((parcel, index) => {
          const summary = summaries[parcel.shipmentId] ?? null;
          const answered = answeredFee.get(parcel.shipmentId);
          const route = summary && (summary.from || summary.to) ? t('table.route', {
            from: summary.from ?? t('table.unknownPlace'),
            to: summary.to ?? t('table.unknownPlace'),
          }) : null;
          return (
            <li key={parcel.shipmentId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{parcelLabel(t, summary, index)}</p>
                {route && <p className="truncate text-xs text-muted-foreground">{route}</p>}
                <Link
                  to={`/dashboard/shipments?open=${encodeURIComponent(parcel.shipmentId)}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {t('combined.openShipment')}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </Link>
              </div>
              <div className="text-end text-sm">
                {answered ? (
                  <span className="inline-flex items-center gap-1.5 font-numeric">
                    <span className="text-muted-foreground line-through">{money(answered.feeBefore)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" aria-hidden />
                    <span className="font-semibold">{money(answered.feeAfter)}</span>
                  </span>
                ) : (
                  <>
                    <span className="font-numeric">{money(parcel.feeAtRequest)}</span>
                    <p className="text-xs text-muted-foreground">
                      {request.status === 'answered' ? t('combined.unchanged') : t('combined.feeWhenAsked')}
                    </p>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {request.status === 'answered' && request.answer && (
        <div className="space-y-0.5 text-sm">
          <p className="font-medium text-emerald-700 dark:text-emerald-400">
            {t('combined.saving', { amount: money(request.answer.saving) })}
          </p>
          <p className="text-xs text-muted-foreground">{t('combined.answeredOn', { date: formatDateTime(request.answer.answeredAt) })}</p>
          {request.answer.note && <p className="text-xs text-muted-foreground">{t('combined.yourNote', { note: request.answer.note })}</p>}
        </div>
      )}
      {request.status === 'declined' && (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {request.closedAt && <p>{t('combined.declinedOn', { date: formatDateTime(request.closedAt) })}</p>}
          {request.declineNote && <p>{t('combined.yourNote', { note: request.declineNote })}</p>}
        </div>
      )}
      {request.status === 'cancelled' && request.closedAt && (
        <p className="text-xs text-muted-foreground">{t('combined.cancelledOn', { date: formatDateTime(request.closedAt) })}</p>
      )}

      {isOpen && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onDecline(request)}>
            <Ban className="h-3.5 w-3.5" />
            {t('combined.decline')}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => onLower(request)}>
            <TicketPercent className="h-3.5 w-3.5" />
            {t('combined.lower')}
          </Button>
        </div>
      )}
    </article>
  );
}
