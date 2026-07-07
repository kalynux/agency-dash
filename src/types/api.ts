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

export interface HeadquartersAddress {
  region: string;
  city: string;
  address_description: string;
  support_contact: SupportContact;
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

export interface AgencyPolicies {
  pricing: AgencyPricingPolicy;
  returns: AgencyReturnsPolicy;
  damage: AgencyDamagePolicy;
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
  /** Region keys from locations.json, e.g. ["littoral", "centre"] */
  coverage_areas: string[];
  headquarters_addresses: HeadquartersAddress[];
  /** Ordered array — index 0 is the preferred method */
  payout_details: PayoutDetails;
  kyc_details: AgencyKycDetails;
  policies: AgencyPolicies | null;
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

export interface AuthMeAgencyResponse {
  user: ApiUser;
  role: 'agency';
  role_entity: AgencyRoleEntity;
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

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string[]>;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, string[]>,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
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
