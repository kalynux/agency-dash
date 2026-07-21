// Agency profile — see api-doc/agency/profile.md, profile-schema.md
// Responses are camelCase; the PATCH body (UpdateAgencyProfilePayload) is snake_case
// and maps 1:1 to UpdateAgencyProfileSchema. Arrays/objects are FULL REPLACE.

import type {
  AgencyPolicies,
  HeadquartersAddress,
  PayoutMethod,
} from '@/types/api';

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
  agencyName: string;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  logoUrl: string | null;
  timezone: string;
  preferredLanguage: string;
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
  agency_name?: string;
  logo_url?: string | null;
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
