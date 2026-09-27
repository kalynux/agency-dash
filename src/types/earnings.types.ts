// Agency Earnings — see api-doc/agency/earnings.md

export interface EarningsBalance {
  /** Held — hold window not yet elapsed, or COD cash not yet settled. Minor units. */
  pending: number;
  /** Withdrawable — hold window elapsed and (for COD) cash settled. Minor units. */
  available: number;
  /** COD rolling reserve — a slice of released COD earnings parked for 30 days. Minor units. */
  reserve: number;
  /** Earmarked for a pending payout request. Minor units. */
  requested: number;
  currency: string;
  /**
   * @deprecated Always `null` since 2026-09-27 — kept by the backend only so old
   * clients don't break. It briefly (2026-09-15 → 09-27) carried a withdrawal
   * limit for unverified accounts; that limit was deleted, and every account now
   * withdraws its whole `available`. ⛔ Never render a limit, a "remaining"
   * figure or a "verify to withdraw more" prompt from it — ignore it.
   */
  payoutAllowance?: null;
}

export interface EarningsBalanceResponse {
  success: true;
  data: EarningsBalance;
}

// ─── Payout requests ──────────────────────────────────────────────────────────

/**
 * ⛔ **Five values since 2026-09-15, and only two of them are terminal.**
 *
 * `processing` and `failed` arrived when payouts became automatable, and **both
 * still hold the agency's money** — a failed transfer has returned nothing. Only
 * `rejected` puts the amount back into `available`.
 *
 * | status | the money is | say |
 * |---|---|---|
 * | `pending` | held | "Being reviewed" |
 * | `processing` | held | "On its way" — ⛔ never "Paid" |
 * | `paid` | gone to them | "Paid" |
 * | `rejected` | back in `available` | "Declined — <rejectionReason>" |
 * | `failed` | **still held** | "Payment failed — we're looking into it" |
 *
 * ⚠ This widening is **breaking, not additive**: a status map that was
 * exhaustive over the old `pending | paid | rejected` sends both new values into
 * whichever branch came last — usually `rejected`, which tells an agency their
 * payout was declined while it is in flight. Render every value from its own
 * branch, via {@link readPayoutStatus}.
 */
export type EarningsPayoutStatus = 'pending' | 'processing' | 'paid' | 'rejected' | 'failed';

/**
 * What the UI actually renders: the five known statuses plus the catch-all for
 * one this build has not been told about.
 *
 * ⛔ **An unrecognised status is in-progress, never a failure.** The safe
 * default for a money record we do not understand is "still happening" — the
 * backend's state machine is free to grow again, and a build shipped before
 * that must not announce a decline it invented.
 */
export type PayoutStatusView = EarningsPayoutStatus | 'unknown';

/**
 * The statuses in which a payout is still **open** — the agency's money is held,
 * and a second request is refused with `409 EARNINGS_PAYOUT_ALREADY_PENDING`.
 *
 * Mirrors the backend's `PAYOUT_HELD_STATUSES` (`pending | processing | failed`,
 * the partial unique index on `payout_requests`), with `unknown` folded in for
 * the same reason it renders as in-progress.
 */
export type OpenPayoutStatus = Exclude<PayoutStatusView, 'paid' | 'rejected'>;

const KNOWN_PAYOUT_STATUSES: readonly EarningsPayoutStatus[] = [
  'pending',
  'processing',
  'paid',
  'rejected',
  'failed',
];

/**
 * The status to render, with anything unrecognised folded into `unknown` rather
 * than handed to a lookup that would return `undefined` and paint a blank badge.
 */
export function readPayoutStatus(status: string | null | undefined): PayoutStatusView {
  return KNOWN_PAYOUT_STATUSES.includes(status as EarningsPayoutStatus)
    ? (status as EarningsPayoutStatus)
    : 'unknown';
}

/**
 * The open status of this payout, or `null` when it is settled (`paid`) or
 * closed (`rejected`) — and `null` too when there is no payout at all, so the
 * caller cannot accidentally read "no request" as an unknown one.
 *
 * ⛔ **Gate "Request payout" on this, not on `status === 'pending'`.** All three
 * open statuses still hold the balance; offering a fresh request on `failed`
 * sends the agency into a 409 that says a request is already open.
 */
export function openPayoutStatus(
  payout: Pick<EarningsPayoutRequest, 'status'> | null | undefined,
): OpenPayoutStatus | null {
  if (!payout) return null;
  const view = readPayoutStatus(payout.status);
  return view === 'paid' || view === 'rejected' ? null : view;
}

export interface EarningsPayoutRequest {
  id: string;
  amount: number;
  currency: string;
  status: EarningsPayoutStatus;
  /** `manual` (you requested it) or `auto_threshold` (platform opened it at the balance cap). */
  origin?: 'manual' | 'auto_threshold';
  /** The linked PAYOUT_REQUEST support ticket — open it under Tickets for the full history. */
  ticketId: string | null;
  /** Set when `status` is `rejected` — and the ONLY place the *why* is told. */
  rejectionReason: string | null;
  createdAt: string;
  /** When an admin resolved it; `null` while the request is still open. */
  resolvedAt: string | null;
}

/** POST /agency/earnings/payout */
export interface EarningsPayoutRequestResponse {
  success: true;
  data: EarningsPayoutRequest;
  message?: string;
}

/** GET /agency/earnings/payout — null if no payout was ever requested. */
export interface EarningsPayoutStatusResponse {
  success: true;
  data: EarningsPayoutRequest | null;
}
