import { useCallback, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ChevronRight, Plus, Trash2, MapPin, Globe, Phone, Mail, Building } from 'lucide-react';
import { toast } from 'sonner';
import { OnboardingLayout, selectTriggerClass } from '@/onboarding/OnboardingLayout';
import { logisticsSchema, type LogisticsFormValues } from '@/onboarding/schemas/onboarding.schemas';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError } from '@/types/api';
import { cn } from '@/lib/utils';
import locationsData from '@/constants/locations.json';

type RegionEntry = { key: string; label: string; cities: string[] };

const REGIONS: RegionEntry[] = Object.entries(locationsData.countries.cm.regions).map(([key, val]) => ({
    key, label: val.name.en, cities: val.cities,
}));

function getCities(regionLabel: string) {
    return REGIONS.find(r => r.label === regionLabel || r.key === regionLabel.toLowerCase().replace(/\s/g, '_'))?.cities ?? [];
}

const EMPTY_HQ = { region: '', city: '', address_description: '', support_contact: { phone: '', email: '' } };

function FieldRow({ label, required, optional, error, children }: { label: string; required?: boolean; optional?: boolean; error?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                {optional && <span className="text-slate-400 normal-case font-normal ml-1">(optional)</span>}
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
    const { submitLogistics, isSubmitting, session, drafts, saveDraft } = useOnboarding();
    const [apiError, setApiError] = useState<string | null>(null);

    const roleEntity = session?.role_entity;
    // Draft takes precedence over session data — it contains the last form values
    // the user actually typed, saved synchronously before each API call.
    const draft = drafts.logistics;

    const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<LogisticsFormValues>({
        resolver: zodResolver(logisticsSchema),
        defaultValues: {
            coverage_areas: draft?.coverage_areas ?? roleEntity?.coverage_areas ?? [],
            headquarters_addresses: draft?.headquarters_addresses ?? (
                roleEntity?.headquarters_addresses?.length
                    ? roleEntity.headquarters_addresses.map(addr => ({
                        region: addr.region,
                        city: addr.city,
                        address_description: addr.address_description,
                        support_contact: {
                            phone: addr.support_contact.phone,
                            email: addr.support_contact.email ?? '',
                        },
                    }))
                    : [{ ...EMPTY_HQ }]
            ),
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
                coverage_areas: values.coverage_areas,
                headquarters_addresses: values.headquarters_addresses.map(addr => {
                    const { email, ...rest } = addr.support_contact;
                    const validEmail = email?.trim() || undefined;
                    return { ...addr, support_contact: { ...rest, ...(validEmail ? { email: validEmail } : {}) } };
                }),
                version: roleEntity?.version,
            });
            toast.success('Logistics setup saved!');
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.isConcurrentModification) setApiError('Profile was modified elsewhere. Please refresh and try again.');
                else if (err.isValidation && err.details) setApiError(Object.values(err.details)[0]?.[0] ?? err.message);
                else setApiError(err.isServer ? 'Server error. Please try again.' : err.message);
            }
        }
    }, [submitLogistics, roleEntity]);

    return (
        <OnboardingLayout stepKey={1} viewingStepOverride={1}
            ctaSlot={
                <div className="px-6 pb-6 pt-2">
                    <Button type="submit" form="step1-logistics-form" disabled={isSubmitting} className="w-full h-12 rounded-xl font-semibold gap-2">
                        {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <>Continue <ChevronRight className="w-4 h-4" /></>}
                    </Button>
                </div>
            }
        >
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Globe className="w-4 h-4 text-primary" /></div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">Logistics Setup</h1>
                </div>
                <p className="text-sm text-slate-500">Select your coverage regions and set up your headquarters address(es).</p>
            </div>

            {apiError && <div role="alert" className="mx-6 mt-4 p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">{apiError}</div>}

            <form id="step1-logistics-form" onSubmit={handleSubmit(onSubmit)} className="px-6 pt-5 pb-6 space-y-6" noValidate>
                {/* Coverage Regions */}
                <section>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Coverage Regions <span className="text-red-500">*</span></p>
                    <p className="text-xs text-slate-400 mb-3">Select every region your agency can deliver to.</p>
                    <div role="group" aria-label="Coverage regions" className="grid grid-cols-2 gap-2">
                        {REGIONS.map(({ key, label }) => {
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
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Headquarters <span className="text-red-500">*</span></p>
                        <Button type="button" variant="ghost" size="sm" onClick={() => append({ ...EMPTY_HQ })} className="h-7 text-xs gap-1 text-primary hover:text-primary/80">
                            <Plus className="w-3 h-3" /> Add address
                        </Button>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">The first address is your primary headquarters.</p>
                    {errors.headquarters_addresses && !Array.isArray(errors.headquarters_addresses) && (
                        <p className="text-xs text-red-500 mb-3" role="alert">{errors.headquarters_addresses.message}</p>
                    )}
                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <HQAddressCard key={field.id} index={index} isPrimary={index === 0}
                                canRemove={fields.length > 1} control={control} register={register}
                                watch={watch} setValue={setValue} errors={errors}
                                availableRegions={REGIONS.filter(r => (selectedAreas ?? []).includes(r.key))}
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
    availableRegions: RegionEntry[]; onRemove: () => void;
}

function HQAddressCard({ index, isPrimary, canRemove, control, register, watch, setValue, errors, availableRegions, onRemove }: HQAddressCardProps) {
    const addrErrors = errors.headquarters_addresses?.[index];
    const selectedRegion = watch(`headquarters_addresses.${index}.region`);
    const cities = getCities(selectedRegion ?? '');

    return (
        <div className={cn('rounded-xl border-2 overflow-hidden', isPrimary ? 'border-primary/25' : 'border-slate-200 dark:border-zinc-700')}>
            <div className={cn('flex items-center justify-between px-4 py-2.5', isPrimary ? 'bg-primary/5 dark:bg-primary/10' : 'bg-slate-100/60 dark:bg-zinc-800')}>
                <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span className={cn('text-xs font-semibold', isPrimary ? 'text-primary' : 'text-slate-500')}>
                        {isPrimary ? '★ Primary Headquarters' : `Branch Address ${index + 1}`}
                    </span>
                </div>
                {canRemove && (
                    <button type="button" onClick={onRemove} aria-label="Remove" className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 space-y-4">
                <FieldRow label="Region" required error={addrErrors?.region?.message}>
                    <Controller control={control} name={`headquarters_addresses.${index}.region`} render={({ field }) => (
                        <Select value={field.value} onValueChange={v => { field.onChange(v); setValue(`headquarters_addresses.${index}.city`, '', { shouldValidate: false }); }}>
                            <SelectTrigger className={selectTriggerClass(!!addrErrors?.region)}>
                                <div className="flex items-center gap-2 text-sm">
                                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <SelectValue placeholder="Select region" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                {availableRegions.length === 0
                                    ? <div className="py-3 text-xs text-slate-400 text-center px-4">Select coverage regions above first</div>
                                    : availableRegions.map(({ label }) => <SelectItem key={label} value={label}>{label}</SelectItem>)
                                }
                            </SelectContent>
                        </Select>
                    )} />
                </FieldRow>

                <FieldRow label="City" required error={addrErrors?.city?.message}>
                    <Controller control={control} name={`headquarters_addresses.${index}.city`} render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange} disabled={!selectedRegion || cities.length === 0}>
                            <SelectTrigger className={selectTriggerClass(!!addrErrors?.city)}>
                                <SelectValue placeholder={!selectedRegion ? 'Select a region first' : 'Select city'} />
                            </SelectTrigger>
                            <SelectContent>
                                {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )} />
                </FieldRow>

                <FieldRow label="Street Address" required error={addrErrors?.address_description?.message}>
                    <IconInput icon={MapPin} type="text" placeholder="e.g. Akwa, Rue Sylvani, 3rd floor"
                        hasError={!!addrErrors?.address_description}
                        {...register(`headquarters_addresses.${index}.address_description`)} />
                </FieldRow>

                <div className="border-t border-dashed border-slate-200 dark:border-zinc-700 pt-3 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Location Contact</p>
                    <FieldRow label="Phone" required error={addrErrors?.support_contact?.phone?.message}>
                        <IconInput icon={Phone} type="tel" inputMode="tel" placeholder="+237 6XX XXX XXX"
                            hasError={!!addrErrors?.support_contact?.phone}
                            {...register(`headquarters_addresses.${index}.support_contact.phone`)} />
                    </FieldRow>
                    <FieldRow label="Email" optional error={addrErrors?.support_contact?.email?.message}>
                        <IconInput icon={Mail} type="email" inputMode="email" placeholder="support@youragency.com"
                            hasError={!!addrErrors?.support_contact?.email}
                            {...register(`headquarters_addresses.${index}.support_contact.email`)} />
                    </FieldRow>
                </div>
            </div>
        </div>
    );
}
