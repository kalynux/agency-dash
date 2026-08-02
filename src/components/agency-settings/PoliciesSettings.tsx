import { useCallback, useState } from 'react';
import { useForm, Controller, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DollarSign, RotateCcw, AlertTriangle, Banknote, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { MediaPicker } from '@/components/features/MediaPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { InfoHint, SectionHeading } from '@/components/common/InfoHint';
import { UnsavedChangesBar } from '@/components/agency-settings/UnsavedChangesBar';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { policiesSchema, type PoliciesFormValues } from '@/onboarding/schemas/onboarding.schemas';
import type { AgencyPolicies } from '@/types/api';
import { resolveFileUrl } from '@/services/files.service';
import { getApiErrorMessage } from '@/lib/errors';
import { isSameFormValue } from '@/lib/form-diff';
import { cn } from '@/lib/utils';

/**
 * What each policy field actually does once it's saved, with a worked example.
 *
 * These numbers drive real invoices — a vendor comparing agencies reads them
 * before connecting, and getting one wrong is a billing dispute rather than a
 * cosmetic mistake. The labels alone can't carry that ("RTO fee" says nothing
 * about replacing the delivery fee), so every field gets an ⓘ. Kept in one map,
 * keyed by form path, so the copy can be reviewed as copy.
 *
 * Unlike the rest of this mobile pass, these show at every width: the
 * information is new, so hiding it on desktop would put it out of reach there.
 */
const POLICY_FIELD_HINTS: Record<string, string> = {
  // Storage-based — you hold the stock
  'pricing.storage_based.enabled':
    'You hold the vendor\'s stock and ship from your own warehouse. Turn this off and vendors can only book you for pickups. At least one of the two models must stay on.',
  'pricing.storage_based.monthly_storage_fee_per_sku':
    'Charged per distinct product you hold, every month. Set 500 → a vendor storing 40 SKUs is billed 20,000 XAF a month.',
  'pricing.storage_based.pick_pack_fee_per_order':
    'Charged once per order you pick and pack, whatever its size. Set 300 → 50 orders in a month bills 15,000 XAF.',
  'pricing.storage_based.local_delivery_fee':
    'Your fee for a delivery inside a region you cover. Set 1,500 and each local order earns 1,500 XAF, before the delivering agent\'s share.',
  'pricing.storage_based.out_of_region_delivery_fee':
    'Replaces the local fee when the drop-off falls outside your coverage regions. Set 3,000 and a Douala → Bafoussam order bills 3,000 instead of the local rate.',

  // Pickup-based — the vendor holds the stock
  'pricing.pickup_based.enabled':
    'The vendor keeps its own stock and you collect per order, priced by weight. At least one of the two models must stay on.',
  'pricing.pickup_based.base_rate_first_kg':
    'Covers the first kilogram of any pickup. Set 1,000 → a 0.4 kg parcel still bills 1,000 XAF.',
  'pricing.pickup_based.additional_per_kg':
    'Added for every kilogram past the first. With a 1,000 base and 250 here, a 4 kg parcel bills 1,000 + 3 × 250 = 1,750 XAF.',
  'pricing.pickup_based.out_of_region_surcharge':
    'Added on top of the weight price when the drop-off falls outside your coverage regions. Set 2,000 and that 4 kg parcel bills 3,750 XAF.',

  // Additional fees
  'pricing.additional_fees.cod_handling_fee.type':
    'Percentage bills a share of the order value; Fixed bills a flat amount. Changing the type re-reads the value beside it — 2 means 2% under Percentage, and 2 XAF under Fixed.',
  'pricing.additional_fees.cod_handling_fee.value':
    'Your fee for collecting and remitting the cash. At Percentage 2, a 50,000 XAF COD order earns you 1,000 XAF.',
  'pricing.additional_fees.failed_delivery_fee':
    'Charged when the agent reaches the customer but the handover fails — nobody home, or refused at the door. Set 500 and each failed attempt still bills 500 XAF.',
  'pricing.additional_fees.rto_fee':
    'Charged when a shipment goes back to the vendor undelivered. It replaces the delivery fee for that shipment — you earn the RTO fee instead of it, not on top of it.',
  'pricing.additional_fees.peak_season_surcharge':
    'A flat amount added to each order during periods you declare busy. Leave it at 0 to never surcharge.',
  'pricing.notes':
    'Free text shown to vendors alongside your rates. Use it for anything the fields above can\'t express — volume discounts, fragile-goods handling.',

  // Cash on delivery
  'cod.enabled':
    'Whether you accept cash-on-delivery orders at all. Off, and vendors can only route prepaid orders to you. This is separate from the COD handling fee above, which prices the ones you do accept.',
  'cod.max_order_amount':
    'Orders worth more than this are never offered to you as COD. Leave it empty for no cap; set 200,000 and a 250,000 XAF cart has to be prepaid.',

  // Returns
  'returns.payer':
    'Who is billed for the return trip. "Vendor" deducts it from the vendor, "Agency" means you absorb it, "Customer" bills it at collection.',
  'returns.handling_fee':
    'Your fee for processing a return once it is back with you. Set 1,000 and each returned order bills 1,000 XAF on top of the return trip itself.',
  'returns.return_window_days':
    'How long after delivery a return can still be raised. Set 7 → an order delivered on the 1st can be returned until the 8th; on the 9th it is refused.',
  'returns.notes':
    'Conditions the fields above can\'t express, shown to vendors before they connect. E.g. "only unopened items, original seal intact".',

  // Damage
  'damage.claim_deadline_days':
    'How long after delivery a damage claim can still be filed against you. Set 7 and a claim raised on day 8 is out of time.',
  'damage.max_refund_per_item':
    'Caps what you pay out per damaged item, whatever the item is worth. Set 50,000 and a 200,000 XAF item still settles at 50,000.',
  'damage.notes':
    'What you require before accepting a claim — photos, original packaging, an unboxing video.',
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
  const hint = POLICY_FIELD_HINTS[name];
  return (
    <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
      <span>{children}</span>
      {hint && <InfoHint label={`About this field`}>{hint}</InfoHint>}
    </Label>
  );
}

/** The same label treatment for the switch rows, which use a <p>, not a <Label>. */
function ToggleLabel({ name, children }: { name: string; children: React.ReactNode }) {
  const hint = POLICY_FIELD_HINTS[name];
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium">
      <span>{children}</span>
      {hint && <InfoHint label={`About this setting`}>{hint}</InfoHint>}
    </p>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  short,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  /** Mobile stand-in for `description`; the full text moves behind the ⓘ. */
  short?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h4 className="font-medium">{title}</h4>
        {description && short && (
          <InfoHint className="md:hidden" label={`About ${title}`}>
            {description}
          </InfoHint>
        )}
      </div>
      {description && (
        <p className={cn('text-sm text-muted-foreground -mt-2', short && 'max-md:hidden')}>
          {description}
        </p>
      )}
      {short && <p className="text-sm text-muted-foreground -mt-2 md:hidden">{short}</p>}
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
  const { session, updateAgencyProfile, isSubmitting } = useOnboarding();
  const roleEntity = session?.role_entity;
  const [apiError, setApiError] = useState<string | null>(null);

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
    resolver: zodResolver(policiesSchema) as any,
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
      toast.success('Policies saved!');
    } catch (err) {
      setApiError(getApiErrorMessage(err));
    }
  }, [updateAgencyProfile, documents, reset]);

  const handleDiscard = useCallback(() => {
    reset(baseline);
    setDocuments(savedDocuments);
    setApiError(null);
  }, [reset, baseline, savedDocuments]);

  // The bar sits at the bottom of the viewport, far from the field that failed —
  // so an invalid submit says so out loud instead of only marking the input.
  const submit = handleSubmit(onSubmit, () =>
    toast.error('Please fix the highlighted fields before saving.'),
  );

  return (
    <>
    <Card className={sectionSurfaceClass}>
      <SectionHeading
        title="Pricing, Returns & Damage Policies"
        description="These policies apply to every vendor and customer you deliver for"
        short="Applies to every vendor"
      />
      <CardContent className="space-y-8 max-md:px-0">
        {apiError && <div role="alert" className="p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200">{apiError}</div>}

        <form onSubmit={submit} className="space-y-8" noValidate>
          <Section
            icon={DollarSign}
            title="Pricing"
            description="Set your rates for each fulfilment model. At least one must be enabled."
            short="Your rates"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <ToggleLabel name="pricing.storage_based.enabled">Storage-based fees</ToggleLabel>
                <Controller control={control} name="pricing.storage_based.enabled" render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!pickupEnabled} />
                )} />
              </div>
              {storageEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <FieldLabel name="pricing.storage_based.monthly_storage_fee_per_sku">
                      Monthly storage fee / SKU (XAF)
                    </FieldLabel>
                    <Input type="number" min={0} {...register('pricing.storage_based.monthly_storage_fee_per_sku')} />
                    {pe?.storage_based?.monthly_storage_fee_per_sku && <p className="text-xs text-red-500">{pe.storage_based.monthly_storage_fee_per_sku.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel name="pricing.storage_based.pick_pack_fee_per_order">
                      Pick &amp; pack fee / order (XAF)
                    </FieldLabel>
                    <Input type="number" min={0} {...register('pricing.storage_based.pick_pack_fee_per_order')} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel name="pricing.storage_based.local_delivery_fee">
                      Local delivery fee (XAF)
                    </FieldLabel>
                    <Input type="number" min={0} {...register('pricing.storage_based.local_delivery_fee')} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel name="pricing.storage_based.out_of_region_delivery_fee">
                      Out-of-region delivery fee (XAF)
                    </FieldLabel>
                    <Input type="number" min={0} {...register('pricing.storage_based.out_of_region_delivery_fee')} />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <ToggleLabel name="pricing.pickup_based.enabled">Pickup-based fees</ToggleLabel>
                <Controller control={control} name="pricing.pickup_based.enabled" render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!storageEnabled} />
                )} />
              </div>
              {pickupEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <FieldLabel name="pricing.pickup_based.base_rate_first_kg">
                      Base rate — first kg (XAF)
                    </FieldLabel>
                    <Input type="number" min={0} {...register('pricing.pickup_based.base_rate_first_kg')} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel name="pricing.pickup_based.additional_per_kg">
                      Additional per kg (XAF)
                    </FieldLabel>
                    <Input type="number" min={0} {...register('pricing.pickup_based.additional_per_kg')} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel name="pricing.pickup_based.out_of_region_surcharge">
                      Out-of-region surcharge (XAF)
                    </FieldLabel>
                    <Input type="number" min={0} {...register('pricing.pickup_based.out_of_region_surcharge')} />
                  </div>
                </div>
              )}
              {(pe as { storage_based?: { enabled?: { message?: string } } } | undefined)?.storage_based?.enabled && (
                <p className="text-xs text-red-500">{(pe as { storage_based?: { enabled?: { message?: string } } }).storage_based?.enabled?.message}</p>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">Additional fees</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel name="pricing.additional_fees.cod_handling_fee.type">
                    COD handling fee type
                  </FieldLabel>
                  <Controller control={control} name="pricing.additional_fees.cod_handling_fee.type" render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed amount (XAF)</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel name="pricing.additional_fees.cod_handling_fee.value">
                    COD handling fee value
                  </FieldLabel>
                  <Input type="number" min={0} placeholder="e.g. 2" {...register('pricing.additional_fees.cod_handling_fee.value')} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel name="pricing.additional_fees.failed_delivery_fee">
                    Failed delivery fee (XAF)
                  </FieldLabel>
                  <Input type="number" min={0} {...register('pricing.additional_fees.failed_delivery_fee')} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel name="pricing.additional_fees.rto_fee">RTO fee (XAF)</FieldLabel>
                  <Input type="number" min={0} {...register('pricing.additional_fees.rto_fee')} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel name="pricing.additional_fees.peak_season_surcharge">
                    Peak season surcharge (XAF)
                  </FieldLabel>
                  <Input type="number" min={0} placeholder="0" {...register('pricing.additional_fees.peak_season_surcharge')} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel name="pricing.notes">Pricing notes</FieldLabel>
              <Textarea rows={2} placeholder="Any additional pricing notes..." {...register('pricing.notes')} />
            </div>
          </Section>

          <Separator />

          <Section
            icon={Banknote}
            title="Cash on Delivery"
            description="Whether your agency accepts cash-on-delivery orders at all — separate from the COD handling fee above."
            short="Whether you accept COD"
          >
            <div className="flex items-center justify-between">
              <ToggleLabel name="cod.enabled">Accept cash-on-delivery orders</ToggleLabel>
              <Controller control={control} name="cod.enabled" render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )} />
            </div>
            {codEnabled && (
              <div className="space-y-1.5">
                <FieldLabel name="cod.max_order_amount">Max COD order amount (XAF)</FieldLabel>
                <Input type="number" min={0} placeholder="No cap" {...register('cod.max_order_amount')} />
                {errors.cod?.max_order_amount && <p className="text-xs text-red-500">{errors.cod.max_order_amount.message}</p>}
              </div>
            )}
          </Section>

          <Separator />

          <Section icon={RotateCcw} title="Returns Policy">
            <div className="space-y-1.5">
              <FieldLabel name="returns.payer">Return cost paid by</FieldLabel>
              <Controller control={control} name="returns.payer" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select who bears return costs" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                  </SelectContent>
                </Select>
              )} />
              {re?.payer && <p className="text-xs text-red-500">{re.payer.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <FieldLabel name="returns.handling_fee">Handling fee (XAF)</FieldLabel>
                <Input type="number" min={0} {...register('returns.handling_fee')} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel name="returns.return_window_days">Return window (days)</FieldLabel>
                <Input type="number" min={0} placeholder="7" {...register('returns.return_window_days')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel name="returns.notes">Returns notes</FieldLabel>
              <Textarea rows={2} placeholder="E.g. only unopened items accepted..." {...register('returns.notes')} />
            </div>
          </Section>

          <Separator />

          <Section icon={AlertTriangle} title="Damage Policy">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <FieldLabel name="damage.claim_deadline_days">Claim deadline (days)</FieldLabel>
                <Input type="number" min={0} placeholder="7" {...register('damage.claim_deadline_days')} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel name="damage.max_refund_per_item">Max refund per item (XAF)</FieldLabel>
                <Input type="number" min={0} {...register('damage.max_refund_per_item')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel name="damage.notes">Damage notes</FieldLabel>
              <Textarea rows={2} placeholder="E.g. original packaging required..." {...register('damage.notes')} />
            </div>
            {de?.claim_deadline_days && <p className="text-xs text-red-500">{de.claim_deadline_days.message}</p>}
          </Section>

          <Separator />

          <Section
            icon={FileText}
            title="Supporting Documents"
            description="Optional signed PDF addenda (max 2) for terms not covered above."
            short="Optional PDF addenda"
          >
            {documents.length > 0 && (
              <div className="space-y-1">
                {documents.map((url, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm rounded-md border px-2 py-1">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <a href={url} target="_blank" rel="noopener noreferrer" className="truncate flex-1 hover:underline">
                      {url.split('/').pop() ?? `Document ${i + 1}`}
                    </a>
                    <button type="button" onClick={() => setDocuments((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
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
              Add document ({documents.length}/2)
            </Button>

            <MediaPicker
              open={docPickerOpen}
              onClose={() => setDocPickerOpen(false)}
              multiple
              maxFiles={remainingDocs}
              acceptedTypes={['document']}
              onSelect={(picked) =>
                setDocuments((prev) => [
                  ...prev,
                  ...picked.slice(0, 2 - prev.length).map((f) => resolveFileUrl(f)),
                ])
              }
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
