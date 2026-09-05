// Agency profile — see api-doc/agency/profile.md, profile-schema.md
// Responses are camelCase; the PATCH body (UpdateAgencyProfilePayload) is snake_case
// and maps 1:1 to UpdateAgencyProfileSchema. Arrays/objects are FULL REPLACE.

import type { AgencyPolicies, PayoutMethod } from '@/types/api';
import type { FileRef } from '@/types/file.types';

export interface AgencyPayoutMobileMoneyResponse {
  provider: string;
  phone_number_masked?: string;
  account_name: string;
}

export interface AgencyPayoutBankResponse {
  bank_name: string;
  account_number_masked?: string;
  account_name: string;
  country: string;
}

export interface AgencyPayoutMethodResponse {
  method: 'mobile_money' | 'bank';
  is_preferred?: boolean;
  mobile_money: AgencyPayoutMobileMoneyResponse | null;
  bank: AgencyPayoutBankResponse | null;
}

export interface DeliveryAgencyProfile {
  id: string;
  /**
   * The agency's PERSONAL / contact display name. The BUSINESS name lives on the
   * magazin (see magazin.types.ts), not here.
   */
  displayName: string;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  /**
   * The agency's PERSONAL profile avatar (resolved file object, or `null`) —
   * distinct from the business logo, which lives on the magazin. Set via
   * `avatarFileId`.
   */
  avatar: FileRef | null;
  timezone: string;
  preferredLanguage: string;
  /**
   * ISO-2 operating country. SET-ONCE during onboarding, then immutable
   * (`403 PROFILE_COUNTRY_IMMUTABLE`). Anchors the magazin's coverage areas and
   * HQ address geocoding.
   */
  country: string | null;
  payoutDetails: AgencyPayoutMethodResponse[];
  kycVerified: boolean;
  kycDetails?: { registration_number: string | null; transport_license_id: string | null };
  policies: AgencyPolicies | null;
  /**
   * @deprecated **Do not read this.** Connections moved off the profile on
   * 2026-08-19: they bind to the *User* rather than to a role, so one person who
   * is both an agency and a customer connects once and it holds everywhere.
   * `GET /api/me/connections` is the one source now — see
   * `connections.service.ts`.
   *
   * ⚠ Kept as an OPTIONAL field rather than deleted because the two backend
   * documents disagree: `connections/README.md` (authored 2026-08-24) states
   * plainly that `wa` was removed from `/api/agency/profile`, while
   * `agency/profile.md` and `profile-schema.md` — neither of which was
   * re-verified in that pass — still show `"wa": null` in their examples.
   * Optional tolerates both answers; nothing in this app reads it either way.
   */
  wa?: { verified: boolean; name?: string } | null;
  status: string;
  onboardingStep: number;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyProfileResponse {
  success: true;
  data: DeliveryAgencyProfile;
  message?: string;
}

export interface UpdateAgencyProfilePayload {
  /** Personal/contact display name (2–100). The business name is on the magazin. */
  displayName?: string;
  /** Id of a file uploaded via `POST /api/files/upload`, or `null`/`""` to clear the personal avatar. */
  avatarFileId?: string | null;
  timezone?: string;
  preferred_language?: 'en' | 'fr' | 'pt' | 'es' | 'ar';
  // NOTE: `coverage_areas` and `headquarters_addresses` are NOT accepted here —
  // they moved to the magazin (`PATCH /api/agency/magazin`). See magazin.types.ts.
  payout_details?: PayoutMethod[];
  kyc_details?: { registration_number?: string | null; transport_license_id?: string | null };
  policies?: AgencyPolicies;
}

export interface AgencyCompletionStatus {
  onboardingStep: number;
  isComplete: boolean;
  missingFields: string[];
  stepLabel: string;
}

export interface AgencyCompletionStatusResponse {
  success: true;
  data: AgencyCompletionStatus;
}

export interface PolicyDocumentsUploadResponse {
  success: true;
  data: { urls: string[] };
  message?: string;
}
