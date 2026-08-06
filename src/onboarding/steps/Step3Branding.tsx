import { useCallback, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ChevronRight, ChevronLeft, SkipForward, ImageIcon, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { OnboardingLayout, selectTriggerClass } from '@/onboarding/OnboardingLayout';
import { brandingSchema, type BrandingFormValues } from '@/onboarding/schemas/onboarding.schemas';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { MediaPickerTrigger, type MediaRef } from '@/components/common/MediaPickerTrigger';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError } from '@/types/api';
import { getApiErrorMessage } from '@/lib/errors';
import { TIMEZONES } from '@/lib/timezones';

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
    const { t } = useTranslation(['onboarding', 'common']);
    const { submitBranding, isSubmitting, goBack, session, drafts, saveDraft } = useOnboarding();
    const [apiError, setApiError] = useState<string | null>(null);
    const [isSkipping, setIsSkipping] = useState(false);

    const roleEntity = session?.role_entity;
    const draft = drafts.branding;

    // The logo lives outside RHF: it's picked, not typed. The draft keeps both the
    // id (what we submit) and the preview URL (what we render on back-navigation).
    const [logo, setLogo] = useState<MediaRef | null>(
        draft?.logo_file_id && draft.logo_preview_url
            ? { id: draft.logo_file_id, url: draft.logo_preview_url }
            : null,
    );

    // A logo saved on a previous visit comes back as a URL only (no id), so
    // detaching it is a separate intent from picking a new one.
    const [logoCleared, setLogoCleared] = useState(false);
    const previewUrl = logo?.url ?? (logoCleared ? null : roleEntity?.logo_url ?? null);

    const { handleSubmit, control, formState: { errors } } = useForm<BrandingFormValues>({
        resolver: zodResolver(brandingSchema),
        defaultValues: {
            timezone: draft?.timezone ?? roleEntity?.timezone ?? '',
        },
    });

    const handleSave = useCallback(async (values: BrandingFormValues) => {
        setApiError(null);
        // Save raw form values BEFORE the API call.
        saveDraft(3, { ...values, logo_file_id: logo?.id ?? null, logo_preview_url: logo?.url ?? null });
        try {
            // Send logo_file_id only on an explicit pick (the id) or removal (null);
            // omitting it leaves any existing logo alone. timezone is NOT clearable
            // (min 1 char, server default) so an empty value is omitted.
            await submitBranding({
                skip: false,
                ...(logo ? { logo_file_id: logo.id } : logoCleared ? { logo_file_id: null } : {}),
                timezone: values.timezone || undefined,
            });
            toast.success(t('branding.saved'));
        } catch (err) {
            if (err instanceof ApiError) {
                setApiError(err.isServer ? t('errors.server') : getApiErrorMessage(err));
            }
        }
    }, [submitBranding, saveDraft, logo, logoCleared, t]);

    const handleSkip = useCallback(async () => {
        setApiError(null);
        setIsSkipping(true);
        try {
            await submitBranding({ skip: true });
            toast.success(t('branding.skipped'));
        } catch (err) {
            setApiError(err instanceof ApiError ? getApiErrorMessage(err) : t('errors.skipFailed'));
            setIsSkipping(false);
        }
    }, [submitBranding, t]);

    return (
        <OnboardingLayout stepKey={3} viewingStepOverride={3}
            ctaSlot={
                <div className="px-6 pb-6 pt-2 space-y-2">
                    <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={goBack} disabled={isSubmitting || isSkipping} className="h-12 w-24 rounded-xl font-semibold gap-1.5 border-slate-300 text-slate-600 dark:border-zinc-600 dark:text-slate-300">
                            <ChevronLeft className="w-4 h-4" /> {t('actions.back')}
                        </Button>
                        <Button type="submit" form="step3-branding-form" disabled={isSubmitting || isSkipping} className="flex-1 h-12 rounded-xl font-semibold gap-2">
                            {isSubmitting
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('actions.saving')}</>
                                : <>{t('actions.saveAndFinish')} <ChevronRight className="w-4 h-4" /></>}
                        </Button>
                    </div>
                    <Button type="button" variant="ghost" onClick={handleSkip} disabled={isSubmitting || isSkipping} className="w-full h-11 text-slate-400 hover:text-slate-600 gap-1.5 text-sm">
                        {isSkipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipForward className="w-4 h-4" />}
                        {t('actions.skipForNow')}
                    </Button>
                </div>
            }
        >
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><ImageIcon className="w-4 h-4 text-primary" /></div>
                        <h1 className="text-lg font-bold text-slate-900 dark:text-white">{t('branding.title')}</h1>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-500 px-2 py-0.5 rounded-full">
                        <SkipForward className="w-3 h-3" /> {t('actions.optional')}
                    </span>
                </div>
                <p className="text-sm text-slate-500">{t('branding.description')}</p>
            </div>

            {apiError && <div role="alert" className="mx-6 mt-4 p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200">{apiError}</div>}

            <form id="step3-branding-form" onSubmit={handleSubmit(handleSave)} className="px-6 pt-5 pb-6 space-y-4" noValidate>
                <div className="rounded-xl border-2 border-slate-200 dark:border-zinc-700 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100/60 dark:bg-zinc-800">
                        <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-500">{t('branding.logoSection')}</span>
                    </div>
                    <div className="p-4 bg-white dark:bg-zinc-900">
                        <div className="flex items-center gap-4">
                            {/* The tile is the control — clicking it opens the media library. */}
                            <MediaPickerTrigger
                                label={previewUrl ? t('branding.changeLogo') : t('branding.addLogo')}
                                acceptedTypes={['image']}
                                onSelect={(media) => { setLogo(media); setLogoCleared(false); }}
                                className="h-20 w-20 shrink-0 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800"
                            >
                                {previewUrl ? (
                                    <img
                                        src={previewUrl}
                                        alt={t('branding.logoAlt')}
                                        crossOrigin="use-credentials"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <span className="flex h-full w-full items-center justify-center">
                                        <ImageIcon className="w-7 h-7 text-slate-400" />
                                    </span>
                                )}
                            </MediaPickerTrigger>
                            <div className="min-w-0 space-y-1">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {previewUrl ? t('branding.logoSelected') : t('branding.noLogo')}
                                </p>
                                <p className="text-xs text-slate-400">{t('branding.logoHint')}</p>
                                {previewUrl && (
                                    <button
                                        type="button"
                                        onClick={() => { setLogo(null); setLogoCleared(true); }}
                                        className="text-xs text-red-500 hover:underline"
                                    >
                                        {t('common:actions.remove')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border-2 border-slate-200 dark:border-zinc-700 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100/60 dark:bg-zinc-800">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-500">{t('branding.timezoneSection')}</span>
                    </div>
                    <div className="p-4 bg-white dark:bg-zinc-900">
                        <FieldRow label={t('branding.timezone')} hint={t('branding.timezoneHint')} error={errors.timezone?.message}>
                            <Controller control={control} name="timezone" render={({ field }) => (
                                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                                    <SelectTrigger className={selectTriggerClass(!!errors.timezone)}>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Clock className="w-4 h-4 text-slate-400" />
                                            <SelectValue placeholder={t('branding.timezonePlaceholder')} />
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
