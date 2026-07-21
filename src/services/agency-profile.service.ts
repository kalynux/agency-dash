import { api } from './api';
import type {
  AgencyProfileResponse,
  UpdateAgencyProfilePayload,
  AgencyCompletionStatusResponse,
  PolicyDocumentsUploadResponse,
} from '@/types/agency-profile.types';

/**
 * Post-onboarding agency profile management. `PATCH /api/agency/profile` is the
 * ONLY way to edit fields captured during onboarding once complete — the
 * onboarding step endpoints are locked (409) after `onboardingStep === 0`.
 * Object/array fields are a FULL REPLACE — always send the complete value.
 */
export const agencyProfileService = {
  /** GET /agency/profile — the authenticated agency's profile (camelCase). */
  getProfile(): Promise<AgencyProfileResponse> {
    return api.get<AgencyProfileResponse>('/agency/profile');
  },

  /** PATCH /agency/profile — partial update (arrays/objects are full-replace). */
  updateProfile(payload: UpdateAgencyProfilePayload): Promise<AgencyProfileResponse> {
    return api.patch<AgencyProfileResponse>('/agency/profile', payload);
  },

  /** GET /agency/profile/completion-status — minimal onboarding-completion summary. */
  getCompletionStatus(): Promise<AgencyCompletionStatusResponse> {
    return api.get<AgencyCompletionStatusResponse>('/agency/profile/completion-status');
  },

  /**
   * POST /agency/profile/policy-documents — upload 1–2 PDFs (≤5MB each) and get
   * back their URLs, which you then include in policies.documents.
   */
  uploadPolicyDocuments(files: File[]): Promise<PolicyDocumentsUploadResponse> {
    const form = new FormData();
    files.forEach((f) => form.append('documents', f));
    return api.postForm<PolicyDocumentsUploadResponse>('/agency/profile/policy-documents', form);
  },
};
