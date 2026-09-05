import { api } from './api';
import type {
    LogisticsPayload,
    PayoutPayload,
    BrandingPayload,
    PoliciesPayload,
    OnboardingStepResponse,
    OnboardingStatusResponse,
} from '@/types/api';

export const onboardingService = {
    /**
     * GET /api/agency/onboarding/status
     *
     * Returns a detailed breakdown of the current onboarding state.
     * Used for UX enrichment (missing fields, warnings) inside step forms.
     * NOT used for routing — routing is driven exclusively by
     * auth-me/agency → role_entity.onboarding_step.
     */
    getStatus(): Promise<OnboardingStatusResponse> {
        return api.get<OnboardingStatusResponse>('/agency/onboarding/status');
    },

    /**
     * PUT /api/agency/onboarding/logistics
     *
     * Step 1 (Required): Submits coverage_areas and headquarters_addresses.
     * Optionally pass `version` from role_entity for optimistic concurrency.
     */
    submitLogistics(payload: LogisticsPayload): Promise<OnboardingStepResponse> {
        return api.put<OnboardingStepResponse>('/agency/onboarding/logistics', payload);
    },

    /**
     * PUT /api/agency/onboarding/payout
     *
     * Step 2 (Required): Submits payout_details as an ordered array.
     * The first entry is the preferred/default method (min 1, max 2, no duplicates).
     */
    submitPayout(payload: PayoutPayload): Promise<OnboardingStepResponse> {
        return api.put<OnboardingStepResponse>('/agency/onboarding/payout', payload);
    },

    /**
     * PUT /api/agency/onboarding/branding
     *
     * Step 3 (Optional): Submits logo_file_id (from POST /api/files/upload) and timezone.
     * Send `{ skip: true }` to skip this step and complete onboarding immediately.
     */
    submitBranding(payload: BrandingPayload): Promise<OnboardingStepResponse> {
        return api.put<OnboardingStepResponse>('/agency/onboarding/branding', payload);
    },

    /**
     * PUT /api/agency/onboarding/policies
     *
     * Step 4 (Required): Submits pricing, returns, and damage policies.
     */
    submitPolicies(payload: PoliciesPayload): Promise<OnboardingStepResponse> {
        return api.put<OnboardingStepResponse>('/agency/onboarding/policies', payload);
    },
};
