// ─── API User ────────────────────────────────────────────────────────────────

export interface ApiUser {
  _id: string;
  login_phone: string;
  login_email?: string;
  roles: string[];
  status: 'active' | 'suspended' | 'pending_verification';
}

// ─── Payout Details (ordered array — first entry = preferred method) ──────────

export interface MobileMoneyDetails {
  provider: string;
  phone_number: string;
  account_name: string;
}

export interface BankDetails {
  bank_name: string;
  account_number: string;
  account_name: string;
  /** Full country name, e.g. "Cameroon" */
  country: string;
}

export type PayoutMethod =
  | { method: 'mobile_money'; mobile_money: MobileMoneyDetails; bank?: null; is_preferred?: boolean }
  | { method: 'bank'; bank: BankDetails; mobile_money?: null; is_preferred?: boolean };

/** Ordered array — index 0 is the preferred/default payout method. */
export type PayoutDetails = PayoutMethod[];

// ─── Support Contact & HQ Addresses ──────────────────────────────────────────

export interface SupportContact {
  phone: string;
  email?: string | null;
}

/** GeoJSON Point — coordinates are [longitude, latitude]. */
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface HeadquartersAddress {
  region: string;
  city: string;
  address_description: string;
  support_contact: SupportContact;
  /** Required going forward — placeable on a map for auto-assignment distance. */
  location?: GeoPoint;
  /** Assigned by the backend on response. */
  _id?: string;
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
  /** Region keys from locations.json, e.g. ["littoral", "centre"] */
  coverage_areas: string[];
  headquarters_addresses: HeadquartersAddress[];
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

/** PUT /api/agency/onboarding/logistics */
export interface LogisticsPayload {
  /** Region keys from locations.json, e.g. ["littoral", "centre"] */
  coverage_areas: string[];
  headquarters_addresses: HeadquartersAddress[];
  /** Integer version from role_entity.version — optional optimistic concurrency lock */
  version?: number;
}

/** PUT /api/agency/onboarding/payout */
export interface PayoutPayload {
  /** Ordered array — index 0 is the preferred method. Min 1, max 2 entries, no duplicate method types. */
  payout_details: PayoutMethod[];
  version?: number;
}

/** PUT /api/agency/onboarding/branding (with data) */
export interface BrandingPayloadWithData {
  skip?: false;
  logo_url?: string | null;
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
