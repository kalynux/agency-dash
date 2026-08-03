import { useCallback, useMemo, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Smartphone, Building2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeading } from '@/components/common/InfoHint';
import { UnsavedChangesBar } from '@/components/agency-settings/UnsavedChangesBar';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { buildPayoutSchema, type PayoutFormValues, type PayoutMethodType } from '@/onboarding/schemas/onboarding.schemas';
import type { PayoutDetails } from '@/types/api';
import { getApiErrorMessage } from '@/lib/errors';
import { isSameFormValue } from '@/lib/form-diff';
import { cn } from '@/lib/utils';

// Proper nouns — brand names and the country names the backend stores verbatim.
// Not translated: they are data sent to the API, not UI copy.
const MOBILE_MONEY_PROVIDERS = ['MTN Mobile Money', 'Orange Money', 'Wave', 'Moov Money', 'Airtel Money'];
const COUNTRIES = ['Cameroon', "Côte d'Ivoire", 'Senegal', 'Nigeria', 'Ghana', 'Kenya'];

const EMPTY_MOBILE_MONEY = { method: 'mobile_money' as const, mobile_money: { provider: '', phone_number: '', account_name: '' }, bank: null };
const EMPTY_BANK = { method: 'bank' as const, bank: { bank_name: '', account_number: '', account_name: '', country: '' }, mobile_money: null };

/**
 * Saved payout methods → form values. The unused half of each entry is pinned to
 * `null` rather than left absent so an entry always has the same shape as the
 * one `switchMethod` writes — the dirty check compares the two directly.
 */
function toFormValues(saved: PayoutDetails | undefined): PayoutFormValues {
  return {
    payout_details: saved?.length
      ? saved.map((p): PayoutFormValues['payout_details'][number] =>
        p.method === 'mobile_money'
          ? { method: 'mobile_money', mobile_money: p.mobile_money!, bank: null }
          : { method: 'bank', bank: p.bank!, mobile_money: null }
      )
      : [{ ...EMPTY_MOBILE_MONEY }],
  };
}

export function PayoutSettings() {
  const { t } = useTranslation('account');
  const { session, updateAgencyProfile, isSubmitting } = useOnboarding();
  const roleEntity = session?.role_entity;
  const [apiError, setApiError] = useState<string | null>(null);

  /**
   * The last values the server is known to hold — the form's seed and the
   * yardstick the unsaved-changes bar measures against, so retyping a character
   * the user just deleted hides the bar again. Advanced only on a successful
   * save: re-deriving it from `session` would let an unrelated session refresh
   * wipe an edit in progress.
   */
  const [baseline, setBaseline] = useState<PayoutFormValues>(() => toFormValues(roleEntity?.payout_details));

  const schema = useMemo(() => buildPayoutSchema(t), [t]);
  const { register, handleSubmit, control, watch, setValue, reset } = useForm<PayoutFormValues>({
    resolver: zodResolver(schema),
    defaultValues: baseline,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'payout_details' });
  const payoutDetails = watch('payout_details');
  const usedMethods = new Set((payoutDetails ?? []).map((p) => p?.method));
  const canAddMobileMoney = fields.length < 2 && !usedMethods.has('mobile_money');
  const canAddBank = fields.length < 2 && !usedMethods.has('bank');

  const dirty = !isSameFormValue(payoutDetails, baseline.payout_details);

  const switchMethod = useCallback((index: number, m: PayoutMethodType) => {
    setValue(`payout_details.${index}`, m === 'mobile_money' ? { ...EMPTY_MOBILE_MONEY } : { ...EMPTY_BANK });
  }, [setValue]);

  const onSubmit = useCallback(async (submitted: PayoutFormValues) => {
    setApiError(null);
    try {
      await updateAgencyProfile({ payout_details: submitted.payout_details });
      // Re-seed from the values the server accepted — they are trimmed, so the
      // bar settles instead of hanging on a stray space the user typed.
      reset(submitted);
      setBaseline(submitted);
      toast.success(t('payout.saved'));
    } catch (err) {
      setApiError(getApiErrorMessage(err));
    }
  }, [updateAgencyProfile, reset, t]);

  const handleDiscard = useCallback(() => {
    reset(baseline);
    setApiError(null);
  }, [reset, baseline]);

  // The bar sits at the bottom of the viewport, away from the field at fault —
  // and these fields carry no inline error text, so say it out loud.
  const submit = handleSubmit(onSubmit, () => toast.error(t('payout.incomplete')));

  return (
    <>
    <Card className={sectionSurfaceClass}>
      <SectionHeading
        title={t('payout.title')}
        description={t('payout.description')}
        short={t('payout.short')}
      />
      <CardContent className="space-y-6 max-md:px-0">
        {apiError && <div role="alert" className="p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200">{apiError}</div>}
        <form onSubmit={submit} className="space-y-4" noValidate>
          {fields.map((field, index) => {
            const currentMethod = payoutDetails?.[index]?.method ?? 'mobile_money';
            const isPreferred = index === 0;
            return (
              <div key={field.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Star className={cn('w-3.5 h-3.5', isPreferred && 'fill-primary text-primary')} />
                    {isPreferred ? t('payout.preferredMethod') : t('payout.fallbackMethod')}
                  </span>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      aria-label={t('payout.removeMethod')}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant={currentMethod === 'mobile_money' ? 'default' : 'outline'} size="sm" className="flex-1 gap-2" onClick={() => switchMethod(index, 'mobile_money')}>
                    <Smartphone className="w-4 h-4" /> {t('payout.mobileMoney')}
                  </Button>
                  <Button type="button" variant={currentMethod === 'bank' ? 'default' : 'outline'} size="sm" className="flex-1 gap-2" onClick={() => switchMethod(index, 'bank')}>
                    <Building2 className="w-4 h-4" /> {t('payout.bankTransfer')}
                  </Button>
                </div>

                {currentMethod === 'mobile_money' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>{t('payout.provider')}</Label>
                      <Controller control={control} name={`payout_details.${index}.mobile_money.provider` as `payout_details.${number}.mobile_money.provider`} render={({ field: f }) => (
                        <Select value={f.value ?? ''} onValueChange={f.onChange}>
                          <SelectTrigger><SelectValue placeholder={t('payout.providerPlaceholder')} /></SelectTrigger>
                          <SelectContent>{MOBILE_MONEY_PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      )} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('payout.phoneNumber')}</Label>
                      <Input placeholder={t('payout.phonePlaceholder')} {...register(`payout_details.${index}.mobile_money.phone_number` as never)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('payout.accountName')}</Label>
                      <Input {...register(`payout_details.${index}.mobile_money.account_name` as never)} />
                    </div>
                  </div>
                )}

                {currentMethod === 'bank' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>{t('payout.bankName')}</Label>
                      <Input {...register(`payout_details.${index}.bank.bank_name` as never)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('payout.accountNumber')}</Label>
                      <Input {...register(`payout_details.${index}.bank.account_number` as never)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('payout.accountName')}</Label>
                      <Input {...register(`payout_details.${index}.bank.account_name` as never)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('payout.bankCountry')}</Label>
                      <Controller control={control} name={`payout_details.${index}.bank.country` as `payout_details.${number}.bank.country`} render={({ field: f }) => (
                        <Select value={f.value ?? ''} onValueChange={f.onChange}>
                          <SelectTrigger><SelectValue placeholder={t('payout.countryPlaceholder')} /></SelectTrigger>
                          <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      )} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {(canAddMobileMoney || canAddBank) && (
            <div className="flex gap-2">
              {canAddMobileMoney && (
                <Button type="button" variant="outline" size="sm" onClick={() => append({ ...EMPTY_MOBILE_MONEY })} className="flex-1 gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> {t('payout.addMobileMoney')}
                </Button>
              )}
              {canAddBank && (
                <Button type="button" variant="outline" size="sm" onClick={() => append({ ...EMPTY_BANK })} className="flex-1 gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> {t('payout.addBank')}
                </Button>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>

    <UnsavedChangesBar
      visible={dirty || isSubmitting}
      saving={isSubmitting}
      onDiscard={handleDiscard}
      onSave={() => void submit()}
    />
    </>
  );
}
