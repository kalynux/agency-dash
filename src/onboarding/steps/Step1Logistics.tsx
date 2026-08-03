import { useCallback, useMemo, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ChevronRight, Plus, Trash2, MapPin, Globe, Phone, Mail, Building, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { OnboardingLayout } from '@/onboarding/OnboardingLayout';
import { buildLogisticsSchema, type LogisticsFormValues, type HeadquartersAddressFormValues } from '@/onboarding/schemas/onboarding.schemas';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { AddressSearchInput } from '@/components/common/AddressSearchInput';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ApiError } from '@/types/api';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { regionsFor, DEFAULT_COUNTRY, type RegionEntry } from '@/lib/regions';
import type { GeoAddress } from '@/types/geo.types';

/**
 * The agency's operating country, sent with step 1.
 *
 * Hardcoded because locations.json only ships regions for Cameroon, so coverage
 * areas can only ever be picked from `CM` today. The backend treats this as
 * SET-ONCE: it stays correctable across step re-edits while onboarding is in
 * progress, then locks at completion (`403 PROFILE_COUNTRY_IMMUTABLE` on the
 * profile PATCH). A multi-country rollout must expose this as a real form field
 * here — it cannot be fixed after the fact from Settings.
 */
const AGENCY_COUNTRY = DEFAULT_COUNTRY;

const EMPTY_HQ = {
    label: '', region: '', city: '', address_description: '',
    support_contact: { phone: '', email: '' },
    geo: null,
} as unknown as HeadquartersAddressFormValues;

function FieldRow({ label, required, optional, error, children }: { label: string; required?: boolean; optional?: boolean; error?: string; children: React.ReactNode }) {
    const { t } = useTranslation('common');
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                {optional && (
                    <span className="text-slate-400 normal-case font-normal ml-1">
                        ({t('form.optional').toLowerCase()})
                    </span>
                )}
            </label>
            {children}
            {error && <p className="text-xs text-red-500 mt-1" role="alert">{error}</p>}
        </div>
    );
}

function IconInput({ icon: Icon, hasError, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType; hasError?: boolean }) {
    return (
        <div className="relative">
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input {...props} className={cn(
                'w-full pl-9 pr-3 h-11 rounded-lg border text-sm bg-slate-50 dark:bg-zinc-800',
                'border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400',
                'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
                hasError && 'border-red-400 focus:ring-red-200 focus:border-red-400', className,
            )} />
        </div>
    );
}

export function Step1Logistics() {
    const { t, i18n } = useTranslation(['onboarding', 'common']);
    const { submitLogistics, isSubmitting, session, drafts, saveDraft } = useOnboarding();
    const [apiError, setApiError] = useState<string | null>(null);
    // Rebuilt on a language switch so validation messages follow the UI.
    const schema = useMemo(() => buildLogisticsSchema(t), [t]);

    const roleEntity = session?.role_entity;
    // Drafts are the ONLY pre-population source: coverage areas and HQ addresses
    // now live on the magazin, so the session's role_entity no longer carries them.
    const draft = drafts.logistics;

    // Region labels come out of locations.json in the active language.
    const regions: RegionEntry[] = useMemo(
        () => regionsFor(AGENCY_COUNTRY, i18n.language),
        [i18n.language],
    );

    const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<LogisticsFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            coverage_areas: draft?.coverage_areas ?? [],
            headquarters_addresses: draft?.headquarters_addresses ?? [{ ...EMPTY_HQ }],
        },
    });

    const { fields, append, remove } = useFieldArray({ control, name: 'headquarters_addresses' });
    const selectedAreas = watch('coverage_areas');

    const toggleRegion = useCallback((key: string, checked: boolean) => {
        const cur = selectedAreas ?? [];
        setValue('coverage_areas', checked ? [...cur, key] : cur.filter(k => k !== key), { shouldValidate: true });
    }, [selectedAreas, setValue]);

    const onSubmit = useCallback(async (values: LogisticsFormValues) => {
        setApiError(null);
        // Save raw form values BEFORE the API call so they survive navigation.
        // This is the reliable pre-population source (backend response is camelCase).
        saveDraft(1, values);
        try {
            await submitLogistics({
                country: AGENCY_COUNTRY,
                coverage_areas: values.coverage_areas,
                headquarters_addresses: values.headquarters_addresses.map(addr => {
                    const { email, phone } = addr.support_contact;
                    const geo = addr.geo as GeoAddress;
                    return {
                        label: addr.label.trim(),
                        address_description: addr.address_description.trim(),
                        // Clearable field: empty input → explicit null (see api-doc/agency/profile.md).
                        support_contact: { phone, email: email?.trim() || null },
                        // `location`, `region` and `city` are all derived from `geo`
                        // server-side — region/city go out only where the geocode
                        // named neither and the agency typed one in.
                        geo,
                        ...(!geo.components.region && addr.region?.trim()
                            ? { region: addr.region.trim() }
                            : {}),
                        ...(!geo.components.city && addr.city?.trim()
                            ? { city: addr.city.trim() }
                            : {}),
                    };
                }),
                version: roleEntity?.version,
            });
            toast.success(t('logistics.saved'));
        } catch (err) {
            if (err instanceof ApiError) {
                // Field errors are the one place raw server text is allowed through:
                // they name a specific field and carry no code to resolve.
                if (err.isConcurrentModification) setApiError(t('errors.concurrent'));
                else if (err.isValidation) setApiError(err.firstFieldError() ?? getApiErrorMessage(err));
                else setApiError(err.isServer ? t('errors.server') : getApiErrorMessage(err));
            }
        }
    }, [submitLogistics, saveDraft, roleEntity, t]);

    return (
        <OnboardingLayout stepKey={1} viewingStepOverride={1}
            ctaSlot={
                <div className="px-6 pb-6 pt-2">
                    <Button type="submit" form="step1-logistics-form" disabled={isSubmitting} className="w-full h-12 rounded-xl font-semibold gap-2">
                        {isSubmitting
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('actions.saving')}</>
                            : <>{t('actions.continue')} <ChevronRight className="w-4 h-4" /></>}
                    </Button>
                </div>
            }
        >
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Globe className="w-4 h-4 text-primary" /></div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">{t('logistics.title')}</h1>
                </div>
                <p className="text-sm text-slate-500">{t('logistics.description')}</p>
            </div>

            {apiError && <div role="alert" className="mx-6 mt-4 p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">{apiError}</div>}

            <form id="step1-logistics-form" onSubmit={handleSubmit(onSubmit)} className="px-6 pt-5 pb-6 space-y-6" noValidate>
                {/* Coverage Regions */}
                <section>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('logistics.coverageTitle')} <span className="text-red-500">*</span></p>
                    <p className="text-xs text-slate-400 mb-3">{t('logistics.coverageHint')}</p>
                    <div role="group" aria-label={t('logistics.coverageGroupLabel')} className="grid grid-cols-2 gap-2">
                        {regions.map(({ key, label }) => {
                            const isChecked = (selectedAreas ?? []).includes(key);
                            return (
                                <label key={key} htmlFor={`region-${key}`} className={cn(
                                    'flex items-center gap-2.5 rounded-lg border-2 px-3 py-2.5 cursor-pointer transition-all duration-150',
                                    isChecked ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300',
                                )}>
                                    <Checkbox id={`region-${key}`} checked={isChecked} onCheckedChange={c => toggleRegion(key, !!c)} />
                                    <span className={cn('text-sm font-medium', isChecked ? 'text-primary' : 'text-slate-700 dark:text-slate-300')}>{label}</span>
                                </label>
                            );
                        })}
                    </div>
                    {errors.coverage_areas && <p className="text-xs text-red-500 mt-2" role="alert">{errors.coverage_areas.message}</p>}
                </section>

                {/* HQ Addresses */}
                <section className="border-t border-slate-100 dark:border-zinc-800 pt-5">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('logistics.headquarters')} <span className="text-red-500">*</span></p>
                        <Button type="button" variant="ghost" size="sm" onClick={() => append({ ...EMPTY_HQ })} className="h-7 text-xs gap-1 text-primary hover:text-primary/80">
                            <Plus className="w-3 h-3" /> {t('logistics.addAddress')}
                        </Button>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">{t('logistics.addressesHint')}</p>
                    {errors.headquarters_addresses && !Array.isArray(errors.headquarters_addresses) && (
                        <p className="text-xs text-red-500 mb-3" role="alert">{errors.headquarters_addresses.message}</p>
                    )}
                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <HQAddressCard key={field.id} index={index} isPrimary={index === 0}
                                canRemove={fields.length > 1} control={control} register={register}
                                watch={watch} setValue={setValue} errors={errors}
                                onRemove={() => remove(index)} />
                        ))}
                    </div>
                </section>
            </form>
        </OnboardingLayout>
    );
}

interface HQAddressCardProps {
    index: number; isPrimary: boolean; canRemove: boolean;
    control: ReturnType<typeof useForm<LogisticsFormValues>>['control'];
    register: ReturnType<typeof useForm<LogisticsFormValues>>['register'];
    watch: ReturnType<typeof useForm<LogisticsFormValues>>['watch'];
    setValue: ReturnType<typeof useForm<LogisticsFormValues>>['setValue'];
    errors: ReturnType<typeof useForm<LogisticsFormValues>>['formState']['errors'];
    onRemove: () => void;
}

function HQAddressCard({ index, isPrimary, canRemove, control, register, watch, setValue, errors, onRemove }: HQAddressCardProps) {
    const { t } = useTranslation(['onboarding', 'common']);
    const addrErrors = errors.headquarters_addresses?.[index];
    const geo = watch(`headquarters_addresses.${index}.geo`);
    const region = watch(`headquarters_addresses.${index}.region`);
    const city = watch(`headquarters_addresses.${index}.city`);

    /**
     * Selecting a candidate is what makes this entry storable — and what fills it
     * in. Region, city and the street line all come off the resolved components,
     * so the agency only types a label and a phone. The manual inputs below
     * appear only when the provider returned no city / region to read.
     */
    const applyGeo = (address: GeoAddress) => {
        const opts = { shouldValidate: true } as const;
        setValue(`headquarters_addresses.${index}.geo`, address, opts);
        setValue(`headquarters_addresses.${index}.region`, address.components.region?.trim() ?? '', opts);
        setValue(`headquarters_addresses.${index}.city`, address.components.city?.trim() ?? '', opts);
        setValue(
            `headquarters_addresses.${index}.address_description`,
            (address.components.street?.trim() || address.formatted_address).slice(0, 200),
            opts,
        );
    };

    return (
        <div className={cn('rounded-xl border-2 overflow-hidden', isPrimary ? 'border-primary/25' : 'border-slate-200 dark:border-zinc-700')}>
            <div className={cn('flex items-center justify-between px-4 py-2.5', isPrimary ? 'bg-primary/5 dark:bg-primary/10' : 'bg-slate-100/60 dark:bg-zinc-800')}>
                <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span className={cn('text-xs font-semibold', isPrimary ? 'text-primary' : 'text-slate-500')}>
                        {isPrimary
                            ? t('logistics.primaryHeadquarters')
                            : t('logistics.branchAddress', { number: index + 1 })}
                    </span>
                </div>
                {canRemove && (
                    <button type="button" onClick={onRemove} aria-label={t('common:actions.remove')} className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 space-y-4">
                <FieldRow label={t('logistics.findLocation')} required error={addrErrors?.geo?.message}>
                    <Controller control={control} name={`headquarters_addresses.${index}.geo`} render={({ field }) => (
                        <AddressSearchInput
                            value={field.value ?? null}
                            country={AGENCY_COUNTRY.toLowerCase()}
                            hasError={!!addrErrors?.geo}
                            placeholder={t('logistics.searchPlaceholder')}
                            onSelect={applyGeo}
                            onClear={() => field.onChange(null)}
                        />
                    )} />
                    <p className="text-[11px] text-slate-400">{t('logistics.pinHint')}</p>
                </FieldRow>

                <FieldRow label={t('logistics.label')} required error={addrErrors?.label?.message}>
                    <IconInput icon={Tag} type="text" placeholder={t('logistics.labelPlaceholder')}
                        maxLength={50} hasError={!!addrErrors?.label}
                        {...register(`headquarters_addresses.${index}.label`)} />
                </FieldRow>

                <FieldRow label={t('logistics.street')} required error={addrErrors?.address_description?.message}>
                    <IconInput icon={MapPin} type="text" placeholder={t('logistics.streetPlaceholder')}
                        hasError={!!addrErrors?.address_description}
                        {...register(`headquarters_addresses.${index}.address_description`)} />
                    {geo && (city || region) && (
                        <p className="text-[11px] text-slate-400">
                            {t('logistics.readFromMap', {
                                place: [city, region].filter(Boolean).join(', '),
                            })}
                        </p>
                    )}
                </FieldRow>

                {/* City / region are geo-derived. They only become inputs when the
                    provider returned neither — the backend still requires both. */}
                {geo && !city && (
                    <FieldRow label={t('logistics.city')} optional error={addrErrors?.city?.message}>
                        <IconInput icon={MapPin} type="text" placeholder={t('logistics.cityPlaceholder')} maxLength={100}
                            hasError={!!addrErrors?.city}
                            {...register(`headquarters_addresses.${index}.city`)} />
                        <p className="text-[11px] text-slate-400">{t('logistics.cityNotNamed')}</p>
                    </FieldRow>
                )}

                {geo && !region && (
                    <FieldRow label={t('logistics.region')} optional error={addrErrors?.region?.message}>
                        <IconInput icon={MapPin} type="text" placeholder={t('logistics.regionPlaceholder')} maxLength={100}
                            hasError={!!addrErrors?.region}
                            {...register(`headquarters_addresses.${index}.region`)} />
                        <p className="text-[11px] text-slate-400">{t('logistics.regionNotNamed')}</p>
                    </FieldRow>
                )}

                <div className="border-t border-dashed border-slate-200 dark:border-zinc-700 pt-3 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('logistics.locationContact')}</p>
                    <FieldRow label={t('logistics.phone')} required error={addrErrors?.support_contact?.phone?.message}>
                        <IconInput icon={Phone} type="tel" inputMode="tel" placeholder={t('logistics.phonePlaceholder')}
                            hasError={!!addrErrors?.support_contact?.phone}
                            {...register(`headquarters_addresses.${index}.support_contact.phone`)} />
                    </FieldRow>
                    <FieldRow label={t('logistics.email')} optional error={addrErrors?.support_contact?.email?.message}>
                        <IconInput icon={Mail} type="email" inputMode="email" placeholder={t('logistics.emailPlaceholder')}
                            hasError={!!addrErrors?.support_contact?.email}
                            {...register(`headquarters_addresses.${index}.support_contact.email`)} />
                    </FieldRow>
                </div>
            </div>
        </div>
    );
}
