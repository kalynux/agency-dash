import { useCallback, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ChevronRight, ChevronLeft, Plus, Trash2, Smartphone, Building2, Star, CreditCard, Phone, User, Hash, Globe2 } from 'lucide-react';
import { toast } from 'sonner';
import { OnboardingLayout, selectTriggerClass } from '@/onboarding/OnboardingLayout';
import { payoutSchema, type PayoutFormValues, type PayoutMethodType } from '@/onboarding/schemas/onboarding.schemas';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError } from '@/types/api';
import { cn } from '@/lib/utils';

const MOBILE_MONEY_PROVIDERS = ['MTN Mobile Money', 'Orange Money', 'Wave', 'Moov Money', 'Airtel Money'];
const COUNTRIES = ['Cameroon', "Côte d'Ivoire", 'Senegal', 'Nigeria', 'Ghana', 'Kenya', 'Tanzania', 'Uganda', 'Rwanda', 'South Africa', 'France', 'United Kingdom', 'United States'];

const EMPTY_MOBILE_MONEY = { method: 'mobile_money' as const, mobile_money: { provider: '', phone_number: '', account_name: '' }, bank: null };
const EMPTY_BANK = { method: 'bank' as const, bank: { bank_name: '', account_number: '', account_name: '', country: '' }, mobile_money: null };

function FieldRow({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
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

function MethodTypeTab({ selected, icon: Icon, label, description, disabled, onClick }: {
    selected: boolean; icon: React.ElementType; label: string; description: string; disabled?: boolean; onClick: () => void;
}) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected} className={cn(
            'flex-1 flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            selected && 'border-primary bg-primary/5 shadow-sm',
            !selected && !disabled && 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:border-slate-300',
            disabled && 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50',
        )}>
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', selected ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-zinc-700 text-slate-500')}>
                <Icon className="w-4 h-4" />
            </div>
            <div>
                <p className={cn('font-semibold text-sm leading-tight', selected ? 'text-primary' : 'text-slate-800 dark:text-slate-200')}>{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
            <div className={cn('ml-auto w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center', selected ? 'border-primary bg-primary' : 'border-slate-300 dark:border-zinc-600')}>
                {selected && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
        </button>
    );
}

export function Step2Payout() {
    const { submitPayout, isSubmitting, session, goBack, drafts, saveDraft } = useOnboarding();
    const [apiError, setApiError] = useState<string | null>(null);

    const roleEntity = session?.role_entity;
    // Draft takes precedence — it contains the exact values the user entered last time.
    const draft = drafts.payout;

    // Pre-populate from previously saved session data
    const savedPayout = roleEntity?.payout_details;
    const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<PayoutFormValues>({
        resolver: zodResolver(payoutSchema),
        defaultValues: {
            payout_details: draft?.payout_details ?? (
                savedPayout?.length
                    ? savedPayout.map((p): PayoutFormValues['payout_details'][number] => {
                        if (p.method === 'mobile_money') {
                            return {
                                method: 'mobile_money',
                                mobile_money: p.mobile_money!,
                                bank: null,
                            };
                        } else {
                            return {
                                method: 'bank',
                                bank: p.bank!,
                                mobile_money: null,
                            };
                        }
                    })
                    : [{ ...EMPTY_MOBILE_MONEY }]
            ),
        },
    });

    const { fields, append, remove } = useFieldArray({ control, name: 'payout_details' });
    const payoutDetails = watch('payout_details');
    // At most 2 methods (one mobile money + one bank). Also hide "add" for a type
    // that is already present, so the no-duplicate rule can't be violated.
    const usedMethods = new Set((payoutDetails ?? []).map((p) => p?.method));
    const canAddMethods = fields.length < 2;
    const canAddMobileMoney = canAddMethods && !usedMethods.has('mobile_money');
    const canAddBank = canAddMethods && !usedMethods.has('bank');

    const switchMethod = useCallback((index: number, m: PayoutMethodType) => {
        setValue(`payout_details.${index}`, m === 'mobile_money' ? { ...EMPTY_MOBILE_MONEY } : { ...EMPTY_BANK }, { shouldValidate: false });
    }, [setValue]);

    const onSubmit = useCallback(async (values: PayoutFormValues) => {
        setApiError(null);
        // Save raw form values BEFORE the API call.
        saveDraft(2, values);
        try {
            await submitPayout({ payout_details: values.payout_details, version: roleEntity?.version });
            toast.success('Payout setup saved!');
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.isConcurrentModification) setApiError('Profile was modified elsewhere. Please refresh.');
                else if (err.isValidation) setApiError(err.firstFieldError() ?? err.message);
                else setApiError(err.isServer ? 'Server error. Please try again.' : err.message);
            }
        }
    }, [submitPayout, roleEntity]);

    return (
        <OnboardingLayout stepKey={2} viewingStepOverride={2}
            ctaSlot={
                <div className="px-6 pb-6 pt-2 flex gap-3">
                    <Button type="button" variant="outline" onClick={goBack} disabled={isSubmitting} className="h-12 w-24 rounded-xl font-semibold gap-1.5 border-slate-300 text-slate-600 dark:border-zinc-600 dark:text-slate-300">
                        <ChevronLeft className="w-4 h-4" /> Back
                    </Button>
                    <Button type="submit" form="step2-payout-form" disabled={isSubmitting} className="flex-1 h-12 rounded-xl font-semibold gap-2">
                        {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <>Continue <ChevronRight className="w-4 h-4" /></>}
                    </Button>
                </div>
            }
        >
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><CreditCard className="w-4 h-4 text-primary" /></div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">Payout Setup</h1>
                </div>
                <p className="text-sm text-slate-500">Add at least one payout method. The first entry is your preferred method.</p>
            </div>

            {apiError && <div role="alert" className="mx-6 mt-4 p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200">{apiError}</div>}
            {errors.payout_details && !Array.isArray(errors.payout_details) && (
                <div role="alert" className="mx-6 mt-4 p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200">{errors.payout_details.message}</div>
            )}

            <form id="step2-payout-form" onSubmit={handleSubmit(onSubmit)} className="px-6 pt-5 pb-6 space-y-4" noValidate>
                {fields.map((field, index) => {
                    const currentMethod = payoutDetails?.[index]?.method ?? 'mobile_money';
                    const isPreferred = index === 0;

                    return (
                        <div key={field.id} className={cn('rounded-xl border-2 overflow-hidden', isPreferred ? 'border-primary/25' : 'border-slate-200 dark:border-zinc-700')}>
                            <div className={cn('flex items-center justify-between px-4 py-2.5', isPreferred ? 'bg-primary/5 dark:bg-primary/10' : 'bg-slate-100/60 dark:bg-zinc-800')}>
                                <div className="flex items-center gap-2">
                                    <Star className={cn('w-3.5 h-3.5', isPreferred ? 'text-primary fill-primary' : 'text-slate-300')} />
                                    <span className={cn('text-xs font-semibold', isPreferred ? 'text-primary' : 'text-slate-500')}>
                                        {isPreferred ? 'Preferred Method' : 'Fallback Method'}
                                    </span>
                                </div>
                                {fields.length > 1 && (
                                    <button type="button" onClick={() => remove(index)} aria-label="Remove" className="text-slate-400 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className="p-4 bg-white dark:bg-zinc-900 space-y-4">
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Payment Method</p>
                                    <div className="flex gap-2">
                                        <MethodTypeTab selected={currentMethod === 'mobile_money'} icon={Smartphone} label="Mobile Money" description="MTN, Orange, Wave…"
                                            onClick={() => switchMethod(index, 'mobile_money')} />
                                        <MethodTypeTab selected={currentMethod === 'bank'} icon={Building2} label="Bank Transfer" description="Direct bank payout"
                                            onClick={() => switchMethod(index, 'bank')} />
                                    </div>
                                </div>

                                {currentMethod === 'mobile_money' && (
                                    <div className="space-y-3 border-t border-slate-100 dark:border-zinc-800 pt-4">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Mobile Money Details</p>
                                        <FieldRow label="Provider" required>
                                            <Controller control={control} name={`payout_details.${index}.mobile_money.provider` as `payout_details.${number}.mobile_money.provider`}
                                                render={({ field: f }) => (
                                                    <Select value={f.value ?? ''} onValueChange={f.onChange}>
                                                        <SelectTrigger className={selectTriggerClass()}>
                                                            <SelectValue placeholder="Select provider" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {MOBILE_MONEY_PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                )} />
                                        </FieldRow>
                                        <FieldRow label="Phone Number" required>
                                            <IconInput icon={Phone} type="tel" inputMode="tel" placeholder="+237 6XX XXX XXX"
                                                {...register(`payout_details.${index}.mobile_money.phone_number` as never)} />
                                        </FieldRow>
                                        <FieldRow label="Account Name" required>
                                            <IconInput icon={User} type="text" placeholder="Name on the mobile money account"
                                                {...register(`payout_details.${index}.mobile_money.account_name` as never)} />
                                        </FieldRow>
                                    </div>
                                )}

                                {currentMethod === 'bank' && (
                                    <div className="space-y-3 border-t border-slate-100 dark:border-zinc-800 pt-4">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bank Account Details</p>
                                        <FieldRow label="Bank Name" required>
                                            <IconInput icon={Building2} type="text" placeholder="e.g. Afriland First Bank"
                                                {...register(`payout_details.${index}.bank.bank_name` as never)} />
                                        </FieldRow>
                                        <FieldRow label="Account Number" required>
                                            <IconInput icon={Hash} type="text" inputMode="numeric" placeholder="IBAN or local account number"
                                                {...register(`payout_details.${index}.bank.account_number` as never)} />
                                        </FieldRow>
                                        <FieldRow label="Account Name" required>
                                            <IconInput icon={User} type="text" placeholder="Name on the bank account"
                                                {...register(`payout_details.${index}.bank.account_name` as never)} />
                                        </FieldRow>
                                        <FieldRow label="Bank Country" required>
                                            <Controller control={control} name={`payout_details.${index}.bank.country` as `payout_details.${number}.bank.country`}
                                                render={({ field: f }) => (
                                                    <Select value={f.value ?? ''} onValueChange={f.onChange}>
                                                        <SelectTrigger className={selectTriggerClass()}>
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <Globe2 className="w-4 h-4 text-slate-400" />
                                                                <SelectValue placeholder="Country where the bank operates" />
                                                            </div>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                )} />
                                        </FieldRow>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {(canAddMobileMoney || canAddBank) && (
                    <div className="flex gap-2 pt-1">
                        {canAddMobileMoney && (
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ ...EMPTY_MOBILE_MONEY })} className="flex-1 h-9 text-xs gap-1.5 border-dashed border-slate-300 text-slate-500">
                                <Plus className="w-3.5 h-3.5" /> Add Mobile Money
                            </Button>
                        )}
                        {canAddBank && (
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ ...EMPTY_BANK })} className="flex-1 h-9 text-xs gap-1.5 border-dashed border-slate-300 text-slate-500">
                                <Plus className="w-3.5 h-3.5" /> Add Bank Account
                            </Button>
                        )}
                    </div>
                )}

                <p className="text-xs text-slate-400 text-center">You can manage payout methods anytime in Settings.</p>
            </form>
        </OnboardingLayout>
    );
}
