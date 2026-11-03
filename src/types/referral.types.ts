// The referral program — see api-doc/me/referrals.md
//
// ⛔ Every rate, duration, wait and minimum on the referral page comes from these
// types. None of them may be written into code or copy: an administrator changes
// them, and a partner's rates can differ from the next partner's.

import type { PayoutMethod } from '@/types/api';

export interface ReferralProgramInfo {
  enabled: boolean;
  minPayoutAmount: number;
  rewardWaitDays: number;
}

/** Someone who has never applied. `canApply` is false while the program is off. */
export interface ReferralNotPartner {
  program: ReferralProgramInfo;
  status: 'none';
  canApply: boolean;
}

export type ReferralPartnerStatus = 'pending' | 'active' | 'rejected' | 'suspended' | 'terminated';

/**
 * ⚠ `codeActive` is only `status === 'active'`, and it stays `true` while the
 * program is switched off, when a link earns nothing. Ask {@link linkEarns}.
 */
export interface ReferralPartner {
  program: ReferralProgramInfo;
  status: ReferralPartnerStatus;
  /** The administrator's reason, written to be shown to the partner. */
  statusReason: string | null;
  /** True only for a rejected or terminated person an administrator allowed back. */
  canApply: boolean;
  /** `null` until the first approval, so a pending or rejected applicant has neither. */
  code: string | null;
  codeActive: boolean;
  links: ReferralLinks | null;
  appliedAt: string;
  /** Survives a later rejection or a new application: "was once approved". */
  approvedAt: string | null;
  terms: Record<ReferralEarningCategory, ReferralTerms>;
  balances: ReferralBalances;
  /** Suspended or terminated, and no administrator has released the balance. */
  balanceFrozen: boolean;
  canWithdraw: boolean;
  payoutDestination: ReferralPayoutDestination;
  referred: { total: number; earning: number };
}

export type ReferralOverview = ReferralNotPartner | ReferralPartner;

/** Each URL is `null` when the server has no base configured for it. */
export interface ReferralLinks {
  registerUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
}

export type ReferralEarningCategory = 'vendor' | 'customer' | 'agency';

export interface ReferralTerms {
  ratePercent: number;
  durationMonths: number;
}

export interface ReferralBalances {
  /** Rewards still in the wait (`program.rewardWaitDays`). */
  pending: number;
  /** What can be withdrawn. */
  available: number;
  reserve: number;
  /** Held for a withdrawal still open. */
  requested: number;
  /**
   * What the partner OWES after a refund. ⛔ It runs the other way: never add it
   * to the others. While above 0, `available` is 0 and later rewards pay it first.
   */
  clawback: number;
  currency: string;
}

/**
 * Where the money goes. Read live from the role that holds it, so editing it there
 * changes it here. `vendor` and `agent` are on another app; this one can only
 * link to its own payout page, which writes the agency's.
 */
export interface ReferralPayoutDestination {
  source: 'vendor' | 'agency' | 'agent' | 'referral' | null;
  editableHere: boolean;
  method: PayoutMethod | null;
}

export interface ReferralApplyResponse {
  success: true;
  data: { status: ReferralPartnerStatus; appliedAt: string };
}

export interface ReferralOverviewResponse {
  success: true;
  data: ReferralOverview;
}

// ─── The three lists ──────────────────────────────────────────────────────────
//
// ⛔ No order, product, vendor or commission figure exists on these rows, by
// design: a commission and a vendor's plan reveal that vendor's sales, and an
// order reveals what a person bought. Don't ask for them.

/** `agent` is recorded and never earns: `expiresAt` is `null`, `earning` is false. */
export type ReferredCategory = ReferralEarningCategory | 'agent';

export interface ReferredAccount {
  id: string;
  /** Already masked by the server. */
  name: string;
  category: ReferredCategory | (string & {});
  registeredAt: string;
  expiresAt: string | null;
  earning: boolean;
  totalEarned: number;
}

export interface ReferralReward {
  id: string;
  name: string;
  category: string;
  /** What this reward is worth NOW, after any refund. */
  amount: number;
  currency: string;
  /** `reversed`: the whole commission was refunded, so it is shown as 0. */
  status: 'held' | 'released' | 'reversed' | (string & {});
  earnedAt: string;
  availableFrom: string;
  /** A refund reduced it. */
  adjusted: boolean;
}

/** Rendered through `readPayoutStatus`, like every other payout status. */
export interface ReferralPayout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  destination: PayoutMethod;
  rejectionReason: string | null;
  requestedAt: string;
  resolvedAt: string | null;
}

export interface ReferralPayoutResponse {
  success: true;
  data: ReferralPayout;
}

/** `meta` on the wire. ⚠ `totalPages`, where the earnings lists say `pages`. */
export interface ReferralListResponse<T> {
  success: true;
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Reading the overview ─────────────────────────────────────────────────────

/**
 * Does this partner's link bring in new referrals, and their referred accounts
 * earn new rewards, right now? `codeActive` alone says yes while the program is
 * off, when the server attaches no referral and creates no reward.
 */
export function linkEarns(partner: Pick<ReferralPartner, 'codeActive' | 'program'>): boolean {
  return partner.codeActive && partner.program.enabled;
}

/**
 * Show the money and the history? Yes for anyone approved at some point, and for a
 * rejected applicant, whose page the shared rules also list them on. A first-time
 * `pending` has nothing to show; someone re-applying keeps what they earned.
 */
export function hasPartnerHistory(partner: Pick<ReferralPartner, 'status' | 'approvedAt'>): boolean {
  return partner.status !== 'pending' || partner.approvedAt !== null;
}

/**
 * Why there is no withdraw button, or `null` when no reason applies.
 *
 * `canWithdraw` is the server's answer and it decides the button, with one extra
 * refusal: it ignores a withdrawal already open, which holds the money in
 * `requested`, and a reward released since then would offer a button that can only
 * answer `409 EARNINGS_PAYOUT_ALREADY_PENDING`.
 *
 * `noBalance` comes before `frozen`: the server calls anyone not active "frozen",
 * rejected applicants included, and that is no way to describe an empty balance.
 */
export type WithdrawBlock = 'frozen' | 'open' | 'noDestination' | 'owes' | 'noBalance' | 'belowMinimum';

export function withdrawBlock(partner: ReferralPartner): WithdrawBlock | null {
  const { balances, program } = partner;
  if (balances.requested > 0) return 'open';
  if (partner.canWithdraw) return null;
  if (balances.clawback > 0) return 'owes';
  if (balances.available <= 0) return 'noBalance';
  if (partner.balanceFrozen) return 'frozen';
  if (balances.available < program.minPayoutAmount) return 'belowMinimum';
  return partner.payoutDestination.method ? null : 'noDestination';
}
