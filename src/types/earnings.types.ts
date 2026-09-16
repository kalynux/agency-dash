// Agency Earnings — see api-doc/agency/earnings.md

/**
 * The per-window ceiling on what an **unverified** agency may withdraw.
 *
 * ⛔ **The whole object being absent means NO LIMIT — never a limit of zero.**
 * It is `null` for a verified account *and* on any deployment with the feature
 * switched off, which is the default today, so absent is the normal case. A
 * component that reads `remaining` out of a missing object with `?? 0` tells
 * every verified agency it cannot withdraw. Branch on the object, never on its
 * numbers — {@link hasPayoutAllowance} is the guard.
 *
 * Verification removes it entirely; that is the only remedy besides waiting.
 */
export interface PayoutAllowance {
  /** The most that may leave per window while KYC is unverified. Minor units. */
  cap: number;
  /** Already **paid** inside the window. Minor units. */
  used: number;
  /**
   * What is left. ⚠ **The next payout is capped at this, not at `available`** —
   * the request takes `min(available, remaining)` and leaves the rest behind.
   * Show it beside `available` whenever it is present, or the agency requests a
   * payout, receives a fraction of their balance, and nothing on screen says why.
   */
  remaining: number;
  /** Length of the rolling window. 30 today. */
  windowDays: number;
  /**
   * ISO-8601, or `null` when nothing is counted.
   *
   * ⚠ **This is when the FIRST tranche frees up, not when the whole cap
   * returns.** Never write "your full limit resets on <date>".
   *
   * ⚠ The window is **rolling**, not calendar: the oldest payout simply ages
   * out, so there is no month boundary to count down to. (A calendar reset would
   * let twice the cap leave inside 48 hours across a boundary, which is the
   * burst the limit exists to prevent.)
   */
  resetsAt: string | null;
}

/**
 * The guard that keeps "no limit" from being read as "a limit of zero".
 *
 * Generic so narrowing keeps the rest of the balance — a predicate that widened
 * to `{ payoutAllowance }` alone would cost the caller `available` on the very
 * line where it needs both.
 */
export function hasPayoutAllowance<T extends Pick<EarningsBalance, 'payoutAllowance'>>(
  balance: T | null | undefined,
): balance is T & { payoutAllowance: PayoutAllowance } {
  return !!balance?.payoutAllowance;
}

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
   * `null`/absent unless a payout limit applies — read
   * {@link PayoutAllowance} before touching it.
   */
  payoutAllowance?: PayoutAllowance | null;
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

// ─── 409 EARNINGS_PAYOUT_UNVERIFIED_CAP_REACHED ───────────────────────────────

/** `409` — the unverified-account payout allowance refused this request. */
export const EARNINGS_PAYOUT_UNVERIFIED_CAP_REACHED =
  'EARNINGS_PAYOUT_UNVERIFIED_CAP_REACHED';

/**
 * Why the allowance refused. Two states with two different sentences, which is
 * exactly why the backend reports them separately instead of returning a bare
 * "below minimum".
 *
 * - `allowance_spent` — nothing left this window.
 * - `remainder_below_minimum` — there IS allowance left, but less than the
 *   platform's minimum payout. The money is genuinely there and genuinely
 *   unreachable until the window rolls. Reporting this as a plain "below
 *   minimum" leaves the agency waiting for a balance they already have.
 */
export type PayoutCapReason = 'allowance_spent' | 'remainder_below_minimum';

/**
 * `details` off the refusal: the allowance as it stood, plus the reason.
 *
 * ⛔ **Retrying does not help on either reason.** Never render a bare "try
 * again" — the only remedies are verification, or waiting for `resetsAt`.
 */
export interface PayoutCapRefusal extends PayoutAllowance {
  reason: PayoutCapReason;
  /** The platform minimum payout. Sent on `remainder_below_minimum` only. */
  minAmount?: number;
}

/**
 * Read the refusal out of an `ApiError.details`, or `null` when it is not the
 * shape we were promised.
 *
 * Parsed rather than cast because this drives copy that names amounts: a partial
 * payload would otherwise render "You have left of your limit". An
 * unrecognisable one falls back to the catalogued message for the code, which
 * still says the true thing.
 */
/**
 * The refusal the server *would* give, worked out from the allowance already on
 * screen — so the withdraw button is disabled with the real explanation rather
 * than offered, pressed, and refused.
 *
 * Same shape and same two reasons as the server's, so one renderer serves both
 * paths and the copy cannot drift between "before you pressed" and "after".
 * `null` whenever a payout would go through — including, crucially, whenever
 * there is no allowance at all.
 */
export function projectPayoutCapRefusal(
  balance: Pick<EarningsBalance, 'payoutAllowance'> | null | undefined,
  minAmount: number,
): PayoutCapRefusal | null {
  if (!hasPayoutAllowance(balance)) return null;
  const allowance = balance.payoutAllowance;

  if (allowance.remaining <= 0) return { ...allowance, reason: 'allowance_spent' };
  if (allowance.remaining < minAmount) {
    return { ...allowance, reason: 'remainder_below_minimum', minAmount };
  }
  return null;
}

export function readPayoutCapRefusal(details: unknown): PayoutCapRefusal | null {
  if (!details || typeof details !== 'object') return null;
  const d = details as Record<string, unknown>;

  const reason = d.reason;
  if (reason !== 'allowance_spent' && reason !== 'remainder_below_minimum') return null;

  const num = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

  const cap = num(d.cap);
  const used = num(d.used);
  const remaining = num(d.remaining);
  const windowDays = num(d.windowDays);
  if (cap === null || used === null || remaining === null || windowDays === null) return null;

  const minAmount = num(d.minAmount);

  return {
    cap,
    used,
    remaining,
    windowDays,
    resetsAt: typeof d.resetsAt === 'string' ? d.resetsAt : null,
    reason,
    ...(minAmount === null ? {} : { minAmount }),
  };
}
