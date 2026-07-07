# Implement Policy Setup (Step 4) for Delivery Agency Onboarding

This plan outlines the frontend changes required to integrate the new "Policy Setup" (Step 4) into the delivery agency onboarding flow, based on the updated `onboarding.md` and `profile-schema.md` API documents.

## User Review Required

> [!WARNING]
> Please review the structure of the Policy Form. Since it contains many fields (Pricing, Returns, Damage), the plan is to split the UI of `Step4Policies.tsx` into multiple logical sections (cards or accordions) to prevent overwhelming the user. (Yes, it should be made in section, but still in one step)

## Proposed Changes

### Types & Schemas

#### [MODIFY] [api.ts](file:///c:/Users/Fante/Desktop/projects/jovi-mall-front/agency-dash/src/types/api.ts)
- Update `AgencyOnboardingStep` type to `0 | 1 | 2 | 3 | 4`.
- Define new interfaces: `StorageBasedPricing`, `PickupBasedPricing`, `AdditionalFees`, `AgencyPricingPolicy`, `AgencyReturnsPolicy`, `AgencyDamagePolicy`, and `AgencyPolicies`.
- Add `policies: AgencyPolicies | null` to `AgencyRoleEntity`.
- Add `PoliciesPayload` interface for the `PUT` request.
- Update `OnboardingStepPayload` to include `PoliciesPayload`.

#### [MODIFY] [onboarding.schemas.ts](file:///c:/Users/Fante/Desktop/projects/jovi-mall-front/agency-dash/src/onboarding/schemas/onboarding.schemas.ts)
- Add Zod schemas for the policies payload:
  - `pricingSchema`: storage-based, pickup-based, additional fees, notes.
  - `returnsSchema`: payer, handling fee, return window, free returns, notes.
  - `damageSchema`: claim deadline, max refund, notes.
  - `policiesSchema`: wrapping the above three.
- Export `PoliciesFormValues` type.

---

### Service & State Management

#### [MODIFY] [onboarding.service.ts](file:///c:/Users/Fante/Desktop/projects/jovi-mall-front/agency-dash/src/services/onboarding.service.ts)
- Add `submitPolicies(payload: PoliciesPayload): Promise<OnboardingStepResponse>` which calls `PUT /api/agency/onboarding/policies`.

#### [MODIFY] [onboarding.store.tsx](file:///c:/Users/Fante/Desktop/projects/jovi-mall-front/agency-dash/src/onboarding/store/onboarding.store.tsx)
- Update `stepToRoute` to map step `4` to `/onboarding/policies`.
- Add `policies` draft state to `StepDrafts`.
- Update `saveDraft` signature and implementation to handle step `4`.
- Add `submitPolicies` action utilizing `wrapStep` with step `4`.

---

### Routing & Layout

#### [MODIFY] [OnboardingLayout.tsx](file:///c:/Users/Fante/Desktop/projects/jovi-mall-front/agency-dash/src/onboarding/OnboardingLayout.tsx)
- Update the `STEPS` array to include: `{ step: 4, label: 'Policies' }`.
- Ensure the horizontal progress stepper can handle 4 steps seamlessly.

#### [MODIFY] [OnboardingRouter.tsx](file:///c:/Users/Fante/Desktop/projects/jovi-mall-front/agency-dash/src/onboarding/OnboardingRouter.tsx)
- Add route `<Route path="policies" element={<StepGuard minRequired={4}><Step4Policies /></StepGuard>} />`.
- Update `StepGuard`'s `minRequired` type to `1 | 2 | 3 | 4`.
- Update `stepPath` helper for step `4`.

---

### UI Components

#### [NEW] [Step4Policies.tsx](file:///c:/Users/Fante/Desktop/projects/jovi-mall-front/agency-dash/src/onboarding/steps/Step4Policies.tsx)
- Implement the "Policy Setup" form using `react-hook-form` and `@hookform/resolvers/zod`.
- **Pricing Section**: Inputs for storage fees, pickup rates, and additional fees (COD, RTO, failed delivery).
- **Returns Section**: Select for payer (`vendor`, `agency`, `customer`), and number inputs for handling fee and window days. Switch/Checkbox for free returns.
- **Damage Section**: Number inputs for claim deadline and max refund.
- Include "Submit" button and "Back" navigation.
- Implement draft saving (`saveDraft(4, values)`) on unmount/navigation.
- Pre-populate from `drafts.policies` or `session.role_entity.policies`.

## Verification Plan

### Automated Tests
- Type checking (`tsc --noEmit`) to ensure `AgencyOnboardingStep` and payload interfaces are completely satisfied.
- Linter checks.

### Manual Verification
- Start onboarding process and navigate up to step 4.
- Verify the stepper UI shows 4 steps and highlights correctly.
- Ensure back-navigation from step 4 to step 3/2 works, preserving drafts.
- Submit valid policy data and confirm transition to dashboard (`currentStep === 0`).
- Test validation logic directly on the UI (e.g., leaving a required field empty in Step 4).
