import { useCallback, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Loader2,
    ChevronRight,
    ChevronLeft,
    ShieldCheck,
    DollarSign,
    RotateCcw,
    AlertTriangle,
    Banknote,
} from 'lucide-react';
import { toast } from 'sonner';
import { OnboardingLayout, selectTriggerClass } from '@/onboarding/OnboardingLayout';
import { buildPoliciesSchema, type PoliciesFormValues } from '@/onboarding/schemas/onboarding.schemas';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { InfoHint } from '@/components/common/InfoHint';
import { ApiError } from '@/types/api';
import { getApiErrorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { tx } from '@/i18n/tx';
import { cn } from '@/lib/utils';

// ─── Reusable field row ───────────────────────────────────────────────────────

function FieldRow({
    label,
    hint,
    error,
    info,
    children,
}: {
    label: string;
    hint?: string;
    error?: string;
    info?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
                <label className="block text-xs font-semibold text-muted-foreground tracking-wide">
                    {label}
                </label>
                {info && <InfoHint>{info}</InfoHint>}
            </div>
            {children}
            {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
            {error && (
                <p className="text-xs text-destructive mt-1" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

// ─── Currency / number inputs ─────────────────────────────────────────────────

function FeeInput({
    placeholder,
    error,
    ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
    return (
        <input
            type="number"
            min={0}
            step="any"
            placeholder={placeholder ?? '0'}
            className={cn(
                'w-full px-3 h-11 rounded-lg border text-sm bg-muted',
                'border-border text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
                error && 'border-destructive focus:ring-destructive/30 focus:border-destructive',
            )}
            {...props}
        />
    );
}

function DaysInput({
    placeholder,
    error,
    ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
    return (
        <input
            type="number"
            min={0}
            step={1}
            placeholder={placeholder ?? '0'}
            className={cn(
                'w-full px-3 h-11 rounded-lg border text-sm bg-muted',
                'border-border text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
                error && 'border-destructive focus:ring-destructive/30 focus:border-destructive',
            )}
            {...props}
        />
    );
}

function NotesArea({ error, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
    return (
        <textarea
            rows={2}
            className={cn(
                'w-full rounded-lg border px-3 py-2 text-sm resize-none bg-muted',
                'border-border text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
                'placeholder:text-muted-foreground transition-colors duration-150',
                error && 'border-destructive',
            )}
            {...props}
        />
    );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
    icon: Icon,
    title,
    children,
}: {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
}) {
    // A bordered card with a tinted title band from `md` up. On a phone the
    // section sits flat on the page, the band is a plain title row, and the
    // form's `max-md:divide-y` draws the rule between sections — so a Section
    // must stay a DIRECT child of the form.
    return (
        <div className="max-md:py-5 max-md:first:pt-0 max-md:last:pb-0 md:rounded-xl md:border-2 md:border-border md:overflow-hidden md:shadow-sm">
            <div className="flex items-center gap-2 max-md:pb-3 md:px-4 md:py-3 md:bg-muted/80 md:border-b md:border-border">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
            </div>
            <div className="space-y-4 md:p-4 md:bg-card">{children}</div>
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Step4Policies() {
    const { t } = useTranslation(['onboarding', 'common']);
    const { submitPolicies, isSubmitting, goBack, session, drafts, saveDraft } = useOnboarding();
    const [apiError, setApiError] = useState<string | null>(null);
    // Rebuilt on a language switch so validation messages follow the UI.
    const schema = useMemo(() => buildPoliciesSchema(t), [t]);

    /** Shorthand for the ⓘ copy under `onboarding:policies.info.*`. */
    const info = useCallback((key: string) => tx(t, `policies.info.${key}`), [t]);

    const roleEntity = session?.role_entity;
    const draft = drafts.policies;
    const existing = roleEntity?.policies;

    const {
        register,
        handleSubmit,
        control,
        watch,
        formState: { errors },
    } = useForm<PoliciesFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(schema) as any,
        defaultValues: {
            pricing: {
                storage_based: {
                    enabled: draft?.pricing?.storage_based?.enabled ?? existing?.pricing?.storage_based?.enabled ?? true,
                    monthly_storage_fee_per_sku: draft?.pricing?.storage_based?.monthly_storage_fee_per_sku ?? existing?.pricing?.storage_based?.monthly_storage_fee_per_sku ?? undefined,
                    pick_pack_fee_per_order: draft?.pricing?.storage_based?.pick_pack_fee_per_order ?? existing?.pricing?.storage_based?.pick_pack_fee_per_order ?? undefined,
                    local_delivery_fee: draft?.pricing?.storage_based?.local_delivery_fee ?? existing?.pricing?.storage_based?.local_delivery_fee ?? undefined,
                    out_of_region_delivery_fee: draft?.pricing?.storage_based?.out_of_region_delivery_fee ?? existing?.pricing?.storage_based?.out_of_region_delivery_fee ?? undefined,
                },
                pickup_based: {
                    enabled: draft?.pricing?.pickup_based?.enabled ?? existing?.pricing?.pickup_based?.enabled ?? true,
                    base_rate_first_kg: draft?.pricing?.pickup_based?.base_rate_first_kg ?? existing?.pricing?.pickup_based?.base_rate_first_kg ?? undefined,
                    additional_per_kg: draft?.pricing?.pickup_based?.additional_per_kg ?? existing?.pricing?.pickup_based?.additional_per_kg ?? undefined,
                    out_of_region_surcharge: draft?.pricing?.pickup_based?.out_of_region_surcharge ?? existing?.pricing?.pickup_based?.out_of_region_surcharge ?? undefined,
                },
                additional_fees: {
                    cod_handling_fee: {
                        type: draft?.pricing?.additional_fees?.cod_handling_fee?.type ?? existing?.pricing?.additional_fees?.cod_handling_fee?.type ?? 'percentage',
                        value: draft?.pricing?.additional_fees?.cod_handling_fee?.value ?? existing?.pricing?.additional_fees?.cod_handling_fee?.value ?? undefined,
                    },
                    failed_delivery_fee: draft?.pricing?.additional_fees?.failed_delivery_fee ?? existing?.pricing?.additional_fees?.failed_delivery_fee ?? undefined,
                    rto_fee: draft?.pricing?.additional_fees?.rto_fee ?? existing?.pricing?.additional_fees?.rto_fee ?? undefined,
                    peak_season_surcharge: draft?.pricing?.additional_fees?.peak_season_surcharge ?? existing?.pricing?.additional_fees?.peak_season_surcharge ?? undefined,
                },
                notes: draft?.pricing?.notes ?? existing?.pricing?.notes ?? '',
            },
            returns: {
                payer: draft?.returns?.payer ?? existing?.returns?.payer ?? 'vendor',
                handling_fee: draft?.returns?.handling_fee ?? existing?.returns?.handling_fee ?? undefined,
                return_window_days: draft?.returns?.return_window_days ?? existing?.returns?.return_window_days ?? undefined,
                notes: draft?.returns?.notes ?? existing?.returns?.notes ?? '',
            },
            damage: {
                claim_deadline_days: draft?.damage?.claim_deadline_days ?? existing?.damage?.claim_deadline_days ?? undefined,
                max_refund_per_item: draft?.damage?.max_refund_per_item ?? existing?.damage?.max_refund_per_item ?? undefined,
                notes: draft?.damage?.notes ?? existing?.damage?.notes ?? '',
            },
            cod: {
                enabled: draft?.cod?.enabled ?? existing?.cod?.enabled ?? false,
                max_order_amount: draft?.cod?.max_order_amount ?? existing?.cod?.max_order_amount ?? null,
            },
        },
    });

    const storageEnabled = watch('pricing.storage_based.enabled');
    const pickupEnabled = watch('pricing.pickup_based.enabled');
    const codEnabled = watch('cod.enabled');

    const handleSave = useCallback(
        async (values: PoliciesFormValues) => {
            setApiError(null);
            saveDraft(4, values);
            try {
                await submitPolicies({
                    policies: {
                        pricing: values.pricing,
                        returns: values.returns,
                        damage: values.damage,
                        cod: values.cod,
                    },
                    version: roleEntity?.version,
                });
                toast.success(t('policies.saved'));
            } catch (err) {
                if (err instanceof ApiError) {
                    setApiError(err.isServer ? t('errors.server') : getApiErrorMessage(err));
                }
            }
        },
        [submitPolicies, saveDraft, roleEntity?.version, t],
    );

    const pe = errors.pricing;
    const re = errors.returns;
    const de = errors.damage;

    // Cross-field error: both models disabled
    const bothDisabledError =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pe as any)?.storage_based?.enabled?.message as string | undefined;

    return (
        <OnboardingLayout
            stepKey={4}
            ctaSlot={
                <div className="md:px-6 md:pb-6 md:pt-2">
                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => goBack(4)}
                            disabled={isSubmitting}
                            className="h-12 w-24 rounded-xl font-semibold gap-1.5 border-input text-muted-foreground"
                        >
                            <ChevronLeft className="w-4 h-4" /> {t('actions.back')}
                        </Button>
                        <Button
                            type="submit"
                            form="step4-policies-form"
                            disabled={isSubmitting}
                            className="flex-1 h-12 rounded-xl font-semibold gap-2"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> {t('actions.saving')}</>
                            ) : (
                                <>{t('actions.saveAndFinish')} <ChevronRight className="w-4 h-4" /></>
                            )}
                        </Button>
                    </div>
                </div>
            }
        >
            {/* Header */}
            <div className="md:px-6 md:pt-6 pb-4 border-b border-border/60">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                    </div>
                    <h1 className="text-lg font-bold text-foreground">{t('policies.title')}</h1>
                </div>
                <p className="text-sm text-muted-foreground">{t('policies.description')}</p>
            </div>

            {apiError && (
                <div
                    role="alert"
                    className="mt-4 p-3 md:mx-6 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/30"
                >
                    {apiError}
                </div>
            )}

            <form
                id="step4-policies-form"
                onSubmit={handleSubmit(handleSave)}
                className="md:px-6 pt-5 pb-6 max-md:divide-y md:space-y-8"
                noValidate
            >
                {/* ── Pricing ── */}
                <Section icon={DollarSign} title={t('policies.pricingSection')}>
                    <p className="text-xs text-muted-foreground -mt-1">{t('policies.pricingHint')}</p>

                    {bothDisabledError && (
                        <p className="text-xs text-destructive" role="alert">{bothDisabledError}</p>
                    )}

                    {/* Storage-based */}
                    <div className="space-y-3">
                        <Controller
                            control={control}
                            name="pricing.storage_based.enabled"
                            render={({ field }) => (
                                <div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                            {t('policies.storageToggle')}
                                        </p>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={!pickupEnabled}
                                            className="data-[state=checked]:bg-primary disabled:opacity-40 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        {t('policies.storageHint')}
                                        {!pickupEnabled && (
                                            <span className="ms-1 text-warning">{t('policies.storageLocked')}</span>
                                        )}
                                    </p>
                                </div>
                            )}
                        />

                        {storageEnabled && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <FieldRow
                                    label={t('policies.monthlyStorageFee')}
                                    info={info('monthlyStorageFee')}
                                    error={pe?.storage_based?.monthly_storage_fee_per_sku?.message}
                                >
                                    <FeeInput
                                        error={!!pe?.storage_based?.monthly_storage_fee_per_sku}
                                        {...register('pricing.storage_based.monthly_storage_fee_per_sku')}
                                    />
                                </FieldRow>
                                <FieldRow
                                    label={t('policies.pickPackFee')}
                                    info={info('pickPackFee')}
                                    error={pe?.storage_based?.pick_pack_fee_per_order?.message}
                                >
                                    <FeeInput
                                        error={!!pe?.storage_based?.pick_pack_fee_per_order}
                                        {...register('pricing.storage_based.pick_pack_fee_per_order')}
                                    />
                                </FieldRow>
                                <FieldRow
                                    label={t('policies.localDeliveryFee')}
                                    info={info('localDeliveryFee')}
                                    error={pe?.storage_based?.local_delivery_fee?.message}
                                >
                                    <FeeInput
                                        error={!!pe?.storage_based?.local_delivery_fee}
                                        {...register('pricing.storage_based.local_delivery_fee')}
                                    />
                                </FieldRow>
                                <FieldRow
                                    label={t('policies.outOfRegionDeliveryFee')}
                                    info={info('outOfRegionDeliveryFee')}
                                    error={pe?.storage_based?.out_of_region_delivery_fee?.message}
                                >
                                    <FeeInput
                                        error={!!pe?.storage_based?.out_of_region_delivery_fee}
                                        {...register('pricing.storage_based.out_of_region_delivery_fee')}
                                    />
                                </FieldRow>
                            </div>
                        )}
                    </div>

                    {/* Pickup-based */}
                    <div className="space-y-3 border-t border-border/60 pt-4">
                        <Controller
                            control={control}
                            name="pricing.pickup_based.enabled"
                            render={({ field }) => (
                                <div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                            {t('policies.pickupToggle')}
                                        </p>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={!storageEnabled}
                                            className="data-[state=checked]:bg-primary disabled:opacity-40 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        {t('policies.pickupHint')}
                                        {!storageEnabled && (
                                            <span className="ms-1 text-warning">{t('policies.pickupLocked')}</span>
                                        )}
                                    </p>
                                </div>
                            )}
                        />

                        {pickupEnabled && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <FieldRow
                                    label={t('policies.baseRateFirstKg')}
                                    info={info('baseRateFirstKg')}
                                    error={pe?.pickup_based?.base_rate_first_kg?.message}
                                >
                                    <FeeInput
                                        error={!!pe?.pickup_based?.base_rate_first_kg}
                                        {...register('pricing.pickup_based.base_rate_first_kg')}
                                    />
                                </FieldRow>
                                <FieldRow
                                    label={t('policies.additionalPerKg')}
                                    info={info('additionalPerKg')}
                                    error={pe?.pickup_based?.additional_per_kg?.message}
                                >
                                    <FeeInput
                                        error={!!pe?.pickup_based?.additional_per_kg}
                                        {...register('pricing.pickup_based.additional_per_kg')}
                                    />
                                </FieldRow>
                                <FieldRow
                                    label={t('policies.outOfRegionSurcharge')}
                                    info={info('outOfRegionSurcharge')}
                                    error={pe?.pickup_based?.out_of_region_surcharge?.message}
                                >
                                    <FeeInput
                                        error={!!pe?.pickup_based?.out_of_region_surcharge}
                                        {...register('pricing.pickup_based.out_of_region_surcharge')}
                                    />
                                </FieldRow>
                            </div>
                        )}
                    </div>

                    {/* Additional fees */}
                    <div className="space-y-3 border-t border-border/60 pt-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            {t('policies.additionalFees')}
                        </p>
                        <p className="text-[11px] text-muted-foreground -mt-1">
                            {t('policies.additionalFeesHint')}
                        </p>

                        {/* COD handling fee — boxed from `md` up, flat on a phone. */}
                        <div className="space-y-3 md:rounded-lg md:border md:border-border md:p-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold text-muted-foreground">
                                    {t('policies.codHandlingFee')}
                                </p>
                                <InfoHint>{t('policies.codHandlingFeeInfo')}</InfoHint>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FieldRow
                                    label={t('policies.type')}
                                    info={info('codFeeType')}
                                    error={pe?.additional_fees?.cod_handling_fee?.type?.message}
                                >
                                    <Controller
                                        control={control}
                                        name="pricing.additional_fees.cod_handling_fee.type"
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className={selectTriggerClass(!!pe?.additional_fees?.cod_handling_fee?.type)}>
                                                    <SelectValue placeholder={t('policies.typePlaceholder')} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="percentage">{t('policies.typePercentage')}</SelectItem>
                                                    <SelectItem value="fixed">{t('policies.typeFixed')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </FieldRow>
                                <FieldRow
                                    label={t('policies.value')}
                                    info={info('codFeeValue')}
                                    error={pe?.additional_fees?.cod_handling_fee?.value?.message}
                                >
                                    <FeeInput
                                        placeholder={t('policies.valuePlaceholder')}
                                        error={!!pe?.additional_fees?.cod_handling_fee?.value}
                                        {...register('pricing.additional_fees.cod_handling_fee.value')}
                                    />
                                </FieldRow>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            <FieldRow
                                label={t('policies.failedDeliveryFee')}
                                info={info('failedDeliveryFee')}
                                error={pe?.additional_fees?.failed_delivery_fee?.message}
                            >
                                <FeeInput
                                    error={!!pe?.additional_fees?.failed_delivery_fee}
                                    {...register('pricing.additional_fees.failed_delivery_fee')}
                                />
                            </FieldRow>
                            <FieldRow
                                label={t('policies.rtoFee')}
                                info={info('rtoFee')}
                                error={pe?.additional_fees?.rto_fee?.message}
                            >
                                <FeeInput
                                    error={!!pe?.additional_fees?.rto_fee}
                                    {...register('pricing.additional_fees.rto_fee')}
                                />
                            </FieldRow>
                            <FieldRow
                                label={t('policies.peakSeasonSurcharge')}
                                info={info('peakSeasonSurcharge')}
                                hint={t('policies.peakSeasonHint')}
                                error={pe?.additional_fees?.peak_season_surcharge?.message}
                            >
                                <FeeInput
                                    placeholder="0"
                                    error={!!pe?.additional_fees?.peak_season_surcharge}
                                    {...register('pricing.additional_fees.peak_season_surcharge')}
                                />
                            </FieldRow>
                        </div>
                    </div>

                    <FieldRow label={t('policies.notes')} error={pe?.notes?.message}>
                        <NotesArea
                            placeholder={t('policies.pricingNotesPlaceholder')}
                            error={!!pe?.notes}
                            {...register('pricing.notes')}
                        />
                    </FieldRow>
                </Section>

                {/* ── Cash on Delivery eligibility ── */}
                <Section icon={Banknote} title={t('policies.codSection')}>
                    <Controller
                        control={control}
                        name="cod.enabled"
                        render={({ field }) => (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-medium text-foreground">
                                        {t('policies.codToggle')}
                                    </p>
                                    <InfoHint>{info('codEnabled')}</InfoHint>
                                </div>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="data-[state=checked]:bg-primary"
                                />
                            </div>
                        )}
                    />

                    {codEnabled && (
                        <div className="border-t border-border/60 pt-4">
                            <FieldRow
                                label={t('policies.codMaxAmount')}
                                info={info('codMaxAmount')}
                                hint={t('policies.codMaxAmountHint')}
                                error={errors.cod?.max_order_amount?.message}
                            >
                                <FeeInput
                                    placeholder={t('policies.codMaxAmountPlaceholder')}
                                    error={!!errors.cod?.max_order_amount}
                                    {...register('cod.max_order_amount')}
                                />
                            </FieldRow>
                        </div>
                    )}
                </Section>

                {/* ── Returns ── */}
                <Section icon={RotateCcw} title={t('policies.returnsSection')}>
                    <FieldRow
                        label={t('policies.returnsPayer')}
                        info={info('returnsPayer')}
                        error={re?.payer?.message}
                    >
                        <Controller
                            control={control}
                            name="returns.payer"
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger className={selectTriggerClass(!!re?.payer)}>
                                        <SelectValue placeholder={t('policies.returnsPayerPlaceholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="vendor">{t('policies.payerVendor')}</SelectItem>
                                        <SelectItem value="agency">{t('policies.payerAgency')}</SelectItem>
                                        <SelectItem value="customer">{t('policies.payerCustomer')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </FieldRow>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-t border-border/60 pt-4">
                        <FieldRow
                            label={t('policies.handlingFee')}
                            info={info('handlingFee')}
                            error={re?.handling_fee?.message}
                        >
                            <FeeInput
                                error={!!re?.handling_fee}
                                {...register('returns.handling_fee')}
                            />
                        </FieldRow>
                        <FieldRow
                            label={t('policies.returnWindow')}
                            info={info('returnWindow')}
                            error={re?.return_window_days?.message}
                        >
                            <DaysInput
                                placeholder="7"
                                error={!!re?.return_window_days}
                                {...register('returns.return_window_days')}
                            />
                        </FieldRow>
                    </div>

                    <FieldRow label={t('policies.notes')} error={re?.notes?.message}>
                        <NotesArea
                            placeholder={t('policies.returnsNotesPlaceholder')}
                            error={!!re?.notes}
                            {...register('returns.notes')}
                        />
                    </FieldRow>
                </Section>

                {/* ── Damage ── */}
                <Section icon={AlertTriangle} title={t('policies.damageSection')}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <FieldRow
                            label={t('policies.claimDeadline')}
                            info={info('claimDeadline')}
                            error={de?.claim_deadline_days?.message}
                        >
                            <DaysInput
                                placeholder="7"
                                error={!!de?.claim_deadline_days}
                                {...register('damage.claim_deadline_days')}
                            />
                        </FieldRow>
                        <FieldRow
                            label={t('policies.maxRefundPerItem')}
                            info={info('maxRefundPerItem')}
                            error={de?.max_refund_per_item?.message}
                        >
                            <FeeInput
                                error={!!de?.max_refund_per_item}
                                {...register('damage.max_refund_per_item')}
                            />
                        </FieldRow>
                    </div>

                    {/* Admin-preset fields — read-only display */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-t border-border/60 pt-4">
                        <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {t('policies.inspector')}
                            </p>
                            <div className="flex items-center h-11 px-3 rounded-lg border border-border bg-muted text-sm text-muted-foreground select-none">
                                {t('policies.inspectorValue')}
                            </div>
                            <p className="text-xs text-muted-foreground">{t('policies.setByAdmin')}</p>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {t('policies.investigationFee')}
                            </p>
                            <div className="flex items-center h-11 px-3 rounded-lg border border-border bg-muted text-sm text-muted-foreground select-none">
                                {formatNumber(1000)}
                            </div>
                            <p className="text-xs text-muted-foreground">{t('policies.setByAdmin')}</p>
                        </div>
                    </div>

                    <FieldRow label={t('policies.notes')} error={de?.notes?.message}>
                        <NotesArea
                            placeholder={t('policies.damageNotesPlaceholder')}
                            error={!!de?.notes}
                            {...register('damage.notes')}
                        />
                    </FieldRow>
                </Section>
            </form>
        </OnboardingLayout>
    );
}
