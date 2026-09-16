// Agency identity verification (KYC) — see api-doc/agency/identity-verification.md
//
// Base path `/api/agency/kyc`. There is NO agency id in any path: every route is
// scoped to the calling agency's own record, by design — the payload is a
// photograph of a person holding their identity card.
//
// This is a different thing from the two numbers on the agency *profile*
// (`kyc_details.registration_number` / `transport_license_id`, see
// agency-profile.types.ts). Those are about the COMPANY and they stay where they
// are; `idNumber` here is the PERSON's national identity number, and it is the
// field the ID scans corroborate.
//
// Verification is NOT an onboarding step — it can be submitted at any time, and
// nothing here blocks an agency that never does.
//
// ⚠ **It does, since 2026-09-15, gate CASH.** An unverified agency cannot carry
// cash-on-delivery orders (`CodEligibilityService` reads
// `kyc_details.legit_verified` at checkout), and its payouts can be capped per
// rolling window (`payoutAllowance`, see earnings.types.ts). Nothing else is
// refused — working with an unverified counterparty is the other party's
// judgement to make. `lib/account-standing.ts` is where that distinction lives.
//
// ⚠ This record's `status` is NOT the agency account's `status`. The account
// activates itself on a proved phone and `active` no longer implies anyone
// approved the business; this is the approval. Two questions, two fields.

import type { GeoAddress } from '@/types/geo.types';
import type { FileAccess } from '@/types/file.types';

/**
 * The reviewers' verdict.
 *
 * ⚠ **`pending` does not mean "waiting for review".** It is the schema default,
 * so it also means *"never touched"*. `submittedAt` is what tells the two apart
 * — see {@link kycPhase}, which is what UI should branch on.
 *
 * This is also a different field from the agency account's own `status`
 * (`pending_verification` / `active` / `inactive`): a rejection here does not
 * move the account status, deliberately.
 */
export type KycStatus = 'pending' | 'verified' | 'rejected';

/**
 * The five document slots `POST /agency/kyc/documents/:slot` accepts. Anything
 * else answers `400 KYC_SLOT_UNKNOWN` with `details.allowed` listing these —
 * a refusal rather than a silent no-op, because a write that reports success
 * having stored nothing is the hardest kind of bug to see from a client.
 *
 * `vehicle_with_agent` exists on the shared KYC subject but is an AGENT slot;
 * an agency has no vehicle to photograph and must not offer it.
 */
export type KycDocumentSlot =
  | 'id_card_front'
  | 'id_card_back'
  | 'selfie_with_id'
  | 'home_address_sketch'
  | 'store_address_sketch';

/**
 * One stored document.
 *
 * Deliberately NOT `FileRef`: that type requires `key` and `originalName`, and
 * this payload omits both on some entries (see the sample in
 * api-doc/agency/identity-verification.md § GET). Reusing `FileRef` would let a
 * caller write `doc.originalName.toUpperCase()` against a value the backend
 * never promised.
 *
 * ⚠ **`url` is always `null` here** — the whole module lives in a private
 * storage tree (`kyc: 'private'`). That is the correct, expected answer, not a
 * broken file: fetch `GET /agency/kyc/documents/:fileId/content` and render the
 * blob. An identity card at a public URL is fetchable forever by anyone who
 * ever sees the link, which is exactly what `null` exists to prevent.
 */
export interface KycDocumentRef {
  id: string;
  /** Storage key. Absent on some entries — never build a URL from it. */
  key?: string;
  /** Always `null` in this module. Typed so `<img src={doc.url}>` cannot compile. */
  url: null;
  /**
   * `authorized` for every file here — except `quota_blocked`, which is a
   * BILLING state (over the plan's storage cap), not a privacy one. The content
   * route will not help on that one; render it as "over your storage limit",
   * not as a missing file.
   */
  access?: FileAccess;
  mimeType: string;
  size: number;
  originalName?: string;
}

/**
 * Every slot, resolved. Single-value slots hold one file or `null`; the two
 * sketch slots hold an array that APPENDS on upload.
 */
export interface KycDocuments {
  idCardFront: KycDocumentRef | null;
  idCardBack: KycDocumentRef | null;
  selfieWithId: KycDocumentRef | null;
  /** Always `null` for an agency — an agent slot, carried by the shared shape. */
  vehicleWithAgent: null;
  homeAddressSketches: KycDocumentRef[];
  storeAddressSketches: KycDocumentRef[];
}

/**
 * The stored home address as it is READ BACK.
 *
 * ⚠ **This is not the shape you send.** A write takes a whole
 * `GET /api/geo/search` candidate ({@link GeoAddress}: snake_case,
 * `coordinates` as a GeoJSON `Point` object); the read answers camelCase with a
 * bare `[lng, lat]` pair plus `geocoded`. Converting one back into the other and
 * PATCHing it would send a hand-assembled address, which is exactly what
 * `geocoded: true` is supposed to rule out — see `homeAddressForDisplay`.
 */
export interface KycHomeAddress {
  label: string | null;
  formattedAddress: string;
  /** ⚠ `[longitude, latitude]` — GeoJSON order, not `[lat, lng]`. */
  coordinates: [number, number];
  provider: string;
  /**
   * The administrator's badge for "this address is valid". It is set by the
   * backend from a real geocoder result and can never be claimed by a client.
   */
  geocoded: boolean;
}

/** Server-declared ceilings, so a client cap can never drift from the backend's. */
export interface KycLimits {
  /** Files allowed IN a multi-value slot, counting what is already stored. */
  multiSlotMaxFiles: number;
}

/** The whole record. `GET /agency/kyc` answers a fully-formed empty one. */
export interface KycRecord {
  role: string;
  status: KycStatus;
  /** ISO-8601, or `null` when the record has never been submitted. */
  submittedAt: string | null;
  /**
   * The only field you need to decide whether to disable the form. `true` while
   * under review and permanently once verified; every write then answers
   * `409 KYC_LOCKED`.
   */
  locked: boolean;
  /** Why the reviewers refused. Cleared by a resubmission. */
  rejectionReason: string | null;
  verifiedAt: string | null;
  /** The PERSON's national identity number — not the company registration. */
  idNumber: string | null;
  homeAddress: KycHomeAddress | null;
  documents: KycDocuments;
  limits: KycLimits;
}

/** Standard envelope for every JSON route in this module. */
export interface KycRecordResponse {
  success: boolean;
  data: KycRecord;
  message?: string;
}

/**
 * `PATCH /agency/kyc` — the typed half. Both fields optional and both
 * **clearable**: send `""`/`null` to remove a value, omit the key to leave it.
 *
 * `idNumber` has **no format check** — Cameroonian ID formats have changed more
 * than once and a regex derived from today's cards would silently refuse a
 * valid older one. It is checked against the scans, by a person. Only the 64
 * character ceiling is enforced.
 */
export interface KycUpdatePayload {
  idNumber?: string | null;
  /**
   * A `GET /api/geo/search` candidate, unmodified, or `null` to clear.
   *
   * ⚠ Send what the geocoder returned. A hand-assembled object with made-up
   * coordinates passes the `geocoded` check and fails the human one.
   */
  homeAddress?: GeoAddress | null;
}

// ─── Error detail payloads ────────────────────────────────────────────────────

/** `409 KYC_LOCKED` — `details` says which of the two lock states you hit. */
export interface KycLockedDetails {
  status?: KycStatus;
  submittedAt?: string | null;
}

/** `422 KYC_SLOT_FULL` — the slot's ceiling, what is in it, and what you offered. */
export interface KycSlotFullDetails {
  max?: number;
  current?: number;
  offered?: number;
}

/** `400 KYC_SLOT_UNKNOWN` — the five names the backend will accept. */
export interface KycSlotUnknownDetails {
  allowed?: string[];
}
