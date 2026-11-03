import type { PayoutStatusView } from '@/types/earnings.types';

/**
 * How each payout status is rendered — colour, badge label, and the line under
 * it that says where the money actually is. Shared by the agency's earnings and
 * the referral page: separate balances, one payout pipeline.
 *
 * ⛔ **Every value has its OWN entry, `unknown` included.** This map used to be
 * exhaustive over three statuses; when `processing` and `failed` arrived, a map
 * of that shape sends both into whichever branch is reached last — telling an
 * agency their payout was *declined* while their money is in flight.
 *
 * ⚠ The colours carry the same distinction the copy does. `failed` is amber —
 * still open, money still held, an administrator is on it — and deliberately
 * NOT the red of `rejected`, which is closed with the balance handed back.
 * `processing` is blue rather than green, because green reads as "arrived".
 */
export const PAYOUT_STATUS_VIEW = {
  pending: {
    className: 'border-yellow-500 text-yellow-600 bg-yellow-50',
    labelKey: 'earnings.status.pending',
    noteKey: 'earnings.statusNote.pending',
  },
  processing: {
    className: 'border-blue-500 text-blue-600 bg-blue-50',
    labelKey: 'earnings.status.processing',
    noteKey: 'earnings.statusNote.processing',
  },
  paid: {
    className: 'border-green-500 text-green-600 bg-green-50',
    labelKey: 'earnings.status.paid',
    // The only status that needs no qualifier: the money arrived.
    noteKey: null,
  },
  rejected: {
    className: 'border-red-500 text-red-600 bg-red-50',
    labelKey: 'earnings.status.rejected',
    noteKey: 'earnings.statusNote.rejected',
  },
  failed: {
    className: 'border-orange-500 text-orange-600 bg-orange-50',
    labelKey: 'earnings.status.failed',
    noteKey: 'earnings.statusNote.failed',
  },
  unknown: {
    className: 'border-muted-foreground/40 text-muted-foreground bg-muted',
    labelKey: 'earnings.status.unknown',
    noteKey: 'earnings.statusNote.unknown',
  },
} as const satisfies Record<
  PayoutStatusView,
  { className: string; labelKey: string; noteKey: string | null }
>;
