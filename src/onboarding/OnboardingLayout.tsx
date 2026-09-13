import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tx } from '@/i18n/tx';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/common/AppLogo';
import { LanguagePicker } from '@/components/common/LanguagePicker';
import { useOnboarding, stepToRoute } from '@/onboarding/store/onboarding.store';
import type { AgencyOnboardingStep } from '@/types/api';

// ─── Step metadata ────────────────────────────────────────────────────────────
// Labels are `onboarding:layout.steps.*` keys — this table is module-scope data.

const STEPS: { step: Exclude<AgencyOnboardingStep, 0>; labelKey: string }[] = [
    { step: 1, labelKey: 'logistics' },
    { step: 2, labelKey: 'payout' },
    { step: 3, labelKey: 'branding' },
    { step: 4, labelKey: 'policies' },
];

// ─── Shared select class helper (exported for use in step components) ─────────

export const selectTriggerClass = (hasError?: boolean) =>
    cn(
        'h-11 w-full rounded-lg border text-sm bg-muted',
        'border-border text-foreground',
        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
        'placeholder:text-muted-foreground transition-colors duration-150',
        hasError && 'border-destructive focus:ring-destructive/30 focus:border-destructive',
    );

// ─── Clickable horizontal stepper ─────────────────────────────────────────────

function StepProgress({
    current,
    maxReached,
}: {
    current: number;
    maxReached: number;
}) {
    const { t } = useTranslation('onboarding');
    const navigate = useNavigate();

    const handleStepClick = (step: number) => {
        if (step <= maxReached) {
            // Navigate to this step (it's already unlocked)
            navigate(stepToRoute(step as AgencyOnboardingStep), { replace: true });
        } else {
            // Clicked a locked future step — redirect to current max
            navigate(stepToRoute(maxReached as AgencyOnboardingStep), { replace: true });
        }
    };

    return (
        <div className="w-full flex items-center justify-center px-6 pt-5 pb-4">
            <div className="flex items-center gap-0 w-full max-w-sm">
                {STEPS.map(({ step, labelKey }, i) => {
                    const label = tx(t, `layout.steps.${labelKey}`);
                    const isCompleted = step < current || (step < maxReached && step < current);
                    const isActive = step === current;
                    const isUnlocked = step <= maxReached;
                    const isLast = i === STEPS.length - 1;
                    const isClickable = isUnlocked;

                    return (
                        <div key={step} className="flex items-center flex-1 last:flex-none">
                            {/* Node */}
                            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                <motion.button
                                    type="button"
                                    initial={false}
                                    animate={{ scale: isActive ? 1.1 : 1 }}
                                    transition={{ duration: 0.2 }}
                                    onClick={() => handleStepClick(step)}
                                    disabled={!isClickable && !isUnlocked}
                                    title={
                                        isClickable
                                            ? t('layout.goToStep', { label })
                                            : t('layout.lockedStep')
                                    }
                                    className={cn(
                                        'w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-all duration-200',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                                        isCompleted && 'bg-success border-success text-success-foreground hover:bg-success/90 cursor-pointer',
                                        isActive && 'bg-primary border-primary text-primary-foreground shadow-md shadow-primary/30 cursor-default ring-4 ring-primary/15',
                                        !isActive && !isCompleted && isUnlocked && 'bg-card border-primary text-primary hover:bg-primary/5 cursor-pointer',
                                        !isUnlocked && 'bg-muted border-muted-foreground/20 text-muted-foreground cursor-not-allowed',
                                    )}
                                    aria-label={
                                        isClickable
                                            ? t('layout.goToStepAria', { step, label })
                                            : t('layout.lockedStepAria', { step, label })
                                    }
                                    aria-current={isActive ? 'step' : undefined}
                                >
                                    {isCompleted
                                        ? <CheckCircle2 className="w-4 h-4" />
                                        : step
                                    }
                                </motion.button>
                                <span className={cn(
                                    'text-[10px] font-semibold whitespace-nowrap select-none',
                                    // Unlocked-but-not-visited and locked read
                                    // the same: the circle above already says
                                    // which is which, and two greys a shade
                                    // apart said it less clearly than one.
                                    isActive ? 'text-primary' : isCompleted ? 'text-success' : 'text-muted-foreground',
                                )}>
                                    {label}
                                </span>
                            </div>

                            {/* Connector line */}
                            {!isLast && (
                                <div className="flex-1 mx-2 mb-4">
                                    <div className="relative h-0.5 bg-muted-foreground/20 rounded-full overflow-hidden">
                                        <motion.div
                                            className="absolute inset-y-0 start-0 bg-success rounded-full"
                                            initial={false}
                                            animate={{ width: isCompleted ? '100%' : '0%' }}
                                            transition={{ duration: 0.4, ease: 'easeOut' }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

interface OnboardingLayoutProps {
    children: ReactNode;
    ctaSlot?: ReactNode;
    stepKey: AgencyOnboardingStep;
    viewingStepOverride?: number;
}

export function OnboardingLayout({ children, ctaSlot, stepKey, viewingStepOverride }: OnboardingLayoutProps) {
    const { t } = useTranslation('onboarding');
    const { session, logout, currentStep, viewingStep } = useOnboarding();
    const agencyName = session?.role_entity.agency_name ?? t('layout.fallbackAgencyName');
    const displayStep = viewingStepOverride ?? viewingStep ?? currentStep;
    const maxReached = currentStep ?? 1;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* ── Header ──
                The padding and the matching height keep the bar 4rem tall while
                letting the card surface fill the status-bar band on a device
                drawing edge to edge (CAPACITOR-PLAN.md → P3.3). `env()` is 0 in
                every browser, so this is `h-16` as before on the web. */}
            <header className="h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-card border-b border-border flex items-center justify-between px-4 md:px-8 flex-shrink-0 shadow-sm">
                <div className="flex items-center gap-2.5">
                    <AppLogo decorative className="shadow-sm" />
                    <div className="flex flex-col leading-tight">
                        <span className="font-bold text-sm text-foreground leading-none">
                            {t('layout.platform')}
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-none truncate max-w-[140px] mt-0.5">{agencyName}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {/* Onboarding is still "the very beginning" — someone who
                        registered in the wrong language should not have to
                        finish four steps of forms before they can reach the
                        Account → Profile picker. */}
                    <LanguagePicker />
                    <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground gap-1.5">
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline text-sm">{t('layout.signOut')}</span>
                    </Button>
                </div>
            </header>

            {/* ── Clickable Step progress ── */}
            {displayStep !== null && displayStep !== 0 && (
                <nav aria-label={t('layout.progressLabel')} className="bg-card border-b border-border">
                    <StepProgress current={displayStep as number} maxReached={maxReached as number} />
                </nav>
            )}

            {/* ── Scrollable content ── */}
            <main className="flex-1 overflow-y-auto">
                <div className="w-full max-w-xl mx-auto px-4 py-6 md:py-10">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={stepKey}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                        >
                            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                                {children}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
                {ctaSlot && (
                    <div className="hidden md:block w-full max-w-xl mx-auto px-4 pb-10">
                        {ctaSlot}
                    </div>
                )}
            </main>

            {/* ── Sticky mobile CTA ──
                `pb` clears the gesture bar the shell now draws behind (P3.3).
                Capacitor zeroes the bottom inset while the keyboard is up, so
                the button rides the keys rather than sitting a bar's width
                above them. */}
            {ctaSlot && (
                <div className="md:hidden bg-card border-t border-border px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex-shrink-0">
                    {ctaSlot}
                </div>
            )}
        </div>
    );
}
