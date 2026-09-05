/**
 * One stock request, in the inbox list.
 *
 * THE THREE QUANTITIES. `quantityBefore` is what the proposer saw,
 * `currentQuantity` is what the SKU reads now, `requestedQuantity` is what it will
 * read if approved. When the first two differ that is DRIFT — somebody changed the
 * number between the proposal and now. It is deliberately not a 409, because the
 * request proposes an absolute figure, so drift changes *what is replaced*, not
 * whether the request still makes sense. It is also the one thing an approver has
 * to notice before signing off, hence the callout rather than a subtitle.
 *
 * WHY THE QUANTITY IS THE HEADLINE. The list response carries ids, not names — no
 * product title, no SKU — so the proposal itself is the only thing that tells one
 * row from another. It leads the row; the status badge follows it. Whether the row
 * needs an answer is answered before you read anything, by the tint and the arrow.
 *
 * See api-doc/agency/stock-requests.md §3.
 */

import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatNumber, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { hasDrift } from '@/types/stock-request.types';
import type { StockRequest, StockRequestStatus } from '@/types/stock-request.types';

const STATUS_TONE: Record<StockRequestStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400',
  approved: 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400',
  rejected: 'border-destructive/30 bg-destructive/5 text-destructive',
  withdrawn: 'border-muted-foreground/30 bg-muted text-muted-foreground',
};

export function StockRequestStatusBadge({ status }: { status: StockRequestStatus }) {
  const { t } = useTranslation('inventory');
  return (
    <Badge variant="outline" className={cn('flex-shrink-0', STATUS_TONE[status])}>
      {t(`requests.statuses.${status}`)}
    </Badge>
  );
}

/** `120 → 90`, the shape of the whole proposal in one line. */
export function QuantityChange({
  from,
  to,
  className,
}: {
  from: number | null;
  to: number;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-numeric tabular-nums', className)}>
      <span className="text-muted-foreground">{from == null ? '—' : formatNumber(from)}</span>
      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground rtl:-scale-x-100" />
      <span className="font-semibold">{formatNumber(to)}</span>
    </span>
  );
}

/**
 * Somebody moved the number under the proposal.
 *
 * Shown only when it is true, and worded as information rather than an error —
 * approving is still a perfectly sensible thing to do, it just replaces a
 * different figure than the proposer was looking at.
 *
 * `compact` is the list's version: one chip that says the number moved and what it
 * reads now. The full sentence — which figure the approval applies, and that it
 * applies it anyway — belongs where the decision is actually taken, and a
 * three-line amber paragraph on every drifted row buries the rows around it.
 */
export function DriftNotice({ request, compact }: { request: StockRequest; compact?: boolean }) {
  const { t } = useTranslation('inventory');
  if (!hasDrift(request)) return null;

  const current = request.currentQuantity == null ? '—' : formatNumber(request.currentQuantity);

  if (compact) {
    return (
      <p className="mt-2 flex max-w-full items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{t('requests.driftShort', { current })}</span>
      </p>
    );
  }

  return (
    <p className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <span>
        {t('requests.drift', {
          before: request.quantityBefore == null ? '—' : formatNumber(request.quantityBefore),
          current,
        })}
      </span>
    </p>
  );
}

export function StockRequestCard({
  request,
  onOpen,
}: {
  request: StockRequest;
  onOpen: (request: StockRequest) => void;
}) {
  const { t } = useTranslation('inventory');
  const raisedByUs = request.requestedByRole === 'agency';
  const awaiting = request.awaitingMyDecision;
  // Out of us, or into us. Read before any of the words are, which is what lets
  // the two halves of one inbox be told apart at a glance.
  const DirectionIcon = raisedByUs ? ArrowUpRight : ArrowDownLeft;

  const open = () => onOpen(request);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      // A row that opens a sheet has to be reachable without a pointer; the
      // dashboard's other clickable rows (see `Notifications`) key off the same
      // pair rather than wrapping the row in a `<button>`, which cannot legally
      // hold the paragraphs inside it.
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
      className={cn(
        'group flex cursor-pointer items-start gap-3 p-4 transition-colors',
        'hover:bg-muted/50 active:bg-muted/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50',
        // The rows that need an answer carry a tint, so "is any of this mine?"
        // is answered by scrolling rather than by reading every badge.
        awaiting && 'bg-amber-500/[0.06]',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
          awaiting
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <DirectionIcon className="h-4 w-4 rtl:-scale-x-100" />
      </span>

      <div className="min-w-0 flex-1">
        {/* The proposal, then how it ended up. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <QuantityChange
            from={request.quantityBefore}
            to={request.requestedQuantity}
            className="text-base"
          />
          <StockRequestStatusBadge status={request.status} />
          {awaiting && (
            <Badge className="flex-shrink-0 bg-amber-500 text-white hover:bg-amber-500">
              {t('requests.awaitingYou')}
            </Badge>
          )}
        </div>

        {/* Who raised it. The timestamp joins this line on phones, where the
            right-hand rail is width the proposal needs more. */}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span>{raisedByUs ? t('requests.raisedByYou') : t('requests.raisedByVendor')}</span>
          <span aria-hidden="true" className="sm:hidden">
            ·
          </span>
          <time
            dateTime={request.requestedAt}
            title={formatDateTime(request.requestedAt)}
            className="sm:hidden"
          >
            {formatRelativeTime(request.requestedAt)}
          </time>
        </p>

        {request.note && (
          <p className="mt-1.5 truncate text-xs italic text-muted-foreground">{request.note}</p>
        )}

        <DriftNotice request={request} compact />
      </div>

      {/* Relative, not absolute: "2 hours ago" is what tells you whether a
          pending request is stale, and it fits a column an exact stamp does not.
          The exact one stays in the tooltip and in the sheet's trail. The chevron
          stays at every width — on a phone it is the only thing saying the row
          opens onto something. */}
      <div className="flex flex-shrink-0 items-center gap-2 pt-1">
        <time
          dateTime={request.requestedAt}
          title={formatDateTime(request.requestedAt)}
          className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline"
        >
          {formatRelativeTime(request.requestedAt)}
        </time>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground rtl:-scale-x-100" />
      </div>
    </div>
  );
}
