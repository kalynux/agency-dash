import type { GeoAddress, GeoPoint } from '@/types/geo.types';

// ─── API User ────────────────────────────────────────────────────────────────

export interface ApiUser {
  _id: string;
  login_phone: string;
  login_email?: string;
  roles: string[];
  status: 'active' | 'suspended' | 'pending_verification';
}

// ─── Payout Details (ordered array — first entry = preferred method) ──────────

/**
 * Payout secrets are **write-mostly**: what a read returns is a mask, not the
 * stored value, so a saved entry can never be edited by round-tripping it —
 * the raw field has to be re-collected. See api-doc/agency/payout-methods.md
 * ("Reading it back"). That is why each secret is a *pair* of optional fields
 * rather than one required one.
 */
export interface MobileMoneyDetails {
  provider: string;
  /** E.164. Sent, never returned. */
  phone_number?: string;
  /** Returned, never sent — e.g. "••••0000". */
  phone_number_masked?: string;
  account_name: string;
}

export interface BankDetails {
  bank_name: string;
  /** Sent, never returned. */
  account_number?: string;
  /** Returned, never sent. */
  account_number_masked?: string;
  account_name: string;
  /** Full country name, e.g. "Cameroon" */
  country: string;
}

/** The networks the API accepts, lowercased. Anything else is a 400. */
export type CardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'unionpay'
  | 'jcb'
  | 'diners'
  | 'verve'
  | 'other';

/**
 * A card payout destination. There is no `number` and no `cvv` — not optional,
 * ABSENT: the API refuses `number`/`card_number`/`pan`/`account_number`/`cvv`/
 * `cvc`/`cvn`/`security_code` with a 400 rather than dropping them, so a 200 can
 * never be misread as "the number is on file". Nothing here is masked on read,
 * because nothing sensitive was ever stored.
 */
export interface CardDetails {
  brand: CardBrand;
  /** Exactly 4 digits — taken client-side, the only part of the number that exists. */
  last4: string;
  /** Rendered from `last4` by the server; response-only. */
  number_masked?: string;
  card_holder_name: string;
  /** 1–12. */
  expiry_month: number;
  /** 4-digit. The card must not already be past its last valid day. */
  expiry_year: number;
  country: string;
  issuing_bank?: string | null;
  /** Sent, never returned — the gateway that produced `gateway_token`. */
  gateway_provider?: string | null;
  /** Sent, never returned. The handle an automated push-to-card transfer will use. */
  gateway_token?: string | null;
}

export type PayoutMethod =
  | { method: 'mobile_money'; mobile_money: MobileMoneyDetails; bank?: null; card?: null; is_preferred?: boolean }
  | { method: 'bank'; bank: BankDetails; mobile_money?: null; card?: null; is_preferred?: boolean }
  | { method: 'card'; card: CardDetails; mobile_money?: null; bank?: null; is_preferred?: boolean };

/**
 * Ordered array — index 0 is the preferred/default payout method. 1–3 entries,
 * any mix of kinds including duplicates. A write REPLACES the list wholesale;
 * there is no per-entry endpoint. `is_preferred` is read-only — never sent.
 */
export type PayoutDetails = PayoutMethod[];

// ─── Support Contact & HQ Addresses ──────────────────────────────────────────

export interface SupportContact {
  phone: string;
  email?: string | null;
}

// GeoJSON Point — coordinates are [longitude, latitude]. Canonical definition
// lives in geo.types.ts; re-exported here for existing consumers.
export type { GeoPoint } from '@/types/geo.types';

/**
 * An agency headquarters / pickup location as RETURNED by the API. Lives on the
 * MAGAZIN, not the profile — see magazin.types.ts and api-doc/agency/magazin.md.
 *
 * `label`, `region` and `city` are all nullable on read: `label` is `null` on
 * entries saved before labels existed, and `region`/`city` are `null` whenever
 * the entry's geocode named neither (common for rural / landmark results). Fall
 * back to "Primary Headquarters" / "Branch N" and `geo.formatted_address`.
 */
export interface HeadquartersAddress {
  /** The agency's own name for this location, e.g. "Douala HQ". 1–50 chars. */
  label: string | null;
  /** Derived from `geo.components.region` on write. */
  region: string | null;
  /** Derived from `geo.components.city` on write. */
  city: string | null;
  address_description: string;
  support_contact: SupportContact;
  /** Derived from `geo` on write; kept for map/proximity use. */
  location?: GeoPoint;
  /** The canonical geospatial address. Required on new/edited entries. */
  geo?: GeoAddress | null;
  /** Assigned by the backend on response. */
  _id?: string;
}

/**
 * An HQ / pickup location as SENT (onboarding step 1, magazin PATCH).
 *
 * `geo` is the whole placement: `location`, `region` and `city` are all derived
 * from it server-side, so none of them are sent. Every NEW or EDITED entry must
 * carry one, resolving inside the agency's `country`, else the write fails with
 * `400 ADDRESS_GEO_REQUIRED` / `400 ADDRESS_COUNTRY_MISMATCH`. "Edited" means a
 * changed `address_description` or a changed geocoded place — renaming a `label`
 * is not a move, so legacy `geo`-less entries survive a re-save.
 */
export interface HeadquartersAddressInput {
  /** Required on every entry written — the one field the map result can't supply. */
  label: string;
  address_description: string;
  support_contact: SupportContact;
  geo?: GeoAddress | null;
  /** Fallback only, for a place whose geocode names no region. `geo` wins when it has one. */
  region?: string | null;
  /** Fallback only, for a place whose geocode names no city. `geo` wins when it has one. */
  city?: string | null;
}

// ─── KYC Details ─────────────────────────────────────────────────────────────

export interface AgencyKycDetails {
  registration_number: string | null;
  transport_license_id: string | null;
  /** Received from backend, not sent by frontend */
  legit_verified?: boolean;
}

// ─── Agency Policies ──────────────────────────────────────────────────────────

export interface StorageBasedPricing {
  /** Whether this model is currently active. At least one model must be enabled. */
  enabled: boolean;
  monthly_storage_fee_per_sku: number;
  pick_pack_fee_per_order: number;
  local_delivery_fee: number;
  out_of_region_delivery_fee: number;
}

export interface PickupBasedPricing {
  /** Whether this model is currently active. At least one model must be enabled. */
  enabled: boolean;
  base_rate_first_kg: number;
  additional_per_kg: number;
  out_of_region_surcharge: number;
}

export interface CodHandlingFee {
  type: 'percentage' | 'fixed';
  value: number;
}

export interface AdditionalFees {
  cod_handling_fee: CodHandlingFee;
  failed_delivery_fee: number;
  rto_fee: number;
  peak_season_surcharge?: number;
}

export interface AgencyPricingPolicy {
  storage_based: StorageBasedPricing;
  pickup_based: PickupBasedPricing;
  additional_fees: AdditionalFees;
  notes?: string | null;
}

export interface AgencyReturnsPolicy {
  payer: 'vendor' | 'agency' | 'customer';
  handling_fee: number;
  return_window_days: number;
  notes?: string | null;
}

export interface AgencyDamagePolicy {
  claim_deadline_days: number;
  max_refund_per_item: number;
  /** Admin-controlled preset. Present in response, never sent by frontend. */
  inspector?: 'agency' | 'vendor' | 'third_party';
  /** Admin-controlled preset. Present in response, never sent by frontend. */
  investigation_fee?: number;
  notes?: string | null;
}

export interface AgencyCodPolicy {
  /** Whether this agency handles cash-on-delivery orders at all. Defaults to false (opt-in). */
  enabled: boolean;
  /** Cap on a single COD order's total, minor units. null = no per-order cap. */
  max_order_amount: number | null;
}

export interface AgencyPolicies {
  pricing: AgencyPricingPolicy;
  returns: AgencyReturnsPolicy;
  damage: AgencyDamagePolicy;
  /** COD eligibility gate — separate from pricing.additional_fees.cod_handling_fee, which is just the per-collection fee. */
  cod: AgencyCodPolicy;
  /** Up to 2 supporting document URLs (PDF addenda). Full-replace on submit. */
  documents?: string[];
}

// ─── Agency Role Entity ───────────────────────────────────────────────────────

export interface AgencyRoleEntity {
  _id: string;
  user_id: string;
  agency_name: string;
  logo_url: string | null;
  timezone: string;
  email: string | null;
  phone: string | null;
  email_verified?: boolean;
  phone_verified?: boolean;
  /**
   * The agency's operating country (ISO-2). Set once during onboarding step 1
   * and immutable afterwards (`403 PROFILE_COUNTRY_IMMUTABLE`). Anchors both
   * coverage areas and HQ address geocoding.
   */
  country?: string | null;
  /**
   * @deprecated The MAGAZIN is the source of truth for the agency's logistics
   * footprint — read these from `GET /api/agency/magazin`, not from the session.
   * Kept optional only because it is unspecified whether `/auth/me` still
   * echoes them. Never seed a form from these.
   */
  coverage_areas?: string[];
  /** @deprecated See `coverage_areas` above — read from the magazin instead. */
  headquarters_addresses?: HeadquartersAddress[];
  /** Ordered array — index 0 is the preferred method */
  payout_details: PayoutDetails;
  kyc_details: AgencyKycDetails;
  policies: AgencyPolicies | null;
  /** Notification/UI language. One of en·fr·pt·es·ar (default en). */
  preferred_language?: 'en' | 'fr' | 'pt' | 'es' | 'ar';
  /**
   * 0 = onboarding complete (dashboard access granted)
   * 1 = Logistics Setup required
   * 2 = Payout Setup required
   * 3 = Branding (skippable)
   * 4 = Policy Setup required
   */
  onboarding_step: 0 | 1 | 2 | 3 | 4;
  status: string;
  /** Integer version counter — used for optimistic concurrency checks */
  version?: number;
}

// ─── Auth Responses ───────────────────────────────────────────────────────────

export interface AgencyAuthSession {
  user: ApiUser;
  role: 'agency';
  role_entity: AgencyRoleEntity;
}

export interface AuthMeAgencyResponse {
  success: boolean;
  data: AgencyAuthSession;
  meta?: Record<string, unknown>;
  message?: string;
}

// ─── Onboarding Step & Status ─────────────────────────────────────────────────

export type AgencyOnboardingStep = 0 | 1 | 2 | 3 | 4;

export interface CompletionStatus {
  onboardingStep: AgencyOnboardingStep;
  isComplete: boolean;
  missingFields: string[];
  stepLabel: string;
}

export interface OnboardingStepResponse {
  success: boolean;
  message?: string;
  data: {
    profile: AgencyRoleEntity;
    completionStatus: CompletionStatus;
  };
}

export interface OnboardingStatusStep {
  step: number;
  label: string;
  status: 'completed' | 'current' | 'pending';
  required: boolean;
}

export interface OnboardingStatusData {
  currentStep: AgencyOnboardingStep;
  currentStepLabel: string;
  isComplete: boolean;
  progressPercent: number;
  completedFields: string[];
  missingFields: string[];
  steps: OnboardingStatusStep[];
  warnings: string[];
}

export interface OnboardingStatusResponse {
  success: boolean;
  data: OnboardingStatusData;
}

// ─── Step Payloads ────────────────────────────────────────────────────────────

/**
 * PUT /api/agency/onboarding/logistics
 *
 * `country` lands on the profile; `coverage_areas` + `headquarters_addresses`
 * are routed to the MAGAZIN server-side and validated against that country.
 * Post-onboarding, edit them via `PATCH /api/agency/magazin` instead.
 */
export interface LogisticsPayload {
  /**
   * ISO-2 operating country, auto-uppercased server-side. Correctable while
   * onboarding is in progress, then locked (`403 PROFILE_COUNTRY_IMMUTABLE`).
   * All headquarters addresses must geocode inside it.
   */
  country: string;
  /** Region keys of `country` from locations.json, e.g. ["littoral", "centre"] */
  coverage_areas: string[];
  headquarters_addresses: HeadquartersAddressInput[];
  /** Integer version from role_entity.version — optional optimistic concurrency lock */
  version?: number;
}

/** PUT /api/agency/onboarding/payout */
export interface PayoutPayload {
  /** Ordered array — index 0 is the preferred method. 1–3 entries; duplicate method types are allowed. */
  payout_details: PayoutMethod[];
  version?: number;
}

/** PUT /api/agency/onboarding/branding (with data) */
export interface BrandingPayloadWithData {
  skip?: false;
  /** Id returned by POST /api/files/upload; `null` detaches the current logo. */
  logo_file_id?: string | null;
  timezone?: string;
}

/** PUT /api/agency/onboarding/branding (skip) */
export interface BrandingPayloadSkip {
  skip: true;
}

export type BrandingPayload = BrandingPayloadWithData | BrandingPayloadSkip;

/** PUT /api/agency/onboarding/policies */
export interface PoliciesPayload {
  policies: AgencyPolicies;
  version?: number;
}

// ─── Legacy union type (kept for router compatibility during transition) ───────
export type OnboardingStepPayload = LogisticsPayload | PayoutPayload | BrandingPayload | PoliciesPayload;

// ─── API Error ────────────────────────────────────────────────────────────────

/** One normalized field-level validation error. */
export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /**
   * Raw `error.details` payload. Its shape varies by error code:
   * - global `VALIDATION_ERROR`: `{ fields: [{ path, message, code }] }`
   * - agency onboarding/profile: `[{ field, message }]`
   * - domain errors: an arbitrary context object.
   * Use {@link fieldErrors} / {@link firstFieldError} to read validation failures.
   */
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /**
   * Normalizes both documented validation-error shapes into a flat
   * `{ fieldPath: message }` map for wiring into form fields.
   */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    const d = this.details as { fields?: unknown } | unknown[] | undefined;
    const arr: unknown[] | null = Array.isArray(d)
      ? d
      : d && typeof d === 'object' && Array.isArray((d as { fields?: unknown[] }).fields)
        ? (d as { fields: unknown[] }).fields
        : null;
    if (!arr) return out;
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as { field?: string; path?: string; message?: string };
      const key = entry.field ?? entry.path;
      if (key && entry.message) out[String(key)] = String(entry.message);
    }
    return out;
  }

  /** First field-level validation message, if any. */
  firstFieldError(): string | undefined {
    const values = Object.values(this.fieldErrors());
    return values.length > 0 ? values[0] : undefined;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isValidation() {
    return this.status === 400;
  }

  get isConflict() {
    return this.status === 409;
  }

  get isServer() {
    return this.status >= 500;
  }

  /** Returns true for concurrent modification (409 + specific error code). */
  get isConcurrentModification() {
    return this.status === 409 && this.code === 'DELIVERY_ONBOARDING_CONCURRENT_MODIFICATION';
  }

  /** Returns true for already-completed onboarding (409 + specific error code). */
  get isAlreadyCompleted() {
    return this.status === 409 && this.code === 'DELIVERY_ONBOARDING_ALREADY_COMPLETED';
  }
}
