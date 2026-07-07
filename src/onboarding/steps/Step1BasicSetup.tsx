import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ChevronRight, Smartphone, Building2 } from 'lucide-react';
import { toast } from 'sonner';

import { OnboardingLayout } from '@/onboarding/OnboardingLayout';
import { step1Schema, type Step1FormValues, type PayoutMethod } from '@/onboarding/schemas/onboarding.schemas';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/types/api';
import { cn } from '@/lib/utils';

// ─── Static data ──────────────────────────────────────────────────────────────

const COUNTRIES = [
    { code: 'CM', name: 'Cameroon' },
    { code: 'CI', name: "Côte d'Ivoire" },
    { code: 'SN', name: 'Senegal' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'GH', name: 'Ghana' },
    { code: 'KE', name: 'Kenya' },
    { code: 'TZ', name: 'Tanzania' },
    { code: 'UG', name: 'Uganda' },
    { code: 'RW', name: 'Rwanda' },
    { code: 'EG', name: 'Egypt' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'FR', name: 'France' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'US', name: 'United States' },
];

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

const MOBILE_MONEY_PROVIDERS = [
    { value: 'MTN', label: 'MTN Mobile Money' },
    { value: 'Orange', label: 'Orange Money' },
    { value: 'Wave', label: 'Wave' },
    { value: 'Moov', label: 'Moov Money' },
    { value: 'Airtel', label: 'Airtel Money' },
];

// ─── Method tab ───────────────────────────────────────────────────────────────

function MethodTab({
    method,
    selected,
    icon: Icon,
    label,
    description,
    onClick,
}: {
    method: PayoutMethod;
    selected: boolean;
    icon: React.ElementType;
    label: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={cn(
                'flex-1 rounded-xl border-2 p-3 text-left transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-muted-foreground/30',
            )}
        >
            <Icon
                className={cn('w-5 h-5 mb-2', selected ? 'text-primary' : 'text-muted-foreground')}
            />
            <p className={cn('font-semibold text-sm', selected ? 'text-primary' : 'text-foreground')}>
                {label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </button>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Step1BasicSetup() {
    const { submitStep, isSubmitting } = useOnboarding();
    const [apiError, setApiError] = useState<string | null>(null);
    const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>('mobile_money');

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        resetField,
        formState: { errors },
    } = useForm<Step1FormValues>({
        resolver: zodResolver(step1Schema),
        defaultValues: {
            country: '',
            timezone: '',
            payout_details: {
                method: 'mobile_money',
                mobile_money: { provider: '', phone_number: '', account_name: '' },
                bank: null,
            },
        },
    });

    const selectedCountry = watch('country');
    const selectedTimezone = watch('timezone');
    // Narrow the union for sub-field access — kept as unknown for type safety
    const pdErrors = errors.payout_details as Record<string, { message?: string }> | undefined;

    const switchMethod = useCallback(
        (method: PayoutMethod) => {
            setPayoutMethod(method);
            if (method === 'mobile_money') {
                setValue('payout_details', {
                    method: 'mobile_money',
                    mobile_money: { provider: '', phone_number: '', account_name: '' },
                    bank: null,
                });
            } else {
                setValue('payout_details', {
                    method: 'bank',
                    bank: { bank_name: '', account_number: '', account_name: '', country: '' },
                    mobile_money: null,
                });
            }
            resetField('payout_details');
            setValue('payout_details.method' as never, method as never);
        },
        [setValue, resetField],
    );

    const onSubmit = useCallback(
        async (values: Step1FormValues) => {
            setApiError(null);
            try {
                await submitStep({ step: 1, ...values });
                toast.success('Basic setup saved!');
            } catch (err) {
                if (err instanceof ApiError) {
                    if (err.isValidation && err.details) {
                        const firstField = Object.values(err.details)[0]?.[0];
                        setApiError(firstField ?? err.message);
                    } else if (err.isServer) {
                        setApiError('A server error occurred. Please try again.');
                    } else {
                        setApiError(err.message);
                    }
                }
            }
        },
        [submitStep],
    );

    const ctaSlot = (
        <Button
            type="submit"
            form="step1-form"
            disabled={isSubmitting}
            className="w-full h-12 text-base font-semibold gap-2"
        >
            {isSubmitting ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                </>
            ) : (
                <>
                    Continue
                    <ChevronRight className="w-4 h-4" />
                </>
            )}
        </Button>
    );

    return (
        <OnboardingLayout ctaSlot={ctaSlot} stepKey={1}>
            <div className="space-y-2 mb-8">
                <h1 className="text-2xl font-bold">Basic Setup</h1>
                <p className="text-muted-foreground text-sm">
                    Tell us where you operate and how you'd like to receive payouts.
                </p>
            </div>

            {apiError && (
                <div
                    role="alert"
                    className="mb-6 p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
                >
                    {apiError}
                </div>
            )}

            <form id="step1-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
                {/* Country */}
                <div className="space-y-2">
                    <Label htmlFor="country">
                        Country <span className="text-destructive">*</span>
                    </Label>
                    <Select
                        value={selectedCountry}
                        onValueChange={(v) => setValue('country', v, { shouldValidate: true })}
                    >
                        <SelectTrigger
                            id="country"
                            className={cn('h-11', errors.country && 'border-destructive')}
                            aria-invalid={!!errors.country}
                        >
                            <SelectValue placeholder="Select your country" />
                        </SelectTrigger>
                        <SelectContent>
                            {COUNTRIES.map((c) => (
                                <SelectItem key={c.code} value={c.code}>
                                    {c.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.country && (
                        <p className="text-sm text-destructive" role="alert">
                            {errors.country.message}
                        </p>
                    )}
                </div>

                {/* Timezone */}
                <div className="space-y-2">
                    <Label htmlFor="timezone">
                        Timezone <span className="text-destructive">*</span>
                    </Label>
                    <Select
                        value={selectedTimezone}
                        onValueChange={(v) => setValue('timezone', v, { shouldValidate: true })}
                    >
                        <SelectTrigger
                            id="timezone"
                            className={cn('h-11', errors.timezone && 'border-destructive')}
                            aria-invalid={!!errors.timezone}
                        >
                            <SelectValue placeholder="Select your timezone" />
                        </SelectTrigger>
                        <SelectContent>
                            {TIMEZONES.map((tz) => (
                                <SelectItem key={tz.value} value={tz.value}>
                                    {tz.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.timezone && (
                        <p className="text-sm text-destructive" role="alert">
                            {errors.timezone.message}
                        </p>
                    )}
                </div>

                {/* Payout method selector */}
                <div className="space-y-4 border-t pt-4">
                    <h2 className="font-semibold text-sm">Payout Details</h2>

                    {/* Method tabs */}
                    <div className="flex gap-3">
                        <MethodTab
                            method="mobile_money"
                            selected={payoutMethod === 'mobile_money'}
                            icon={Smartphone}
                            label="Mobile Money"
                            description="MTN, Orange, Wave…"
                            onClick={() => switchMethod('mobile_money')}
                        />
                        <MethodTab
                            method="bank"
                            selected={payoutMethod === 'bank'}
                            icon={Building2}
                            label="Bank Transfer"
                            description="Direct bank payout"
                            onClick={() => switchMethod('bank')}
                        />
                    </div>

                    {/* ── Mobile Money fields ── */}
                    {payoutMethod === 'mobile_money' && (
                        <div className="space-y-4">
                            {/* Provider */}
                            <div className="space-y-2">
                                <Label htmlFor="mm_provider">
                                    Provider <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    onValueChange={(v) =>
                                        setValue('payout_details.mobile_money.provider' as never, v as never, {
                                            shouldValidate: true,
                                        })
                                    }
                                >
                                    <SelectTrigger
                                        id="mm_provider"
                                        className={cn(
                                            'h-11',
                                            pdErrors?.mobile_money && 'border-destructive',
                                        )}
                                    >
                                        <SelectValue placeholder="Select provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MOBILE_MONEY_PROVIDERS.map((p) => (
                                            <SelectItem key={p.value} value={p.value}>
                                                {p.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Phone number */}
                            <div className="space-y-2">
                                <Label htmlFor="mm_phone">
                                    Phone Number <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="mm_phone"
                                    type="tel"
                                    inputMode="tel"
                                    placeholder="+237 6XX XXX XXX"
                                    className="h-11"
                                    {...register('payout_details.mobile_money.phone_number' as never)}
                                />
                            </div>

                            {/* Account name */}
                            <div className="space-y-2">
                                <Label htmlFor="mm_account_name">
                                    Account Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="mm_account_name"
                                    type="text"
                                    placeholder="Name registered on the account"
                                    className="h-11"
                                    {...register('payout_details.mobile_money.account_name' as never)}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Bank fields ── */}
                    {payoutMethod === 'bank' && (
                        <div className="space-y-4">
                            {/* Bank name */}
                            <div className="space-y-2">
                                <Label htmlFor="bank_name">
                                    Bank Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="bank_name"
                                    type="text"
                                    placeholder="e.g. Afriland First Bank"
                                    className="h-11"
                                    {...register('payout_details.bank.bank_name' as never)}
                                />
                            </div>

                            {/* Account number */}
                            <div className="space-y-2">
                                <Label htmlFor="bank_account_number">
                                    Account Number <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="bank_account_number"
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="IBAN or local account number"
                                    className="h-11"
                                    {...register('payout_details.bank.account_number' as never)}
                                />
                            </div>

                            {/* Account name */}
                            <div className="space-y-2">
                                <Label htmlFor="bank_account_name">
                                    Account Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="bank_account_name"
                                    type="text"
                                    placeholder="Name on the bank account"
                                    className="h-11"
                                    {...register('payout_details.bank.account_name' as never)}
                                />
                            </div>

                            {/* Bank country */}
                            <div className="space-y-2">
                                <Label htmlFor="bank_country">
                                    Bank Country <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    onValueChange={(v) =>
                                        setValue('payout_details.bank.country' as never, v as never, {
                                            shouldValidate: true,
                                        })
                                    }
                                >
                                    <SelectTrigger id="bank_country" className="h-11">
                                        <SelectValue placeholder="Country where the bank is registered" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {COUNTRIES.map((c) => (
                                            <SelectItem key={c.code} value={c.code}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </OnboardingLayout>
    );
}
