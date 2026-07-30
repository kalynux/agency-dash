import { useCallback, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, DollarSign, RotateCcw, AlertTriangle, Banknote, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { MediaPicker } from '@/components/features/MediaPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { policiesSchema, type PoliciesFormValues } from '@/onboarding/schemas/onboarding.schemas';
import { resolveFileUrl } from '@/services/files.service';
import { getApiErrorMessage } from '@/lib/errors';

function Section({ icon: Icon, title, description, children }: { icon: React.ElementType; title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h4 className="font-medium">{title}</h4>
      </div>
      {description && <p className="text-sm text-muted-foreground -mt-2">{description}</p>}
      {children}
    </div>
  );
}

export function PoliciesSettings() {
  const { session, updateAgencyProfile, isSubmitting } = useOnboarding();
  const roleEntity = session?.role_entity;
  const existing = roleEntity?.policies;
  const [apiError, setApiError] = useState<string | null>(null);
  // policies.documents — existing URLs (full-replace on save; resend to keep).
  const [documents, setDocuments] = useState<string[]>(existing?.documents ?? []);
  const [docPickerOpen, setDocPickerOpen] = useState(false);

  const remainingDocs = 2 - documents.length;

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<PoliciesFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(policiesSchema) as any,
    defaultValues: {
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
    },
  });

  const storageEnabled = watch('pricing.storage_based.enabled');
  const pickupEnabled = watch('pricing.pickup_based.enabled');
  const codEnabled = watch('cod.enabled');
  const pe = errors.pricing;
  const re = errors.returns;
  const de = errors.damage;

  const onSubmit = useCallback(async (values: PoliciesFormValues) => {
    setApiError(null);
    try {
      // Post-onboarding edit → PATCH /api/agency/profile. `documents` is full-replace.
      await updateAgencyProfile({ policies: { ...values, documents } });
      toast.success('Policies saved!');
    } catch (err) {
      setApiError(getApiErrorMessage(err));
    }
  }, [updateAgencyProfile, documents]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing, Returns &amp; Damage Policies</CardTitle>
        <CardDescription>These policies apply to every vendor and customer you deliver for</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {apiError && <div role="alert" className="p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200">{apiError}</div>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
          <Section icon={DollarSign} title="Pricing" description="Set your rates for each fulfilment model. At least one must be enabled.">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Storage-based fees</p>
                <Controller control={control} name="pricing.storage_based.enabled" render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!pickupEnabled} />
                )} />
              </div>
              {storageEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Monthly storage fee / SKU (XAF)</Label>
                    <Input type="number" min={0} {...register('pricing.storage_based.monthly_storage_fee_per_sku')} />
                    {pe?.storage_based?.monthly_storage_fee_per_sku && <p className="text-xs text-red-500">{pe.storage_based.monthly_storage_fee_per_sku.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pick &amp; pack fee / order (XAF)</Label>
                    <Input type="number" min={0} {...register('pricing.storage_based.pick_pack_fee_per_order')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Local delivery fee (XAF)</Label>
                    <Input type="number" min={0} {...register('pricing.storage_based.local_delivery_fee')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Out-of-region delivery fee (XAF)</Label>
                    <Input type="number" min={0} {...register('pricing.storage_based.out_of_region_delivery_fee')} />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Pickup-based fees</p>
                <Controller control={control} name="pricing.pickup_based.enabled" render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!storageEnabled} />
                )} />
              </div>
              {pickupEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Base rate — first kg (XAF)</Label>
                    <Input type="number" min={0} {...register('pricing.pickup_based.base_rate_first_kg')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Additional per kg (XAF)</Label>
                    <Input type="number" min={0} {...register('pricing.pickup_based.additional_per_kg')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Out-of-region surcharge (XAF)</Label>
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
                  <Label>COD handling fee type</Label>
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
                  <Label>COD handling fee value</Label>
                  <Input type="number" min={0} placeholder="e.g. 2" {...register('pricing.additional_fees.cod_handling_fee.value')} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Failed delivery fee (XAF)</Label>
                  <Input type="number" min={0} {...register('pricing.additional_fees.failed_delivery_fee')} />
                </div>
                <div className="space-y-1.5">
                  <Label>RTO fee (XAF)</Label>
                  <Input type="number" min={0} {...register('pricing.additional_fees.rto_fee')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Peak season surcharge (XAF)</Label>
                  <Input type="number" min={0} placeholder="0" {...register('pricing.additional_fees.peak_season_surcharge')} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Pricing notes</Label>
              <Textarea rows={2} placeholder="Any additional pricing notes..." {...register('pricing.notes')} />
            </div>
          </Section>

          <Separator />

          <Section icon={Banknote} title="Cash on Delivery" description="Whether your agency accepts cash-on-delivery orders at all — separate from the COD handling fee above.">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Accept cash-on-delivery orders</p>
              <Controller control={control} name="cod.enabled" render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )} />
            </div>
            {codEnabled && (
              <div className="space-y-1.5">
                <Label>Max COD order amount (XAF)</Label>
                <Input type="number" min={0} placeholder="No cap" {...register('cod.max_order_amount')} />
                {errors.cod?.max_order_amount && <p className="text-xs text-red-500">{errors.cod.max_order_amount.message}</p>}
              </div>
            )}
          </Section>

          <Separator />

          <Section icon={RotateCcw} title="Returns Policy">
            <div className="space-y-1.5">
              <Label>Return cost paid by</Label>
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
                <Label>Handling fee (XAF)</Label>
                <Input type="number" min={0} {...register('returns.handling_fee')} />
              </div>
              <div className="space-y-1.5">
                <Label>Return window (days)</Label>
                <Input type="number" min={0} placeholder="7" {...register('returns.return_window_days')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Returns notes</Label>
              <Textarea rows={2} placeholder="E.g. only unopened items accepted..." {...register('returns.notes')} />
            </div>
          </Section>

          <Separator />

          <Section icon={AlertTriangle} title="Damage Policy">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Claim deadline (days)</Label>
                <Input type="number" min={0} placeholder="7" {...register('damage.claim_deadline_days')} />
              </div>
              <div className="space-y-1.5">
                <Label>Max refund per item (XAF)</Label>
                <Input type="number" min={0} {...register('damage.max_refund_per_item')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Damage notes</Label>
              <Textarea rows={2} placeholder="E.g. original packaging required..." {...register('damage.notes')} />
            </div>
            {de?.claim_deadline_days && <p className="text-xs text-red-500">{de.claim_deadline_days.message}</p>}
          </Section>

          <Separator />

          <Section icon={FileText} title="Supporting Documents" description="Optional signed PDF addenda (max 2) for terms not covered above.">
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

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save Policies'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
