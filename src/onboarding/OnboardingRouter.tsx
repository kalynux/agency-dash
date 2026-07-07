import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { Step1Logistics } from './steps/Step1Logistics';
import { Step2Payout } from './steps/Step2Payout';
import { Step3Branding } from './steps/Step3Branding';
import { Step4Policies } from './steps/Step4Policies';

function UnknownStepFallback({ step }: { step: number | null }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="text-4xl mb-4">🤷</div>
            <h2 className="text-xl font-semibold mb-2">Unexpected onboarding state</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
                The server returned an unrecognised onboarding step ({step ?? 'none'}).
                Please contact support if this persists.
            </p>
        </div>
    );
}

/**
 * Nested router for /onboarding/*.
 *
 * Routing strategy (revised for back-navigation support):
 * - `currentStep` = the backend's "next required step" (the max the user must reach).
 * - `viewingStep` = the step the user is currently looking at (can be any step ≤ currentStep).
 * - StepGuard allows access to any step N where N ≤ currentStep, blocking only
 *   future steps (e.g. can't jump from step 1 to step 3).
 * - No useEffect-driven forced navigation; URL is authoritative for which step is rendered.
 *   The store's goBack() and wrapStep() handle programmatic navigation.
 */
export function OnboardingRouter() {
    const { currentStep } = useOnboarding();

    return (
        <Routes>
            <Route
                path="logistics"
                element={
                    <StepGuard minRequired={1}>
                        <Step1Logistics />
                    </StepGuard>
                }
            />
            <Route
                path="payout"
                element={
                    <StepGuard minRequired={2}>
                        <Step2Payout />
                    </StepGuard>
                }
            />
            <Route
                path="branding"
                element={
                    <StepGuard minRequired={3}>
                        <Step3Branding />
                    </StepGuard>
                }
            />
            <Route
                path="policies"
                element={
                    <StepGuard minRequired={4}>
                        <Step4Policies />
                    </StepGuard>
                }
            />

            {/* Index: send user to their current required step */}
            <Route
                index
                element={
                    currentStep === null ? null : currentStep === 0 ? (
                        <Navigate to="/dashboard" replace />
                    ) : (
                        <Navigate to={stepPath(currentStep)} replace />
                    )
                }
            />

            <Route path="unknown" element={<UnknownStepFallback step={currentStep} />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
    );
}

// ─── Step guard ───────────────────────────────────────────────────────────────
// Allows the user to visit any step they have already completed (step ≤ currentStep),
// but blocks forward skipping (step > currentStep).

function StepGuard({
    children,
    minRequired,
}: {
    children: React.ReactNode;
    minRequired: 1 | 2 | 3 | 4;
}) {
    const { currentStep } = useOnboarding();
    const location = useLocation();

    if (currentStep === null) return null;

    // Onboarding is complete — push to dashboard
    if (currentStep === 0) {
        return <Navigate to="/dashboard" replace />;
    }

    // User is trying to access a step they haven't unlocked yet → redirect to their current step
    if (minRequired > currentStep) {
        return <Navigate to={stepPath(currentStep)} replace state={{ from: location }} />;
    }

    return <>{children}</>;
}

function stepPath(step: number): string {
    switch (step) {
        case 1: return '/onboarding/logistics';
        case 2: return '/onboarding/payout';
        case 3: return '/onboarding/branding';
        case 4: return '/onboarding/policies';
        default: return '/onboarding/unknown';
    }
}
