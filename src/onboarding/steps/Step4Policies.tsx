import { useCallback, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { policiesSchema, type PoliciesFormValues } from '@/onboarding/schemas/onboarding.schemas';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { InfoHint } from '@/components/common/InfoHint';
import { ApiError } from '@/types/api';
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
                <label className="block text-xs font-semibold text-slate-500 tracking-wide">
                    {label}
                </label>
                {info && <InfoHint>{info}</InfoHint>}
            </div>
            {children}
            {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
            {error && (
                <p className="text-xs text-red-500 mt-1" role="alert">
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
                'w-full px-3 h-11 rounded-lg border text-sm bg-slate-50 dark:bg-zinc-800',
                'border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400',
                'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
                error && 'border-red-400 focus:ring-red-200 focus:border-red-400',
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
                'w-full px-3 h-11 rounded-lg border text-sm bg-slate-50 dark:bg-zinc-800',
                'border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400',
                'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
                error && 'border-red-400 focus:ring-red-200 focus:border-red-400',
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
                'w-full rounded-lg border px-3 py-2 text-sm resize-none bg-slate-50 dark:bg-zinc-800',
                'border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white',
                'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
                'placeholder:text-slate-400 transition-colors duration-150',
                error && 'border-red-400',
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
    return (
        <div className="rounded-xl border-2 border-slate-200 dark:border-zinc-700 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-100/80 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                <Icon className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{title}</span>
            </div>
            <div className="p-4 bg-white dark:bg-zinc-900 space-y-4">{children}</div>
        </div>
    );
}

// ─── Field info texts ─────────────────────────────────────────────────────────

const INFO = {
    // Storage-based
    monthly_storage_fee_per_sku:
        'Monthly fee per unique product (SKU) stored in your warehouse. Example: 10 SKUs × 500 XAF = 5,000 XAF/month. Leave blank to default to 0.',
    pick_pack_fee_per_order:
        'Fee charged each time you pick, pack, and prepare an order for shipment. Example: 300 XAF per completed order. Leave blank to default to 0.',
    local_delivery_fee:
        'Flat fee for deliveries within your primary coverage region. Example: 1,500 XAF for any order delivered in the same region. Leave blank to default to 0.',
    out_of_region_delivery_fee:
        'Fee for orders shipped outside your primary region. Example: 3,000 XAF for a package sent from Littoral to Centre. Leave blank to default to 0.',
    // Pickup-based
    base_rate_first_kg:
        'Base charge for the first kilogram of any pickup-and-deliver shipment. Example: 1,000 XAF covers any package up to 1 kg. Leave blank to default to 0.',
    additional_per_kg:
        'Extra charge for each kg beyond the first. Example: 200 XAF/kg — a 3 kg parcel costs 1,000 + 400 = 1,400 XAF total. Leave blank to default to 0.',
    out_of_region_surcharge:
        'Surcharge added when a pickup delivery goes outside your primary region. Example: 500 XAF on top of the weight-based rate. Leave blank to default to 0.',
    // Additional fees
    cod_handling_fee_type:
        'How the COD fee is calculated — as a percentage of the order total, or a flat fixed amount in XAF.',
    cod_handling_fee_value:
        'The COD fee amount. For Percentage: enter 2 for 2%. For Fixed: enter the XAF amount (e.g. 500). Leave blank to default to 0.',
    failed_delivery_fee:
        'Fee charged to the vendor when a delivery attempt fails (e.g. customer unavailable or unreachable). Example: 500 XAF per failed attempt. Leave blank to default to 0.',
    rto_fee:
        'Return-to-origin fee charged when a package is sent back to the vendor after all delivery attempts fail. Example: 800 XAF per RTO shipment. Leave blank to default to 0.',
    peak_season_surcharge:
        'Optional extra charge applied during high-demand periods (e.g. December holidays). Example: 200 XAF added to every delivery in that period. Set to 0 if not applicable.',
    // Returns
    payer:
        'Who bears the cost of shipping and processing a returned order. Vendor = merchants pay; Agency = you absorb it; Customer = buyer pays.',
    handling_fee:
        'Fee charged to process each return — covers logistics, inspection, and re-shelving. Example: 500 XAF per returned order. Leave blank to default to 0.',
    return_window_days:
        'How many days after delivery a return request can be accepted. Example: 7 means customers have 7 days from delivery to initiate a return. Leave blank to default to 0.',
    // Damage
    claim_deadline_days:
        'Maximum days after delivery to file a damage claim. Example: 3 means damage must be reported within 3 days of receipt. Leave blank to default to 0.',
    max_refund_per_item:
        'Maximum compensation you will pay per damaged item, regardless of its value. Example: a 10,000 XAF cap means a 50,000 XAF item is refunded up to 10,000 XAF. Leave blank to default to 0.',
    // COD eligibility
    cod_enabled:
        "Whether your agency accepts cash-on-delivery orders at all. When off, customers can't place COD orders whose shipments you would carry. This is separate from the COD handling fee above, which only applies once COD is on.",
    cod_max_order_amount:
        'Optional cap on a single COD order\'s total. Checkout rejects COD orders above this amount. Leave blank for no cap.',
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function Step4Policies() {
    const { submitPolicies, isSubmitting, goBack, session, drafts, saveDraft } = useOnboarding();
    const [apiError, setApiError] = useState<string | null>(null);

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
        resolver: zodResolver(policiesSchema) as any,
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
                toast.success('Policies saved! Setup complete.');
            } catch (err) {
                if (err instanceof ApiError) {
                    setApiError(err.isServer ? 'Server error. Please try again.' : err.message);
                }
            }
        },
        [submitPolicies, saveDraft, roleEntity?.version],
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
            viewingStepOverride={4}
            ctaSlot={
                <div className="px-6 pb-6 pt-2">
                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={goBack}
                            disabled={isSubmitting}
                            className="h-12 w-24 rounded-xl font-semibold gap-1.5 border-slate-300 text-slate-600 dark:border-zinc-600 dark:text-slate-300"
                        >
                            <ChevronLeft className="w-4 h-4" /> Back
                        </Button>
                        <Button
                            type="submit"
                            form="step4-policies-form"
                            disabled={isSubmitting}
                            className="flex-1 h-12 rounded-xl font-semibold gap-2"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                            ) : (
                                <>Save & Finish <ChevronRight className="w-4 h-4" /></>
                            )}
                        </Button>
                    </div>
                </div>
            }
        >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                    </div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">Policy Setup</h1>
                </div>
                <p className="text-sm text-slate-500">
                    Define your pricing, returns, and damage policies for vendors and customers.
                </p>
            </div>

            {apiError && (
                <div
                    role="alert"
                    className="mx-6 mt-4 p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200"
                >
                    {apiError}
                </div>
            )}

            <form
                id="step4-policies-form"
                onSubmit={handleSubmit(handleSave)}
                className="px-6 pt-5 pb-6 space-y-8"
                noValidate
            >
                {/* ── Pricing ── */}
                <Section icon={DollarSign} title="Pricing">
                    <p className="text-xs text-slate-400 -mt-1">
                        Set your rates for each fulfilment model. At least one must be enabled.
                    </p>

                    {bothDisabledError && (
                        <p className="text-xs text-red-500" role="alert">{bothDisabledError}</p>
                    )}

                    {/* Storage-based */}
                    <div className="space-y-3">
                        <Controller
                            control={control}
                            name="pricing.storage_based.enabled"
                            render={({ field }) => (
                                <div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            Storage-based fees
                                        </p>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={!pickupEnabled}
                                            className="data-[state=checked]:bg-primary disabled:opacity-40 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Applies when you warehouse the vendor's stock.
                                        {!pickupEnabled && (
                                            <span className="ml-1 text-amber-500">(Cannot disable — pickup-based is off)</span>
                                        )}
                                    </p>
                                </div>
                            )}
                        />

                        {storageEnabled && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <FieldRow
                                    label="Monthly storage fee / SKU (XAF)"
                                    info={INFO.monthly_storage_fee_per_sku}
                                    error={pe?.storage_based?.monthly_storage_fee_per_sku?.message}
                                >
                                    <FeeInput
                                        error={!!pe?.storage_based?.monthly_storage_fee_per_sku}
                                        {...register('pricing.storage_based.monthly_storage_fee_per_sku')}
                                    />
                                </FieldRow>
                                <FieldRow
                                    label="Pick & pack fee / order (XAF)"
                                    info={INFO.pick_pack_fee_per_order}
                                    error={pe?.storage_based?.pick_pack_fee_per_order?.message}
                                >
                                    <FeeInput
                                        error={!!pe?.storage_based?.pick_pack_fee_per_order}
                                        {...register('pricing.storage_based.pick_pack_fee_per_order')}
                                    />
                                </FieldRow>
                                <FieldRow
                                    label="Local delivery fee (XAF)"
                                    info={INFO.local_delivery_fee}
                                    error={pe?.storage_based?.local_delivery_fee?.message}
                                >
                                    <FeeInput
                                        error={!!pe?.storage_based?.local_delivery_fee}
                                        {...register('pricing.storage_based.local_delivery_fee')}
                                    />
                                </FieldRow>
                                <FieldRow
                                    label="Out-of-region delivery fee (XAF)"
                                    info={INFO.out_of_region_delivery_fee}
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
                    <div className="space-y-3 border-t border-slate-100 dark:border-zinc-800 pt-4">
                        <Controller
                            control={control}
                            name="pricing.pickup_based.enabled"
                            render={({ field }) => (
                                <div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            Pickup-based fees
                                        </p>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={!storageEnabled}
                                            className="data-[state=checked]:bg-primary disabled:opacity-40 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Applies when you collect from the vendor and deliver to the customer.
                                        {!storageEnabled && (
                                            <span className="ml-1 text-amber-500">(Cannot disable — storage-based is off)</span>
                                        )}
                                    </p>
                                </div>
                            )}
                        />

                        {pickupEnabled && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <FieldRow
                                    label="Base rate — first kg (XAF)"
                                    info={INFO.base_rate_first_kg}
                                    error={pe?.pickup_based?.base_rate_first_kg?.message}
                                >
                                    <FeeInput
                                        error={!!pe?.pickup_based?.base_rate_first_kg}
                                        {...register('pricing.pickup_based.base_rate_first_kg')}
                                    />
                                </FieldRow>
                                <FieldRow
                                    label="Additional per kg (XAF)"
                                    info={INFO.additional_per_kg}
                                    error={pe?.pickup_based?.additional_per_kg?.message}
                                >
                                    <FeeInput
                                        error={!!pe?.pickup_based?.additional_per_kg}
                                        {...register('pricing.pickup_based.additional_per_kg')}
                                    />
                                </FieldRow>
                                <FieldRow
                                    label="Out-of-region surcharge (XAF)"
                                    info={INFO.out_of_region_surcharge}
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
                    <div className="space-y-3 border-t border-slate-100 dark:border-zinc-800 pt-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Additional fees
                        </p>
                        <p className="text-[11px] text-slate-400 -mt-1">
                            Applied on top of either active model when conditions apply.
                        </p>

                        {/* COD handling fee */}
                        <div className="rounded-lg border border-slate-200 dark:border-zinc-700 p-3 space-y-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    COD Handling Fee
                                </p>
                                <InfoHint>
                                    Cash on Delivery fee — charged when a customer pays cash upon
                                    delivery. Covers the cost of collecting, handling, and
                                    remitting cash payments.
                                </InfoHint>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FieldRow
                                    label="Type"
                                    info={INFO.cod_handling_fee_type}
                                    error={pe?.additional_fees?.cod_handling_fee?.type?.message}
                                >
                                    <Controller
                                        control={control}
                                        name="pricing.additional_fees.cod_handling_fee.type"
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className={selectTriggerClass(!!pe?.additional_fees?.cod_handling_fee?.type)}>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                                                    <SelectItem value="fixed">Fixed amount (XAF)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </FieldRow>
                                <FieldRow
                                    label="Value"
                                    info={INFO.cod_handling_fee_value}
                                    error={pe?.additional_fees?.cod_handling_fee?.value?.message}
                                >
                                    <FeeInput
                                        placeholder="e.g. 2"
                                        error={!!pe?.additional_fees?.cod_handling_fee?.value}
                                        {...register('pricing.additional_fees.cod_handling_fee.value')}
                                    />
                                </FieldRow>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            <FieldRow
                                label="Failed delivery fee (XAF)"
                                info={INFO.failed_delivery_fee}
                                error={pe?.additional_fees?.failed_delivery_fee?.message}
                            >
                                <FeeInput
                                    error={!!pe?.additional_fees?.failed_delivery_fee}
                                    {...register('pricing.additional_fees.failed_delivery_fee')}
                                />
                            </FieldRow>
                            <FieldRow
                                label="RTO fee (XAF)"
                                info={INFO.rto_fee}
                                error={pe?.additional_fees?.rto_fee?.message}
                            >
                                <FeeInput
                                    error={!!pe?.additional_fees?.rto_fee}
                                    {...register('pricing.additional_fees.rto_fee')}
                                />
                            </FieldRow>
                            <FieldRow
                                label="Peak season surcharge (XAF)"
                                info={INFO.peak_season_surcharge}
                                hint="Optional — set 0 if not applicable"
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

                    <FieldRow label="Notes" error={pe?.notes?.message}>
                        <NotesArea
                            placeholder="Any additional pricing notes…"
                            error={!!pe?.notes}
                            {...register('pricing.notes')}
                        />
                    </FieldRow>
                </Section>

                {/* ── Cash on Delivery eligibility ── */}
                <Section icon={Banknote} title="Cash on Delivery">
                    <Controller
                        control={control}
                        name="cod.enabled"
                        render={({ field }) => (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                        Accept cash-on-delivery orders
                                    </p>
                                    <InfoHint>{INFO.cod_enabled}</InfoHint>
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
                        <div className="border-t border-slate-100 dark:border-zinc-800 pt-4">
                            <FieldRow
                                label="Max COD order amount (XAF)"
                                info={INFO.cod_max_order_amount}
                                hint="Leave blank for no cap"
                                error={errors.cod?.max_order_amount?.message}
                            >
                                <FeeInput
                                    placeholder="No cap"
                                    error={!!errors.cod?.max_order_amount}
                                    {...register('cod.max_order_amount')}
                                />
                            </FieldRow>
                        </div>
                    )}
                </Section>

                {/* ── Returns ── */}
                <Section icon={RotateCcw} title="Returns Policy">
                    <FieldRow
                        label="Return cost paid by"
                        info={INFO.payer}
                        error={re?.payer?.message}
                    >
                        <Controller
                            control={control}
                            name="returns.payer"
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger className={selectTriggerClass(!!re?.payer)}>
                                        <SelectValue placeholder="Select who bears return costs" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="vendor">Vendor</SelectItem>
                                        <SelectItem value="agency">Agency</SelectItem>
                                        <SelectItem value="customer">Customer</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </FieldRow>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-t border-slate-100 dark:border-zinc-800 pt-4">
                        <FieldRow
                            label="Handling fee (XAF)"
                            info={INFO.handling_fee}
                            error={re?.handling_fee?.message}
                        >
                            <FeeInput
                                error={!!re?.handling_fee}
                                {...register('returns.handling_fee')}
                            />
                        </FieldRow>
                        <FieldRow
                            label="Return window (days)"
                            info={INFO.return_window_days}
                            error={re?.return_window_days?.message}
                        >
                            <DaysInput
                                placeholder="7"
                                error={!!re?.return_window_days}
                                {...register('returns.return_window_days')}
                            />
                        </FieldRow>
                    </div>

                    <FieldRow label="Notes" error={re?.notes?.message}>
                        <NotesArea
                            placeholder="E.g. only unopened items accepted, unboxing video required…"
                            error={!!re?.notes}
                            {...register('returns.notes')}
                        />
                    </FieldRow>
                </Section>

                {/* ── Damage ── */}
                <Section icon={AlertTriangle} title="Damage Policy">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <FieldRow
                            label="Claim deadline (days)"
                            info={INFO.claim_deadline_days}
                            error={de?.claim_deadline_days?.message}
                        >
                            <DaysInput
                                placeholder="7"
                                error={!!de?.claim_deadline_days}
                                {...register('damage.claim_deadline_days')}
                            />
                        </FieldRow>
                        <FieldRow
                            label="Max refund per item (XAF)"
                            info={INFO.max_refund_per_item}
                            error={de?.max_refund_per_item?.message}
                        >
                            <FeeInput
                                error={!!de?.max_refund_per_item}
                                {...register('damage.max_refund_per_item')}
                            />
                        </FieldRow>
                    </div>

                    {/* Admin-preset fields — read-only display */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-t border-slate-100 dark:border-zinc-800 pt-4">
                        <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                Inspector
                            </p>
                            <div className="flex items-center h-11 px-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800/60 text-sm text-slate-500 dark:text-slate-400 select-none">
                                Administrator
                            </div>
                            <p className="text-xs text-slate-400">Set by platform admin</p>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                Investigation fee (XAF)
                            </p>
                            <div className="flex items-center h-11 px-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800/60 text-sm text-slate-500 dark:text-slate-400 select-none">
                                1,000
                            </div>
                            <p className="text-xs text-slate-400">Set by platform admin</p>
                        </div>
                    </div>

                    <FieldRow label="Notes" error={de?.notes?.message}>
                        <NotesArea
                            placeholder="E.g. original packaging required, claims without video rejected…"
                            error={!!de?.notes}
                            {...register('damage.notes')}
                        />
                    </FieldRow>
                </Section>
            </form>
        </OnboardingLayout>
    );
}
