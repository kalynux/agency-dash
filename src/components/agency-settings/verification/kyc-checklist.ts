// ─── What the reviewers check ─────────────────────────────────────────────────
//
// ⚠ **Nothing is required by the API, and that is deliberate.** Every field on
// every `/api/agency/kyc` route is optional and `POST /submit` accepts an empty
// record. The required/optional rules are a REVIEW POLICY that lives in the
// administration dashboard, which uses them to show a reviewer an estimated
// verdict and a pre-filled rejection reason.
//
// A backend that refused an incomplete submission would also take away the only
// useful outcome of a review: a human telling the agency what is missing. So the
// "you still need X" guidance is ours, it is guidance only, and the agency may
// submit anyway — they will be rejected with a reason and can resubmit.
//
// This table is that policy, transcribed from
// api-doc/agency/identity-verification.md § What the administrator checks.

import type { KycRecord } from '@/types/kyc.types';

export type KycChecklistKey =
  | 'depotAddress'
  | 'homeAddress'
  | 'idCard'
  | 'idNumber'
  | 'selfie'
  | 'homeSketch'
  | 'storeSketch';

/** Why a conditional row is (or is not) being asked for, so the UI can say so. */
export type KycChecklistCondition = 'noDepot' | 'hasDepot';

export interface KycChecklistItem {
  key: KycChecklistKey;
  /** Whether the reviewers require this of THIS agency. */
  required: boolean;
  /** Whether the record satisfies it today. */
  met: boolean;
  /** Set on the three rows whose necessity depends on having a depot. */
  condition?: KycChecklistCondition;
  /**
   * Edited somewhere other than this tab. The magazin/depot addresses live on
   * Account → Locations; the checklist can only report them.
   */
  editedElsewhere?: boolean;
}

export interface KycChecklistInput {
  record: KycRecord;
  /**
   * Does the agency have a physical store/magazin at all? `null` while the
   * magazin has not resolved.
   *
   * An agency legitimately has none — it may work only for vendors who each
   * have their own premises. That is what makes the home address CONDITIONAL
   * rather than simply optional: with no depot to inspect, the reviewer needs to
   * know where the person running the business actually is.
   *
   * ⚠ **There is no safe default for `null`.** Assuming a depot tells an agency
   * without one that its home address is optional; assuming none tells an agency
   * with one that a depot sketch is unnecessary. Both are wrong in the same
   * direction — they talk someone out of sending something a reviewer will then
   * reject them for. So unknown asks for BOTH sides and states no reason, which
   * over-asks and never misleads.
   */
  hasDepot: boolean | null;
  /**
   * Every depot the agency does have carries a geocoded `geo`. Optional in the
   * reviewers' eyes, but a legacy depot saved before `geo` existed has no pin
   * for them to look at, and there is nothing this tab can do about it.
   */
  depotsGeocoded: boolean;
}

/**
 * The checklist for one agency, in the order it is presented. Rows the reviewers
 * will not ask this agency for are still returned (with `required: false`) so
 * the UI can show why a slot is there and not being demanded — dropping them
 * would make an optional slot look like an oversight.
 */
export function buildKycChecklist({
  record,
  hasDepot,
  depotsGeocoded,
}: KycChecklistInput): KycChecklistItem[] {
  const { documents, idNumber, homeAddress } = record;

  return [
    {
      key: 'depotAddress',
      required: false,
      met: hasDepot === true && depotsGeocoded,
      editedElsewhere: true,
    },
    {
      key: 'idCard',
      required: true,
      // Front AND back — one scan of a two-sided card is half a document.
      met: !!documents.idCardFront && !!documents.idCardBack,
    },
    { key: 'idNumber', required: true, met: !!idNumber?.trim() },
    { key: 'selfie', required: true, met: !!documents.selfieWithId },
    {
      key: 'homeAddress',
      required: hasDepot !== true,
      // `geocoded` is the administrator's badge for "this address is valid", so
      // a stored address that somehow lacks it does not satisfy the check.
      met: !!homeAddress?.geocoded,
      condition: conditionWhenKnown(hasDepot, 'noDepot'),
    },
    {
      key: 'homeSketch',
      required: hasDepot !== true,
      met: documents.homeAddressSketches.length > 0,
      condition: conditionWhenKnown(hasDepot, 'noDepot'),
    },
    {
      key: 'storeSketch',
      required: hasDepot !== false,
      met: documents.storeAddressSketches.length > 0,
      condition: conditionWhenKnown(hasDepot, 'hasDepot'),
    },
  ];
}

/**
 * The reason line, but only once there is one to give. While `hasDepot` is
 * unknown the row is still asked for — it just does not claim to know why.
 */
function conditionWhenKnown(
  hasDepot: boolean | null,
  condition: KycChecklistCondition,
): KycChecklistCondition | undefined {
  return hasDepot === null ? undefined : condition;
}

/** The required rows this agency has not satisfied yet. */
export function outstandingRequirements(items: KycChecklistItem[]): KycChecklistItem[] {
  return items.filter((item) => item.required && !item.met);
}
