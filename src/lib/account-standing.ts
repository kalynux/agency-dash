// Two questions that used to be one — resolved in one place so no screen has to
// remember which field answers which.
//
// ─── The change, 2026-09-15 ───────────────────────────────────────────────────
//
//   role_entity.status        "may this account operate?"   — the agency answers
//   kyc_details.status        "has a human vetted it?"      — an administrator
//
// Until that date an agency became `active` only when an administrator approved
// it, so `status === 'active'` silently *meant* "approved". It no longer does:
// the agency activates itself by proving a phone number. Anything that read
// approval out of `status` is now wrong, and the fix is always the same — ask
// {@link AccountStanding.kycVerified} instead.
//
// ⛔ **Never derive verified-ness as `verdict !== 'rejected'`.** `pending` is the
// schema default, so it also means "never reviewed", which on this platform is
// most accounts. Only `verified` is verified.
//
// ─── What being unverified actually costs ─────────────────────────────────────
//
// Cash, and only cash:
//
//   * **COD is refused.** `CodEligibilityService` requires
//     `kyc_details.legit_verified` at checkout, so an unverified agency's
//     `policies.cod.enabled` toggle has no effect — orders simply never arrive
//     as COD. Worth saying on the toggle; silently ignoring it is worse.
//   * **Payouts can be capped.** See `payoutAllowance` in `earnings.types.ts`.
//
// Everything else stays open on purpose — the platform's position is that
// working with an unverified counterparty is the vendor's or agency's own
// judgement, not a platform refusal. So this must never be rendered as
// "your account is blocked".
//
// See api-doc/auth/README.md § Account activation.

import type { AgencyKycVerdict, AgencyRoleEntity } from '@/types/api';

export interface AccountStanding {
  /**
   * May this account operate? Earned by proving a phone number — see
   * {@link AccountStanding.phoneVerified}, which is the remedy when this is
   * `false`.
   *
   * ⛔ Not a trust signal. Read {@link AccountStanding.kycVerified} for that.
   */
  activated: boolean;
  /**
   * `true` while the account is still `pending_verification` — i.e. the holder
   * has something left to do, and the app should say so plainly.
   *
   * Deliberately NOT `!activated`: an `inactive` or `suspended` account is also
   * not activated, and proving a phone number will not help it. Those are an
   * administrator's decision and the self-service copy would be a lie.
   */
  awaitingActivation: boolean;
  /** The one thing standing between `pending_verification` and `active`. */
  phoneVerified: boolean;
  /**
   * Has an administrator vetted this business? The **only** honest source for a
   * trust badge, a verified marker, or the copy explaining a payout cap.
   */
  kycVerified: boolean;
  /**
   * The verdict in the agency's own vocabulary, for rendering. Branch on
   * {@link AccountStanding.kycVerified}; render this.
   *
   * ⚠ This is the account-level verdict off the session. The Verification tab
   * reads the richer `/api/agency/kyc` record, where `submittedAt` separates
   * "never touched" from "under review" — a distinction this field cannot make
   * (see `kycPhase()` in `services/kyc.service.ts`).
   */
  kycVerdict: AgencyKycVerdict;
  /** Why the reviewers refused, when they did. */
  kycRejectionReason: string | null;
}

/**
 * Resolve both questions off a session's `role_entity`.
 *
 * A null entity (no session yet) reads as *not activated, not verified* — the
 * conservative answer in both directions: it never claims an unverified agency
 * is vetted, and its "finish activating" copy is behind a null check anyway.
 */
export function readAccountStanding(
  entity: AgencyRoleEntity | null | undefined,
): AccountStanding {
  const status = entity?.status ?? null;
  const kyc = entity?.kyc_details;

  // `legit_verified` and `status` are written together by the backend, so either
  // one answers; both are read because a session minted before 2026-09-15
  // carries only the boolean.
  const kycVerified = kyc?.legit_verified === true || kyc?.status === 'verified';

  return {
    activated: status === 'active',
    awaitingActivation: status === 'pending_verification',
    phoneVerified: entity?.phone_verified === true,
    kycVerified,
    kycVerdict: kycVerified ? 'verified' : (kyc?.status ?? 'pending'),
    kycRejectionReason: kyc?.rejection_reason ?? null,
  };
}
