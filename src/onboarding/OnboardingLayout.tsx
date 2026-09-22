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
import { useKeyboardOpen } from '@/platform/shell/keyboard';
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
    /** The step being rendered — and so the step the header shows. */
    stepKey: AgencyOnboardingStep;
}

export function OnboardingLayout({ children, ctaSlot, stepKey }: OnboardingLayoutProps) {
    const { t } = useTranslation('onboarding');
    const { session, logout, currentStep } = useOnboarding();
    // Hides the sticky mobile CTA while typing — see the bar below. Always false
    // off native, so the web build keeps its bar.
    const keyboardOpen = useKeyboardOpen();
    const agencyName = session?.role_entity.agency_name ?? t('layout.fallbackAgencyName');
    // The header shows the step on screen, never a stored copy of it: a copy
    // goes stale whenever the route moves without the store (stepper tap,
    // Android back, a typed URL) and then titles one step over another's form.
    const displayStep = stepKey;
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
            {displayStep !== 0 && (
                <nav aria-label={t('layout.progressLabel')} className="bg-card border-b border-border">
                    <StepProgress current={displayStep} maxReached={maxReached} />
                </nav>
            )}

            {/* ── Content ──
                The DOCUMENT scrolls (the page is `min-h-screen`), so `main` gets
                no `overflow` of its own: it never scrolled anything, but it did
                clip absolutely positioned popovers near its end — the address
                search's result list — into a little inner scroll box. */}
            <main className="flex-1">
                <div className="w-full max-w-xl mx-auto px-4 py-6 md:py-10">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={stepKey}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                        >
                            {/* The card is desktop-only. On a phone it was one more
                                border and 24px of padding a side around sections
                                that already have their own, and the fields were
                                what paid for it — so there the step sits straight
                                on the page, and the steps drop their `px-6` below
                                `md` to match. */}
                            <div className="md:bg-card md:rounded-2xl md:border md:border-border md:shadow-sm md:overflow-hidden">
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
                `sticky bottom-0`, because the document is what scrolls: without
                it the bar was just the last thing on the page, at the far end of
                a long step. `pb` clears the gesture bar the shell draws behind
                (P3.3).

                Hidden while the native keyboard is up. Pinned over the keys it
                would sit on top of the very field being typed in — the WebView
                scrolls a focused input to its bottom edge, which is where the bar
                is. The in-flow bar this replaced could never cover a field, so
                "ride the keys" no longer holds once it sticks. Same call as
                `MobileTabBar`, and as vendor-dash's onboarding. */}
            {ctaSlot && !keyboardOpen && (
                <div className="md:hidden sticky bottom-0 z-20 bg-card border-t border-border px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex-shrink-0">
                    {ctaSlot}
                </div>
            )}
        </div>
    );
}
