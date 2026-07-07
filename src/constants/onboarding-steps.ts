// ─── Delivery Agency Onboarding Steps ────────────────────────────────────────

export const AgencyOnboardingStep = {
    /** Onboarding fully completed. Frontend routes to agency dashboard. */
    COMPLETED: 0,
    /**
     * Step 1 (Required): coverage_areas (min 1 region),
     * headquarters_addresses (min 1 entry; first entry is primary)
     */
    LOGISTICS_SETUP: 1,
    /** Step 2 (Required): payout_details */
    PAYOUT_SETUP: 2,
    /** Step 3 (Optional/Skippable): logo_url, timezone */
    BRANDING: 3,
} as const;

export type AgencyOnboardingStepValue =
    (typeof AgencyOnboardingStep)[keyof typeof AgencyOnboardingStep];
