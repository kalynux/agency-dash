import { useCallback, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, Plus, Trash2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { logisticsSchema, type LogisticsFormValues, type HeadquartersAddressFormValues } from '@/onboarding/schemas/onboarding.schemas';
import { getApiErrorMessage } from '@/lib/errors';
import locationsData from '@/constants/locations.json';

type RegionEntry = { key: string; label: string; cities: string[] };
const REGIONS: RegionEntry[] = Object.entries(locationsData.countries.cm.regions).map(([key, val]) => ({
  key, label: val.name.en, cities: val.cities,
}));

function getCities(regionLabel: string) {
  return REGIONS.find(r => r.label === regionLabel)?.cities ?? [];
}

const EMPTY_HQ = {
  region: '', city: '', address_description: '',
  support_contact: { phone: '', email: '' },
  latitude: undefined, longitude: undefined,
} as unknown as HeadquartersAddressFormValues;

export function BusinessSettings() {
  const { session, updateAgencyProfile, isSubmitting } = useOnboarding();
  const roleEntity = session?.role_entity;
  const [apiError, setApiError] = useState<string | null>(null);

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<LogisticsFormValues>({
    resolver: zodResolver(logisticsSchema),
    defaultValues: {
      coverage_areas: roleEntity?.coverage_areas ?? [],
      headquarters_addresses: roleEntity?.headquarters_addresses?.length
        ? roleEntity.headquarters_addresses.map(addr => ({
          region: addr.region, city: addr.city, address_description: addr.address_description,
          support_contact: { phone: addr.support_contact.phone, email: addr.support_contact.email ?? '' },
          latitude: addr.location?.coordinates?.[1],
          longitude: addr.location?.coordinates?.[0],
        } as HeadquartersAddressFormValues))
        : [{ ...EMPTY_HQ }],
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
    try {
      // Post-onboarding edit → PATCH /api/agency/profile (full-replace arrays).
      await updateAgencyProfile({
        coverage_areas: values.coverage_areas,
        headquarters_addresses: values.headquarters_addresses.map(addr => {
          const { email, ...rest } = addr.support_contact;
          const validEmail = email?.trim() || undefined;
          const { latitude, longitude, ...addrRest } = addr;
          return {
            ...addrRest,
            support_contact: { ...rest, ...(validEmail ? { email: validEmail } : {}) },
            location: { type: 'Point' as const, coordinates: [longitude, latitude] as [number, number] },
          };
        }),
      });
      toast.success('Business details saved!');
    } catch (err) {
      setApiError(getApiErrorMessage(err));
    }
  }, [updateAgencyProfile]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Details</CardTitle>
        <CardDescription>Coverage regions and headquarters addresses</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {apiError && <div role="alert" className="p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200">{apiError}</div>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div>
            <Label className="mb-2 block">Coverage Regions</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {REGIONS.map(({ key, label }) => {
                const isChecked = (selectedAreas ?? []).includes(key);
                return (
                  <label key={key} className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer">
                    <Checkbox checked={isChecked} onCheckedChange={(c) => toggleRegion(key, !!c)} />
                    <span className="text-sm">{label}</span>
                  </label>
                );
              })}
            </div>
            {errors.coverage_areas && <p className="text-xs text-red-500 mt-2">{errors.coverage_areas.message}</p>}
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Headquarters Addresses</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ ...EMPTY_HQ })} className="gap-1">
                <Plus className="w-3.5 h-3.5" /> Add address
              </Button>
            </div>
            <div className="space-y-4">
              {fields.map((field, index) => {
                const addrErrors = errors.headquarters_addresses?.[index];
                const selectedRegion = watch(`headquarters_addresses.${index}.region`);
                const cities = getCities(selectedRegion ?? '');
                return (
                  <div key={field.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {index === 0 ? 'Primary Headquarters' : `Branch Address ${index + 1}`}
                      </span>
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(index)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Region</Label>
                        <Controller control={control} name={`headquarters_addresses.${index}.region`} render={({ field: f }) => (
                          <Select value={f.value} onValueChange={(v) => { f.onChange(v); setValue(`headquarters_addresses.${index}.city`, ''); }}>
                            <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                            <SelectContent>
                              {REGIONS.filter(r => (selectedAreas ?? []).includes(r.key)).map(r => (
                                <SelectItem key={r.label} value={r.label}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )} />
                        {addrErrors?.region && <p className="text-xs text-red-500">{addrErrors.region.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>City</Label>
                        <Controller control={control} name={`headquarters_addresses.${index}.city`} render={({ field: f }) => (
                          <Select value={f.value} onValueChange={f.onChange} disabled={!selectedRegion}>
                            <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                            <SelectContent>
                              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )} />
                        {addrErrors?.city && <p className="text-xs text-red-500">{addrErrors.city.message}</p>}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />Street Address</Label>
                      <Input placeholder="e.g. Akwa, Rue Sylvani, 3rd floor" {...register(`headquarters_addresses.${index}.address_description`)} />
                      {addrErrors?.address_description && <p className="text-xs text-red-500">{addrErrors.address_description.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Latitude</Label>
                        <Input type="number" step="any" inputMode="decimal" placeholder="4.0511" {...register(`headquarters_addresses.${index}.latitude`, { valueAsNumber: true })} />
                        {addrErrors?.latitude && <p className="text-xs text-red-500">{addrErrors.latitude.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Longitude</Label>
                        <Input type="number" step="any" inputMode="decimal" placeholder="9.7679" {...register(`headquarters_addresses.${index}.longitude`, { valueAsNumber: true })} />
                        {addrErrors?.longitude && <p className="text-xs text-red-500">{addrErrors.longitude.message}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Support Phone</Label>
                        <Input placeholder="+237 6XX XXX XXX" {...register(`headquarters_addresses.${index}.support_contact.phone`)} />
                        {addrErrors?.support_contact?.phone && <p className="text-xs text-red-500">{addrErrors.support_contact.phone.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Support Email (optional)</Label>
                        <Input placeholder="support@youragency.com" {...register(`headquarters_addresses.${index}.support_contact.email`)} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
