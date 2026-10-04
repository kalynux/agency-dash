import { useCallback, useMemo, useState } from 'react';
import { useForm, Controller, type DefaultValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { FileText, ShieldAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { MediaPicker } from '@/components/features/MediaPicker';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { UnitInput } from '@/components/ui/unit-input';
import { Separator } from '@/components/ui/separator';
import { InfoHint } from '@/components/common/InfoHint';
import { UnsavedChangesBar } from '@/components/agency-settings/UnsavedChangesBar';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useAccountStanding } from '@/hooks/useAccountStanding';
import { buildPoliciesSchema, type PoliciesFormValues } from '@/onboarding/schemas/onboarding.schemas';
import type { AgencyPolicies } from '@/types/api';
import { isQuotaBlockedFile, resolveFileUrl } from '@/services/files.service';
import { getApiErrorMessage } from '@/lib/errors';
import { isSameFormValue } from '@/lib/form-diff';
import { tx, txStatic } from '@/i18n/tx';
import { cn } from '@/lib/utils';

/**
 * What each policy field actually does once it's saved, with a worked example.
 *
 * These numbers drive real invoices — a vendor comparing agencies reads them
 * before connecting, and getting one wrong is a billing dispute rather than a
 * cosmetic mistake. The labels alone can't carry that ("RTO fee" says nothing
 * about replacing the delivery fee), so every field gets an ⓘ. Kept in one map,
 * form path → `settings:policies.hints.*` key, so the copy lives with the rest
 * of the translated copy and can be reviewed as copy.
 *
 * Unlike the rest of this mobile pass, these show at every width: the
 * information is new, so hiding it on desktop would put it out of reach there.
 *
 * The three free-text notes fields have none (2026-09-29): their placeholder
 * already shows what goes there, and an ⓘ that says "notes" is noise.
 */
const POLICY_FIELD_HINTS: Record<string, string> = {
  // Storage-based — you hold the stock
  'pricing.storage_based.enabled': 'storageEnabled',
  'pricing.storage_based.monthly_storage_fee_per_sku': 'monthlyStorageFee',
  'pricing.storage_based.pick_pack_fee_per_order': 'pickPackFee',
  'pricing.storage_based.local_delivery_fee': 'localDeliveryFee',
  'pricing.storage_based.out_of_region_delivery_fee': 'outOfRegionDeliveryFee',

  // Pickup-based — the vendor holds the stock
  'pricing.pickup_based.enabled': 'pickupEnabled',
  'pricing.pickup_based.base_rate_first_kg': 'baseRateFirstKg',
  'pricing.pickup_based.additional_per_kg': 'additionalPerKg',
  'pricing.pickup_based.out_of_region_surcharge': 'outOfRegionSurcharge',

  // Additional fees
  'pricing.additional_fees.cod_handling_fee.type': 'codFeeType',
  'pricing.additional_fees.cod_handling_fee.value': 'codFeeValue',
  'pricing.additional_fees.failed_delivery_fee': 'failedDeliveryFee',
  'pricing.additional_fees.rto_fee': 'rtoFee',
  'pricing.additional_fees.peak_season_surcharge': 'peakSeasonSurcharge',

  // Ceiling and cash payment of the delivery fee (ADR-A11)
  'pricing.max_fee_per_shipment': 'maxFeePerShipment',
  'pricing.accepts_cash_delivery_fee': 'acceptsCashDeliveryFee',

  // Cash on delivery
  'cod.enabled': 'codEnabled',
  'cod.max_order_amount': 'codMaxAmount',

  // Returns
  'returns.payer': 'returnsPayer',
  'returns.handling_fee': 'returnsHandlingFee',
  'returns.return_window_days': 'returnsWindowDays',

  // Damage
  'damage.claim_deadline_days': 'damageClaimDeadline',
  'damage.max_refund_per_item': 'damageMaxRefund',
};

/** A field label with its ⓘ, wired to {@link POLICY_FIELD_HINTS} by form path. */
function FieldLabel({
  name,
  htmlFor,
  children,
}: {
  name: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation('settings');
  const hintKey = POLICY_FIELD_HINTS[name];
  return (
    <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
      <span>{children}</span>
      {hintKey && (
        <InfoHint label={t('policies.aboutField')}>{tx(t, `policies.hints.${hintKey}`)}</InfoHint>
      )}
    </Label>
  );
}

/** The same label treatment for the switch rows, which use a <p>, not a <Label>. */
function ToggleLabel({ name, children }: { name: string; children: React.ReactNode }) {
  const { t } = useTranslation('settings');
  const hintKey = POLICY_FIELD_HINTS[name];
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium">
      <span>{children}</span>
      {hintKey && (
        <InfoHint label={t('policies.aboutSetting')}>{tx(t, `policies.hints.${hintKey}`)}</InfoHint>
      )}
    </p>
  );
}

/** A money field — "XAF" written inside the box, not in the label. */
function MoneyInput(props: Omit<React.ComponentProps<typeof UnitInput>, 'unit'>) {
  const { t } = useTranslation('settings');
  return <UnitInput type="number" inputMode="decimal" min={0} unit={t('policies.unitCurrency')} {...props} />;
}

/** A day count — "days" written inside the box. */
function DaysInput(props: Omit<React.ComponentProps<typeof UnitInput>, 'unit'>) {
  const { t } = useTranslation('settings');
  return <UnitInput type="number" inputMode="numeric" min={0} unit={t('policies.unitDays')} {...props} />;
}

function Section({
  title,
  description,
  short,
  children,
}: {
  title: string;
  description?: string;
  /**
   * Moves `description` behind the ⓘ on a phone. The short line itself is no
   * longer printed there (same rule as the vendor dashboard: a subtitle under
   * every heading was most of what made this form read as prose).
   */
  short?: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation('settings');
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <h4 className="text-base font-semibold">{title}</h4>
        {description && short && (
          <InfoHint className="md:hidden" label={t('policies.aboutSection', { title })}>
            {description}
          </InfoHint>
        )}
      </div>
      {description && (
        <p className={cn('text-sm text-muted-foreground -mt-2', short && 'max-md:hidden')}>
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

/**
 * Saved policies → form values. Fees the agency never set stay `undefined` so
 * their inputs render empty rather than as a `0` nobody typed — which is also
 * why this is the dirty-check baseline: typing `0` into one of them IS a change.
 */
function toFormValues(existing: AgencyPolicies | null | undefined): DefaultValues<PoliciesFormValues> {
  return {
    pricing: {
      storage_based: {
        enabled: existing?.pricing?.storage_based?.enabled ?? true,
        monthly_storage_fee_per_sku: existing?.pricing?.storage_based?.monthly_storage_fee_per_sku ?? undefined,
        pick_pack_fee_per_order: existing?.pricing?.storage_based?.pick_pack_fee_per_order ?? undefined,
        local_delivery_fee: existing?.pricing?.storage_based?.local_delivery_fee ?? undefined,
        out_of_region_delivery_fee: existing?.pricing?.storage_based?.out_of_region_delivery_fee ?? undefined,
      },
      pickup_based: {
        enabled: existing?.pricing?.pickup_based?.enabled ?? true,
        base_rate_first_kg: existing?.pricing?.pickup_based?.base_rate_first_kg ?? undefined,
        additional_per_kg: existing?.pricing?.pickup_based?.additional_per_kg ?? undefined,
        out_of_region_surcharge: existing?.pricing?.pickup_based?.out_of_region_surcharge ?? undefined,
      },
      additional_fees: {
        cod_handling_fee: {
          type: existing?.pricing?.additional_fees?.cod_handling_fee?.type ?? 'percentage',
          value: existing?.pricing?.additional_fees?.cod_handling_fee?.value ?? undefined,
        },
        failed_delivery_fee: existing?.pricing?.additional_fees?.failed_delivery_fee ?? undefined,
        rto_fee: existing?.pricing?.additional_fees?.rto_fee ?? undefined,
        peak_season_surcharge: existing?.pricing?.additional_fees?.peak_season_surcharge ?? undefined,
      },
      // Always seeded from what was loaded: the save replaces the whole
      // `policies` object, so these must go back even when nobody touched them.
      max_fee_per_shipment: existing?.pricing?.max_fee_per_shipment ?? null,
      accepts_cash_delivery_fee: existing?.pricing?.accepts_cash_delivery_fee ?? false,
      notes: existing?.pricing?.notes ?? '',
    },
    returns: {
      payer: existing?.returns?.payer ?? 'vendor',
      handling_fee: existing?.returns?.handling_fee ?? undefined,
      return_window_days: existing?.returns?.return_window_days ?? undefined,
      notes: existing?.returns?.notes ?? '',
    },
    damage: {
      claim_deadline_days: existing?.damage?.claim_deadline_days ?? undefined,
      max_refund_per_item: existing?.damage?.max_refund_per_item ?? undefined,
      notes: existing?.damage?.notes ?? '',
    },
    cod: {
      enabled: existing?.cod?.enabled ?? false,
      max_order_amount: existing?.cod?.max_order_amount ?? null,
    },
  };
}

export function PoliciesSettings() {
  const { t } = useTranslation(['settings', 'common']);
  const { session, updateAgencyProfile, isSubmitting } = useOnboarding();
  const roleEntity = session?.role_entity;
  // ⛔ Not `status === 'active'`: an agency activates itself now, so that answers
  // "may it operate", not "has anyone vetted it". See lib/account-standing.ts —
  // the COD toggle below is the one place in this dashboard where the difference
  // is the difference between a setting that works and one that silently doesn't.
  const { kycVerified } = useAccountStanding();
  const [apiError, setApiError] = useState<string | null>(null);
  // Rebuilt on a language switch so validation messages follow the UI.
  const schema = useMemo(() => buildPoliciesSchema(t), [t]);

  /**
   * The last values the server is known to hold — both the form's seed and the
   * yardstick the unsaved-changes bar measures against, so undoing an edit by
   * hand (delete a digit, type it back) hides the bar again. Held in state and
   * advanced only on a successful save: re-deriving it from `session` would let
   * an unrelated session refresh wipe an edit in progress.
   */
  const [baseline, setBaseline] = useState(() => toFormValues(roleEntity?.policies));
  // policies.documents — existing URLs (full-replace on save; resend to keep).
  const [documents, setDocuments] = useState<string[]>(() => roleEntity?.policies?.documents ?? []);
  const [savedDocuments, setSavedDocuments] = useState<string[]>(documents);
  const [docPickerOpen, setDocPickerOpen] = useState(false);

  const remainingDocs = 2 - documents.length;

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<PoliciesFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: baseline,
  });

  // Subscribes to the whole form: every field feeds the dirty check below.
  const values = watch();
  const storageEnabled = values.pricing?.storage_based?.enabled;
  const pickupEnabled = values.pricing?.pickup_based?.enabled;
  const codEnabled = values.cod?.enabled;
  const pe = errors.pricing;
  const re = errors.returns;
  const de = errors.damage;

  const dirty =
    !isSameFormValue(values, baseline) || !isSameFormValue(documents, savedDocuments);

  const onSubmit = useCallback(async (submitted: PoliciesFormValues) => {
    setApiError(null);
    try {
      // Post-onboarding edit → PATCH /api/agency/profile. `documents` is full-replace.
      await updateAgencyProfile({ policies: { ...submitted, documents } });
      // Re-seed from the parsed values the server just accepted, so the fields
      // now hold numbers rather than the strings the inputs handed back and the
      // bar settles instead of re-appearing on the next keystroke.
      reset(submitted as DefaultValues<PoliciesFormValues>);
      setBaseline(submitted as DefaultValues<PoliciesFormValues>);
      setSavedDocuments(documents);
      toast.success(t('policies.saved'));
    } catch (err) {
      setApiError(getApiErrorMessage(err));
    }
  }, [updateAgencyProfile, documents, reset, t]);

  const handleDiscard = useCallback(() => {
    reset(baseline);
    setDocuments(savedDocuments);
    setApiError(null);
  }, [reset, baseline, savedDocuments]);

  // The bar sits at the bottom of the viewport, far from the field that failed —
  // so an invalid submit says so out loud instead of only marking the input.
  const submit = handleSubmit(onSubmit, () => toast.error(t('common.fixHighlighted')));

  return (
    <>
    {/* No section heading: the page header above already names this tab and
        states the same rule, so one here would print it twice. */}
    <Card className={sectionSurfaceClass}>
      <CardContent className="space-y-6 md:space-y-8 max-md:px-0">
        {apiError && <div role="alert" className="p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200">{apiError}</div>}

        <form onSubmit={submit} className="space-y-6 md:space-y-8" noValidate>
          <Section
            title={t('policies.pricing.title')}
            description={t('policies.pricing.description')}
            short={t('policies.pricing.short')}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <ToggleLabel name="pricing.storage_based.enabled">
                  {t('policies.pricing.storageToggle')}
                </ToggleLabel>
                <Controller control={control} name="pricing.storage_based.enabled" render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!pickupEnabled} />
                )} />
              </div>
              {storageEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <FieldLabel name="pricing.storage_based.monthly_storage_fee_per_sku">
                      {t('policies.pricing.monthlyStorageFee')}
                    </FieldLabel>
                    <MoneyInput {...register('pricing.storage_based.monthly_storage_fee_per_sku')} />
                    {pe?.storage_based?.monthly_storage_fee_per_sku && <p className="text-xs text-red-500">{pe.storage_based.monthly_storage_fee_per_sku.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel name="pricing.storage_based.pick_pack_fee_per_order">
                      {t('policies.pricing.pickPackFee')}
                    </FieldLabel>
                    <MoneyInput {...register('pricing.storage_based.pick_pack_fee_per_order')} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel name="pricing.storage_based.local_delivery_fee">
                      {t('policies.pricing.localDeliveryFee')}
                    </FieldLabel>
                    <MoneyInput {...register('pricing.storage_based.local_delivery_fee')} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel name="pricing.storage_based.out_of_region_delivery_fee">
                      {t('policies.pricing.outOfRegionDeliveryFee')}
                    </FieldLabel>
                    <MoneyInput {...register('pricing.storage_based.out_of_region_delivery_fee')} />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <ToggleLabel name="pricing.pickup_based.enabled">
                  {t('policies.pricing.pickupToggle')}
                </ToggleLabel>
                <Controller control={control} name="pricing.pickup_based.enabled" render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!storageEnabled} />
                )} />
              </div>
              {pickupEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <FieldLabel name="pricing.pickup_based.base_rate_first_kg">
                      {t('policies.pricing.baseRateFirstKg')}
                    </FieldLabel>
                    <MoneyInput {...register('pricing.pickup_based.base_rate_first_kg')} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel name="pricing.pickup_based.additional_per_kg">
                      {t('policies.pricing.additionalPerKg')}
                    </FieldLabel>
                    <MoneyInput {...register('pricing.pickup_based.additional_per_kg')} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel name="pricing.pickup_based.out_of_region_surcharge">
                      {t('policies.pricing.outOfRegionSurcharge')}
                    </FieldLabel>
                    <MoneyInput {...register('pricing.pickup_based.out_of_region_surcharge')} />
                  </div>
                </div>
              )}
              {(pe as { storage_based?: { enabled?: { message?: string } } } | undefined)?.storage_based?.enabled && (
                <p className="text-xs text-red-500">{(pe as { storage_based?: { enabled?: { message?: string } } }).storage_based?.enabled?.message}</p>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">{t('policies.pricing.additionalFees')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel name="pricing.additional_fees.cod_handling_fee.type">
                    {t('policies.pricing.codFeeType')}
                  </FieldLabel>
                  <Controller control={control} name="pricing.additional_fees.cod_handling_fee.type" render={({ field }) => (
                    <ChoiceChips
                      label={t('policies.pricing.codFeeType')}
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: 'percentage', label: t('policies.pricing.codFeeTypePercentage') },
                        { value: 'fixed', label: t('policies.pricing.codFeeTypeFixed') },
                      ]}
                    />
                  )} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel name="pricing.additional_fees.cod_handling_fee.value">
                    {t('policies.pricing.codFeeValue')}
                  </FieldLabel>
                  <UnitInput
                    type="number"
                    inputMode="decimal"
                    min={0}
                    unit={values.pricing?.additional_fees?.cod_handling_fee?.type === 'fixed' ? t('policies.unitCurrency') : '%'}
                    placeholder={t('policies.pricing.codFeeValuePlaceholder')}
                    {...register('pricing.additional_fees.cod_handling_fee.value')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel name="pricing.additional_fees.failed_delivery_fee">
                    {t('policies.pricing.failedDeliveryFee')}
                  </FieldLabel>
                  <MoneyInput {...register('pricing.additional_fees.failed_delivery_fee')} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel name="pricing.additional_fees.rto_fee">
                    {t('policies.pricing.rtoFee')}
                  </FieldLabel>
                  <MoneyInput {...register('pricing.additional_fees.rto_fee')} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel name="pricing.additional_fees.peak_season_surcharge">
                    {t('policies.pricing.peakSeasonSurcharge')}
                  </FieldLabel>
                  <MoneyInput placeholder="0" {...register('pricing.additional_fees.peak_season_surcharge')} />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">{t('policies.pricing.ceilingAndCash')}</p>
              <div className="space-y-1.5 sm:max-w-xs">
                <FieldLabel name="pricing.max_fee_per_shipment" htmlFor="policy-max-fee">
                  {t('policies.pricing.maxFeePerShipment')}
                </FieldLabel>
                <MoneyInput
                  id="policy-max-fee"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  placeholder={t('policies.pricing.maxFeePerShipmentPlaceholder')}
                  {...register('pricing.max_fee_per_shipment')}
                />
                {pe?.max_fee_per_shipment && <p className="text-xs text-red-500">{pe.max_fee_per_shipment.message}</p>}
              </div>
              <div className="flex items-center justify-between gap-3">
                <ToggleLabel name="pricing.accepts_cash_delivery_fee">
                  {t('policies.pricing.acceptsCashDeliveryFee')}
                </ToggleLabel>
                <Controller control={control} name="pricing.accepts_cash_delivery_fee" render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label={t('policies.pricing.acceptsCashDeliveryFee')}
                  />
                )} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel name="pricing.notes">{t('policies.pricing.notes')}</FieldLabel>
              <Textarea rows={2} placeholder={t('policies.pricing.notesPlaceholder')} {...register('pricing.notes')} />
            </div>
          </Section>

          <Separator />

          <Section
            title={t('policies.cod.title')}
            description={t('policies.cod.description')}
            short={t('policies.cod.short')}
          >
            <div className="flex items-center justify-between">
              <ToggleLabel name="cod.enabled">{t('policies.cod.toggle')}</ToggleLabel>
              <Controller control={control} name="cod.enabled" render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )} />
            </div>
            {/* ⚠ Cash is the one thing an unverified agency genuinely cannot do.
                `CodEligibilityService` requires `kyc_details.legit_verified` at
                checkout, so this toggle has no effect until an administrator
                verifies the agency — COD orders simply never arrive, with
                nothing on this screen to explain the silence. That is worth
                saying; it is also the ONLY refusal that follows from being
                unverified, so it is said here and nowhere else.

                Left switchable on purpose: the setting is real and takes effect
                the moment the verdict lands. Disabling the control would make
                the agency come back and set it a second time. */}
            {codEnabled && !kycVerified && (
              <div className="flex items-start gap-2 rounded-lg border border-gold-400/50 bg-gold-50/70 p-3 dark:border-gold-500/25 dark:bg-gold-500/10">
                <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold-700 dark:text-gold-400" />
                <p className="text-xs text-muted-foreground">
                  {t('policies.cod.unverified')}{' '}
                  <Link
                    to="/dashboard/account/verification"
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    {t('policies.cod.unverifiedCta')}
                  </Link>
                </p>
              </div>
            )}
            {codEnabled && (
              <div className="space-y-1.5">
                <FieldLabel name="cod.max_order_amount">{t('policies.cod.maxAmount')}</FieldLabel>
                <MoneyInput placeholder={t('policies.cod.maxAmountPlaceholder')} {...register('cod.max_order_amount')} />
                {errors.cod?.max_order_amount && <p className="text-xs text-red-500">{errors.cod.max_order_amount.message}</p>}
              </div>
            )}
          </Section>

          <Separator />

          <Section title={t('policies.returns.title')}>
            <div className="space-y-1.5">
              <FieldLabel name="returns.payer">{t('policies.returns.payer')}</FieldLabel>
              <Controller control={control} name="returns.payer" render={({ field }) => (
                <ChoiceChips
                  label={t('policies.returns.payer')}
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: 'vendor', label: t('policies.returns.payerVendor') },
                    { value: 'agency', label: t('policies.returns.payerAgency') },
                    { value: 'customer', label: t('policies.returns.payerCustomer') },
                  ]}
                />
              )} />
              {re?.payer && <p className="text-xs text-red-500">{re.payer.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <FieldLabel name="returns.handling_fee">{t('policies.returns.handlingFee')}</FieldLabel>
                <MoneyInput {...register('returns.handling_fee')} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel name="returns.return_window_days">{t('policies.returns.windowDays')}</FieldLabel>
                <DaysInput placeholder="7" {...register('returns.return_window_days')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel name="returns.notes">{t('policies.returns.notes')}</FieldLabel>
              <Textarea rows={2} placeholder={t('policies.returns.notesPlaceholder')} {...register('returns.notes')} />
            </div>
          </Section>

          <Separator />

          <Section title={t('policies.damage.title')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <FieldLabel name="damage.claim_deadline_days">{t('policies.damage.claimDeadline')}</FieldLabel>
                <DaysInput placeholder="7" {...register('damage.claim_deadline_days')} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel name="damage.max_refund_per_item">{t('policies.damage.maxRefund')}</FieldLabel>
                <MoneyInput {...register('damage.max_refund_per_item')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel name="damage.notes">{t('policies.damage.notes')}</FieldLabel>
              <Textarea rows={2} placeholder={t('policies.damage.notesPlaceholder')} {...register('damage.notes')} />
            </div>
            {de?.claim_deadline_days && <p className="text-xs text-red-500">{de.claim_deadline_days.message}</p>}
          </Section>

          <Separator />

          <Section
            title={t('policies.documents.title')}
            description={t('policies.documents.description')}
            short={t('policies.documents.short')}
          >
            {documents.length > 0 && (
              <div className="space-y-1">
                {documents.map((url, i) => (
                  <div key={i} className="flex min-h-11 items-center gap-2 text-sm rounded-lg border px-3">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <a href={url} target="_blank" rel="noopener noreferrer" className="truncate flex-1 hover:underline">
                      {url.split('/').pop() ?? t('policies.documents.fallbackName', { number: i + 1 })}
                    </a>
                    <button type="button" aria-label={t('common:actions.remove')} onClick={() => setDocuments((prev) => prev.filter((_, idx) => idx !== i))} className="inline-flex h-9 w-9 -me-2 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={remainingDocs <= 0}
              onClick={() => setDocPickerOpen(true)}
            >
              <FileText className="w-4 h-4" />
              {t('policies.documents.add', { used: documents.length, max: 2 })}
            </Button>

            <MediaPicker
              open={docPickerOpen}
              onClose={() => setDocPickerOpen(false)}
              multiple
              maxFiles={remainingDocs}
              acceptedTypes={['document']}
              onSelect={(picked) => {
                // Say why before dropping anything. A blocked document is the
                // one unresolvable case a user can reach and fix themselves,
                // and silently discarding their pick reads as a broken picker.
                if (picked.some(isQuotaBlockedFile)) {
                  toast.error(txStatic('media:quotaBlocked.title'), {
                    description: txStatic('media:quotaBlocked.body'),
                  });
                }
                setDocuments((prev) => [
                  ...prev,
                  // `resolveFileUrl` returns null for a file with no public URL.
                  // A policy document is stored *as a URL*, so one we cannot
                  // resolve has nothing to store — drop it rather than push a
                  // null into an array the API expects to be `string[]`.
                  ...picked
                    .slice(0, 2 - prev.length)
                    .map((f) => resolveFileUrl(f))
                    .filter((url): url is string => url !== null),
                ]);
              }}
            />
          </Section>
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
