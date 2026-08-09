import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, ChevronRight, ChevronLeft, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { OnboardingLayout } from '@/onboarding/OnboardingLayout';
import { buildPayoutSchema, toSubmittablePayoutDetails } from '@/onboarding/schemas/onboarding.schemas';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { PayoutMethodsEditor, toPayoutEntries, type PayoutEntry } from '@/components/agency-settings/payout';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/types/api';
import { getApiErrorMessage } from '@/lib/errors';

export function Step2Payout() {
    const { t } = useTranslation(['onboarding', 'common']);
    const { submitPayout, isSubmitting, session, goBack, drafts, saveDraft } = useOnboarding();
    const [apiError, setApiError] = useState<string | null>(null);
    // Rebuilt on a language switch so validation messages follow the UI.
    const schema = useMemo(() => buildPayoutSchema(t), [t]);

    const roleEntity = session?.role_entity;
    // Draft takes precedence — it holds the exact values entered last time,
    // secrets included, which a re-read of the profile could never give back.
    const [entries, setEntries] = useState<PayoutEntry[]>(
        () => drafts.payout?.payout_details ?? toPayoutEntries(roleEntity?.payout_details),
    );

    const onSubmit = useCallback(async () => {
        setApiError(null);
        const parsed = schema.safeParse({ payout_details: entries });
        if (!parsed.success) {
            toast.error(parsed.error.issues[0]?.message ?? t('payout.incompleteSave'));
            return;
        }
        // Save the entered values BEFORE the API call, so a failure doesn't cost
        // the user the secrets they just retyped.
        saveDraft(2, parsed.data);
        try {
            await submitPayout({
                payout_details: toSubmittablePayoutDetails(parsed.data.payout_details),
                version: roleEntity?.version,
            });
            toast.success(t('payout.saved'));
        } catch (err) {
            if (err instanceof ApiError) {
                // Field errors are the one place raw server text is allowed through:
                // they name a specific field and carry no code to resolve.
                if (err.isConcurrentModification) setApiError(t('errors.concurrentShort'));
                else if (err.isValidation) setApiError(err.firstFieldError() ?? getApiErrorMessage(err));
                else setApiError(err.isServer ? t('errors.server') : getApiErrorMessage(err));
            } else {
                setApiError(getApiErrorMessage(err));
            }
        }
    }, [entries, schema, saveDraft, submitPayout, roleEntity, t]);

    return (
        <OnboardingLayout stepKey={2} viewingStepOverride={2}
            ctaSlot={
                <div className="px-6 pb-6 pt-2 flex gap-3">
                    <Button type="button" variant="outline" onClick={goBack} disabled={isSubmitting} className="h-12 w-24 rounded-xl font-semibold gap-1.5 border-slate-300 text-slate-600 dark:border-zinc-600 dark:text-slate-300">
                        <ChevronLeft className="w-4 h-4" /> {t('actions.back')}
                    </Button>
                    <Button type="button" onClick={() => void onSubmit()} disabled={isSubmitting} className="flex-1 h-12 rounded-xl font-semibold gap-2">
                        {isSubmitting
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('actions.saving')}</>
                            : <>{t('actions.continue')} <ChevronRight className="w-4 h-4" /></>}
                    </Button>
                </div>
            }
        >
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><CreditCard className="w-4 h-4 text-primary" /></div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">{t('payout.title')}</h1>
                </div>
                <p className="text-sm text-slate-500">{t('payout.description')}</p>
            </div>

            {apiError && <div role="alert" className="mx-6 mt-4 p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200">{apiError}</div>}

            {/* The same editor Account → Payout runs, so a method is added the one
                way everywhere and onboarding can't drift from settings. */}
            <div className="px-6 pt-5 pb-6 space-y-4">
                <PayoutMethodsEditor value={entries} onChange={setEntries} />
                <p className="text-xs text-slate-400 text-center">{t('payout.footnote')}</p>
            </div>
        </OnboardingLayout>
    );
}
