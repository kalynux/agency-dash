// Agency profile — see api-doc/agency/profile.md, profile-schema.md
// Responses are camelCase; the PATCH body (UpdateAgencyProfilePayload) is snake_case
// and maps 1:1 to UpdateAgencyProfileSchema. Arrays/objects are FULL REPLACE.

import type {
  AgencyPolicies,
  HeadquartersAddress,
  PayoutMethod,
} from '@/types/api';
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
  country: string | null;
  coverageAreas: string[];
  headquartersAddresses: HeadquartersAddress[];
  payoutDetails: AgencyPayoutMethodResponse[];
  kycVerified: boolean;
  kycDetails?: { registration_number: string | null; transport_license_id: string | null };
  policies: AgencyPolicies | null;
  wa: { verified: boolean; name?: string } | null;
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
  coverage_areas?: string[];
  headquarters_addresses?: HeadquartersAddress[];
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
