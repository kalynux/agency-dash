import { useCallback, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ChevronRight, ChevronLeft, SkipForward, ImageIcon, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { OnboardingLayout, selectTriggerClass } from '@/onboarding/OnboardingLayout';
import { brandingSchema, type BrandingFormValues } from '@/onboarding/schemas/onboarding.schemas';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError } from '@/types/api';
import { cn } from '@/lib/utils';

const TIMEZONES = [
    { value: 'Africa/Douala', label: 'Douala (WAT, UTC+1)' },
    { value: 'Africa/Lagos', label: 'Lagos (WAT, UTC+1)' },
    { value: 'Africa/Abidjan', label: 'Abidjan (GMT, UTC+0)' },
    { value: 'Africa/Dakar', label: 'Dakar (GMT, UTC+0)' },
    { value: 'Africa/Accra', label: 'Accra (GMT, UTC+0)' },
    { value: 'Africa/Nairobi', label: 'Nairobi (EAT, UTC+3)' },
    { value: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam (EAT, UTC+3)' },
    { value: 'Africa/Kampala', label: 'Kampala (EAT, UTC+3)' },
    { value: 'Africa/Kigali', label: 'Kigali (CAT, UTC+2)' },
    { value: 'Africa/Cairo', label: 'Cairo (EET, UTC+2)' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST, UTC+2)' },
    { value: 'Europe/Paris', label: 'Paris (CET, UTC+1)' },
    { value: 'Europe/London', label: 'London (GMT, UTC+0)' },
    { value: 'America/New_York', label: 'New York (EST, UTC-5)' },
];

function FieldRow({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
            {children}
            {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
            {error && <p className="text-xs text-red-500 mt-1" role="alert">{error}</p>}
        </div>
    );
}

export function Step3Branding() {
    const { submitBranding, isSubmitting, goBack, session, drafts, saveDraft } = useOnboarding();
    const [apiError, setApiError] = useState<string | null>(null);
    const [isSkipping, setIsSkipping] = useState(false);

    const roleEntity = session?.role_entity;
    const draft = drafts.branding;

    const { register, handleSubmit, control, formState: { errors } } = useForm<BrandingFormValues>({
        resolver: zodResolver(brandingSchema),
        defaultValues: {
            logo_url: draft?.logo_url ?? roleEntity?.logo_url ?? '',
            timezone: draft?.timezone ?? roleEntity?.timezone ?? '',
        },
    });

    const handleSave = useCallback(async (values: BrandingFormValues) => {
        setApiError(null);
        // Save raw form values BEFORE the API call.
        saveDraft(3, values);
        try {
            await submitBranding({ skip: false, logo_url: values.logo_url || undefined, timezone: values.timezone || undefined });
            toast.success('Profile complete! Welcome aboard 🎉');
        } catch (err) {
            if (err instanceof ApiError) setApiError(err.isServer ? 'Server error. Please try again.' : err.message);
        }
    }, [submitBranding]);

    const handleSkip = useCallback(async () => {
        setApiError(null);
        setIsSkipping(true);
        try {
            await submitBranding({ skip: true });
            toast.success('Setup complete! Welcome to the dashboard 🎉');
        } catch (err) {
            setApiError(err instanceof ApiError ? err.message : 'Could not skip. Please try again.');
            setIsSkipping(false);
        }
    }, [submitBranding]);

    return (
        <OnboardingLayout stepKey={3} viewingStepOverride={3}
            ctaSlot={
                <div className="px-6 pb-6 pt-2 space-y-2">
                    <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={goBack} disabled={isSubmitting || isSkipping} className="h-12 w-24 rounded-xl font-semibold gap-1.5 border-slate-300 text-slate-600 dark:border-zinc-600 dark:text-slate-300">
                            <ChevronLeft className="w-4 h-4" /> Back
                        </Button>
                        <Button type="submit" form="step3-branding-form" disabled={isSubmitting || isSkipping} className="flex-1 h-12 rounded-xl font-semibold gap-2">
                            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <>Save & Finish <ChevronRight className="w-4 h-4" /></>}
                        </Button>
                    </div>
                    <Button type="button" variant="ghost" onClick={handleSkip} disabled={isSubmitting || isSkipping} className="w-full h-11 text-slate-400 hover:text-slate-600 gap-1.5 text-sm">
                        {isSkipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipForward className="w-4 h-4" />}
                        Skip for now
                    </Button>
                </div>
            }
        >
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><ImageIcon className="w-4 h-4 text-primary" /></div>
                        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Branding</h1>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-500 px-2 py-0.5 rounded-full">
                        <SkipForward className="w-3 h-3" /> Optional
                    </span>
                </div>
                <p className="text-sm text-slate-500">Add your logo and timezone. You can always update these later in Settings.</p>
            </div>

            {apiError && <div role="alert" className="mx-6 mt-4 p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200">{apiError}</div>}

            <form id="step3-branding-form" onSubmit={handleSubmit(handleSave)} className="px-6 pt-5 pb-6 space-y-4" noValidate>
                <div className="rounded-xl border-2 border-slate-200 dark:border-zinc-700 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100/60 dark:bg-zinc-800">
                        <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-500">Agency Logo</span>
                    </div>
                    <div className="p-4 bg-white dark:bg-zinc-900 space-y-1.5">
                        <FieldRow
                            label="Logo URL"
                            hint="Publicly accessible image URL (square, min 200×200 px recommended)"
                            error={errors.logo_url?.message}
                        >
                            <div className="relative">
                                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <Input
                                    id="logo_url"
                                    type="url"
                                    inputMode="url"
                                    placeholder="https://cdn.example.com/logo.png"
                                    className={cn('pl-9 h-11 rounded-lg bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-sm', errors.logo_url && 'border-red-400')}
                                    {...register('logo_url')}
                                />
                            </div>
                        </FieldRow>
                    </div>
                </div>

                <div className="rounded-xl border-2 border-slate-200 dark:border-zinc-700 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100/60 dark:bg-zinc-800">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-500">Operating Timezone</span>
                    </div>
                    <div className="p-4 bg-white dark:bg-zinc-900">
                        <FieldRow label="Timezone" hint="Defaults to Africa/Douala if not set." error={errors.timezone?.message}>
                            <Controller control={control} name="timezone" render={({ field }) => (
                                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                                    <SelectTrigger className={selectTriggerClass(!!errors.timezone)}>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Clock className="w-4 h-4 text-slate-400" />
                                            <SelectValue placeholder="Select timezone (default: Africa/Douala)" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIMEZONES.map(tz => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )} />
                        </FieldRow>
                    </div>
                </div>
            </form>
        </OnboardingLayout>
    );
}
