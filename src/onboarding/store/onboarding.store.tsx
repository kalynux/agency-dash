import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useRef,
    type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { authStrategy } from '@/platform/auth/strategy';
import { onboardingService } from '@/services/onboarding.service';
import { agencyProfileService } from '@/services/agency-profile.service';
import { ApiError } from '@/types/api';
import type { UpdateAgencyProfilePayload } from '@/types/agency-profile.types';
import type {
    AgencyAuthSession,
    AgencyOnboardingStep,
    LogisticsPayload,
    PayoutPayload,
    BrandingPayload,
    PoliciesPayload,
    OnboardingStepResponse,
} from '@/types/api';
import type {
    LogisticsFormValues,
    PayoutFormValues,
    BrandingFormValues,
    PoliciesFormValues,
} from '@/onboarding/schemas/onboarding.schemas';

// ─── Draft cache ───────────────────────────────────────────────────────────────
// Raw form values for each step, saved synchronously BEFORE the API call.
// This is the reliable source of truth for pre-populating forms on back-navigation,
// since the backend's profile response uses camelCase while role_entity is snake_case.

interface StepDrafts {
    logistics: LogisticsFormValues | null;
    payout: PayoutFormValues | null;
    branding: BrandingFormValues | null;
    policies: PoliciesFormValues | null;
}

// ─── State shape ──────────────────────────────────────────────────────────────

export interface OnboardingState {
    session: AgencyAuthSession | null;
    isInitializing: boolean;
    isSubmitting: boolean;
    error: ApiError | null;
    /**
     * The highest step the backend reports as "next required".
     * 0 = complete, 1–3 = the next step to complete.
     * Used as the canonical "max allowed step" for the router guard.
     */
    currentStep: AgencyOnboardingStep | null;
    /**
     * The step the user is currently *viewing* (may be a previous completed step
     * when they navigate backwards using the Back button).
     */
    viewingStep: AgencyOnboardingStep | null;

    /**
     * Draft form values for each step.
     * Saved synchronously before each API call so forms can be pre-populated
     * when the user navigates back, regardless of the backend response shape.
     */
    drafts: StepDrafts;
    /**
     * Save raw form values for a given step BEFORE the API call.
     * Priority for pre-population: draft → session role_entity → empty defaults.
     */
    saveDraft(step: 1, values: LogisticsFormValues): void;
    saveDraft(step: 2, values: PayoutFormValues): void;
    saveDraft(step: 3, values: BrandingFormValues): void;
    saveDraft(step: 4, values: PoliciesFormValues): void;

    initialize: () => Promise<void>;
    /**
     * Install a session the app already has in hand, from a sign-in or a
     * registration response.
     *
     * Without this the login screen has no way to hand its result over:
     * `initialize()` latches after its first call, so navigating to a guarded
     * route post-login would find `session` still null, bounce back to `/login`,
     * and loop. Adopting the response also avoids spending an `auth-me` round
     * trip to be told what the login response just said.
     */
    adoptSession: (session: AgencyAuthSession) => void;
    /** Re-fetch the session (used after a post-onboarding profile edit). */
    refreshSession: () => Promise<void>;
    /**
     * Post-onboarding profile edit via PATCH /api/agency/profile. Use this from
     * Settings — the onboarding step endpoints are locked once onboarding is
     * complete. Refreshes the session on success.
     */
    updateAgencyProfile: (payload: UpdateAgencyProfilePayload) => Promise<void>;
    submitLogistics: (payload: LogisticsPayload) => Promise<void>;
    submitPayout: (payload: PayoutPayload) => Promise<void>;
    submitBranding: (payload: BrandingPayload) => Promise<void>;
    submitPolicies: (payload: PoliciesPayload) => Promise<void>;
    /** Navigate to the previous step (if already on step > 1). */
    goBack: () => void;
    logout: () => Promise<void>;
    clearError: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const OnboardingContext = createContext<OnboardingState | null>(null);

// ─── Step → route mapping ─────────────────────────────────────────────────────

export function stepToRoute(step: AgencyOnboardingStep | number): string {
    switch (step) {
        case 1: return '/onboarding/logistics';
        case 2: return '/onboarding/payout';
        case 3: return '/onboarding/branding';
        case 4: return '/onboarding/policies';
        case 0: return '/dashboard';
        default: return '/onboarding/unknown';
    }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function OnboardingProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const [session, setSession] = useState<AgencyAuthSession | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<ApiError | null>(null);
    const [viewingStep, setViewingStep] = useState<AgencyOnboardingStep | null>(null);
    const [drafts, setDrafts] = useState<StepDrafts>({
        logistics: null,
        payout: null,
        branding: null,
        policies: null,
    });

    const initCalled = useRef(false);

    const currentStep = session?.role_entity.onboarding_step ?? null;

    const initialize = useCallback(async () => {
        if (initCalled.current) return;
        initCalled.current = true;
        setIsInitializing(true);
        try {
            // On the bearer transport an empty token store is already the answer:
            // there is no credential to present, so `auth-me` can only come back
            // 401. Skipping it turns a cold start of a signed-out app into an
            // immediate `/login` rather than a round trip spent being told we are
            // anonymous — on a phone, over mobile data, that request IS the
            // splash-to-login delay.
            //
            // On cookies this is always true and nothing changes: httpOnly cookies
            // are invisible to script, so asking the server is the only way to
            // find out. See CAPACITOR-PLAN.md → P1.11.
            //
            // `return` still runs the `finally` below, so the guard stops
            // rendering its skeleton and redirects.
            if (!(await authStrategy.canAttemptSession())) {
                setSession(null);
                return;
            }

            const res = await authService.getAuthMeAgency();
            setSession(res.data);
            setViewingStep(res.data.role_entity.onboarding_step);
        } catch (err) {
            if (err instanceof ApiError && err.isUnauthorized) {
                setSession(null);
            } else {
                setError(
                    err instanceof ApiError
                        ? err
                        : new ApiError(500, 'INIT_FAILED', 'Failed to initialize session'),
                );
            }
        } finally {
            setIsInitializing(false);
        }
    }, []);

    /**
     * Save raw form values for a given step before the API call.
     * These are used to pre-populate the form when the user navigates back.
     */
    const saveDraft = useCallback((step: 1 | 2 | 3 | 4, values: LogisticsFormValues | PayoutFormValues | BrandingFormValues | PoliciesFormValues) => {
        setDrafts(prev => {
            if (step === 1) return { ...prev, logistics: values as LogisticsFormValues };
            if (step === 2) return { ...prev, payout: values as PayoutFormValues };
            if (step === 3) return { ...prev, branding: values as BrandingFormValues };
            return { ...prev, policies: values as PoliciesFormValues };
        });
    }, []);

    const handleStepResponse = useCallback(
        (response: OnboardingStepResponse, submittedFromStep: number) => {
            const { completionStatus, profile } = response.data;
            const backendStep = completionStatus.onboardingStep;

            setSession((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    role_entity: {
                        ...prev.role_entity,
                        ...profile,
                        onboarding_step: backendStep,
                        // Carry forward the incremented version from the profile response
                        // so the next step sends the fresh value for OCC.
                        version: profile.version ?? prev.role_entity.version,
                    },
                };
            });

            // Always navigate to the *next sequential step* after the one just submitted.
            // We never jump to the backend's max step — that would skip intermediate steps
            // when the user goes back and resubmits an earlier step.
            // Exception: if backend says 0 (complete), go to dashboard immediately.
            if (backendStep === 0) {
                setViewingStep(0 as AgencyOnboardingStep);
                navigate('/dashboard', { replace: true });
            } else {
                const nextViewStep = (submittedFromStep + 1) as AgencyOnboardingStep;
                setViewingStep(nextViewStep);
                navigate(stepToRoute(nextViewStep), { replace: true });
            }
        },
        [navigate],
    );

    const wrapStep = useCallback(
        async (fn: () => Promise<OnboardingStepResponse>, submittedFromStep: number) => {
            setIsSubmitting(true);
            setError(null);
            try {
                const response = await fn();
                handleStepResponse(response, submittedFromStep);
            } catch (err) {
                const apiErr =
                    err instanceof ApiError
                        ? err
                        : new ApiError(500, 'SUBMIT_FAILED', 'Step submission failed');
                setError(apiErr);
                throw apiErr;
            } finally {
                setIsSubmitting(false);
            }
        },
        [handleStepResponse],
    );

    const submitLogistics = useCallback(
        (payload: LogisticsPayload) =>
            wrapStep(() => onboardingService.submitLogistics(payload), 1),
        [wrapStep],
    );

    const submitPayout = useCallback(
        (payload: PayoutPayload) =>
            wrapStep(() => onboardingService.submitPayout(payload), 2),
        [wrapStep],
    );

    const submitBranding = useCallback(
        (payload: BrandingPayload) =>
            wrapStep(() => onboardingService.submitBranding(payload), 3),
        [wrapStep],
    );

    const submitPolicies = useCallback(
        (payload: PoliciesPayload) =>
            wrapStep(() => onboardingService.submitPolicies(payload), 4),
        [wrapStep],
    );

    /**
     * A hard logout from the API layer has to clear the session here too.
     *
     * `auth:logout` used to be handled by navigation alone — App.tsx and
     * OnboardingGuard both send the user to `/login` — which was enough while
     * `/login` was a static screen. It is not enough now: the sign-in screen
     * redirects anyone who already holds a session, so a stale one left in this
     * store would bounce a signed-out user straight back into the dashboard, on
     * to the next 401, and around again.
     *
     * This store owns the session, so ending it belongs here rather than in
     * either listener. Neither navigates on our behalf being removed — both
     * still do their own.
     */
    useEffect(() => {
        const onHardLogout = () => {
            setSession(null);
            setViewingStep(null);
            setDrafts({ logistics: null, payout: null, branding: null, policies: null });
            // Same reset `logout()` performs: a later visit to a guarded route
            // is free to ask the server again.
            initCalled.current = false;
            setIsInitializing(false);
        };
        window.addEventListener('auth:logout', onHardLogout);
        return () => window.removeEventListener('auth:logout', onHardLogout);
    }, []);

    const adoptSession = useCallback((next: AgencyAuthSession) => {
        setSession(next);
        setViewingStep(next.role_entity.onboarding_step);
        setError(null);
        // The login response IS the session, and it is newer than anything
        // `auth-me` could return, so the boot call is already satisfied.
        initCalled.current = true;
        // `/login` sits outside OnboardingGuard, so on a direct visit nothing
        // ever called `initialize()` and this is still true from mount. Leaving
        // it would park the guard on its skeleton forever after we navigate.
        setIsInitializing(false);
    }, []);

    const refreshSession = useCallback(async () => {
        try {
            const response = await authService.getAuthMeAgency();
            setSession(response.data);
        } catch (err) {
            if (!(err instanceof ApiError && err.isUnauthorized)) {
                // best-effort; keep the stale session rather than clobbering it
            }
        }
    }, []);

    const updateAgencyProfile = useCallback(
        async (payload: UpdateAgencyProfilePayload) => {
            setIsSubmitting(true);
            setError(null);
            try {
                await agencyProfileService.updateProfile(payload);
                await refreshSession();
            } catch (err) {
                const apiErr =
                    err instanceof ApiError ? err : new ApiError(500, 'PROFILE_UPDATE_FAILED', 'Profile update failed');
                setError(apiErr);
                throw apiErr;
            } finally {
                setIsSubmitting(false);
            }
        },
        [refreshSession],
    );

    const goBack = useCallback(() => {
        const v = viewingStep;
        if (!v || v <= 1) return;
        const prevStep = (v - 1) as AgencyOnboardingStep;
        setViewingStep(prevStep);
        navigate(stepToRoute(prevStep), { replace: true });
    }, [viewingStep, navigate]);

    const logout = useCallback(async () => {
        try {
            await authService.logout();
        } catch {
            // best-effort
        } finally {
            setSession(null);
            setDrafts({ logistics: null, payout: null, branding: null, policies: null });
            initCalled.current = false;
            navigate('/login', { replace: true });
        }
    }, [navigate]);

    const clearError = useCallback(() => setError(null), []);

    return (
        <OnboardingContext.Provider
            value={{
                session,
                isInitializing,
                isSubmitting,
                error,
                currentStep,
                viewingStep,
                drafts,
                saveDraft,
                initialize,
                adoptSession,
                refreshSession,
                updateAgencyProfile,
                submitLogistics,
                submitPayout,
                submitBranding,
                submitPolicies,
                goBack,
                logout,
                clearError,
            }}
        >
            {children}
        </OnboardingContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOnboarding(): OnboardingState {
    const ctx = useContext(OnboardingContext);
    if (!ctx) {
        throw new Error('useOnboarding must be used within <OnboardingProvider>');
    }
    return ctx;
}
