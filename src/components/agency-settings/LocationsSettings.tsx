import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building, Info, Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useResource } from '@/hooks/useResource';
import { magazinService } from '@/services/magazin.service';
import { agencyProfileService } from '@/services/agency-profile.service';
import { getApiErrorMessage } from '@/lib/errors';
import type { AnyTFunction } from '@/i18n/tx';
import { regionsFor } from '@/lib/regions';
import { ApiError } from '@/types/api';
import { cn } from '@/lib/utils';
import type {
  AgencyMagazin,
  MagazinHeadquartersAddress,
  MagazinHeadquartersAddressInput,
  MagazinUpdatePayload,
} from '@/types/magazin.types';
import type { GeoAddress } from '@/types/geo.types';

import { AddressSearchInput } from '@/components/common/AddressSearchInput';
import { LoadingState, ErrorState } from '@/components/common/state-views';
import { UnsavedChangesBar } from '@/components/agency-settings/UnsavedChangesBar';
import { InfoHint, SectionHeading } from '@/components/common/InfoHint';
import { noteSurfaceClass, sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Coverage regions + headquarters/pickup addresses — the agency's operational
 * footprint.
 *
 * These live on the **magazin** (`PATCH /api/agency/magazin`), NOT the profile —
 * the profile only keeps the set-once `country` that anchors them. Both arrays
 * are a FULL REPLACE and the endpoint uses optimistic locking, so every save
 * sends the complete desired value plus the current `version`.
 *
 * Address entry mirrors the vendor dashboard's Account → Addresses screen: the
 * agency searches for the location, picks a candidate, and everything the
 * backend needs beyond a free-text `label` is **derived from that candidate** —
 * `region`, `city` and `location` are all derived server-side from `geo`, so
 * none of them are sent. There are no region/city pickers; the optional inputs
 * that appear when the provider named neither are just a chance to name a rural
 * or landmark place, and `null` is a perfectly valid answer.
 *
 * See api-doc/agency/magazin.md and api-doc/geo/README.md.
 */

/** One HQ row in local form state. `pristine` drives grandfathering on save. */
interface HqFormEntry {
  /** Stable key for React across add/remove. */
  uid: string;
  label: string;
  address_description: string;
  phone: string;
  email: string;
  geo: GeoAddress | null;
  /** Derived from `geo.components` on pick; typed by hand only if the provider omitted it. */
  region: string;
  city: string;
  /** The row exactly as loaded — re-sent verbatim while `pristine`. */
  original: MagazinHeadquartersAddress | null;
  pristine: boolean;
}

interface FormState {
  coverageAreas: string[];
  addresses: HqFormEntry[];
}

let uidCounter = 0;
const nextUid = () => `hq-${++uidCounter}`;

function emptyEntry(): HqFormEntry {
  return {
    uid: nextUid(),
    label: '',
    address_description: '',
    phone: '',
    email: '',
    geo: null,
    region: '',
    city: '',
    original: null,
    pristine: false,
  };
}

function toForm(magazin: AgencyMagazin): FormState {
  const addresses = (magazin.headquartersAddresses ?? []).map<HqFormEntry>((addr) => ({
    uid: nextUid(),
    label: addr.label ?? '',
    address_description: addr.address_description ?? '',
    phone: addr.support_contact?.phone ?? '',
    email: addr.support_contact?.email ?? '',
    geo: addr.geo ?? null,
    region: addr.region ?? '',
    city: addr.city ?? '',
    original: addr,
    pristine: true,
  }));

  return {
    coverageAreas: magazin.coverageAreas ?? [],
    addresses: addresses.length > 0 ? addresses : [emptyEntry()],
  };
}

/** Identity of a geocoded place — its coordinates are what "same place" means. */
function placeKey(geo: GeoAddress | null): string {
  if (!geo) return '';
  const [lng, lat] = geo.coordinates.coordinates;
  return `${lng},${lat}`;
}

/**
 * Does this row need a freshly-picked `geo` before it can be saved?
 *
 * An entry is "unchanged" — and so grandfathered past `ADDRESS_GEO_REQUIRED` —
 * while its `address_description` AND its geocoded place both still match what
 * is stored. Renaming a label or fixing a support phone is not a move, so legacy
 * rows that predate map search survive a re-save untouched.
 */
function requiresGeo(entry: HqFormEntry): boolean {
  const stored = entry.original;
  if (!stored) return true; // brand-new row
  if (entry.address_description.trim() !== (stored.address_description ?? '')) return true;
  return placeKey(entry.geo) !== placeKey(stored.geo ?? null);
}

/**
 * Build one outgoing HQ entry. `location`, `region` and `city` are all derived
 * from `geo` server-side, so a geocoded row sends none of them — region/city go
 * out only as the fallback for a place whose geocode named neither.
 *
 * Note `headquarters_addresses` is a FULL REPLACE, so every row is written on
 * every save — including ones the agency never touched.
 */
function toAddressPayload(entry: HqFormEntry): MagazinHeadquartersAddressInput {
  const payload: MagazinHeadquartersAddressInput = {
    label: entry.label.trim(),
    address_description: entry.address_description.trim(),
    support_contact: {
      phone: entry.phone.trim(),
      // Clearable field: empty input → explicit null.
      email: entry.email.trim() || null,
    },
    geo: entry.geo,
  };
  if (!entry.geo?.components.region && entry.region.trim()) payload.region = entry.region.trim();
  if (!entry.geo?.components.city && entry.city.trim()) payload.city = entry.city.trim();
  return payload;
}

function sameCoverage(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

type FieldErrors = Record<string, string>;

function validate(form: FormState, t: AnyTFunction): FieldErrors {
  const errors: FieldErrors = {};
  const v = (key: string) => t(`settings:locations.validation.${key}` as never) as unknown as string;

  if (form.coverageAreas.length === 0) {
    errors.coverage = v('coverageRequired');
  }
  if (form.addresses.length === 0) {
    errors.addresses = v('addressRequired');
  }

  // Every row is validated, touched or not — the array is a full replace, so an
  // untouched row is still (re)written and must satisfy the write schema. Only
  // the `geo` requirement is relaxed for rows that haven't moved.
  form.addresses.forEach((entry, index) => {
    const label = entry.label.trim();
    if (!label) errors[`${index}.label`] = v('labelRequired');
    else if (label.length > 50) errors[`${index}.label`] = v('labelMax');
    if (!entry.geo && requiresGeo(entry)) {
      errors[`${index}.geo`] = v('geoRequired');
    }
    // `region` / `city` are derived from `geo` and may legitimately end up null —
    // nothing to validate.
    const desc = entry.address_description.trim();
    if (!desc) errors[`${index}.address_description`] = v('streetRequired');
    else if (desc.length > 200) errors[`${index}.address_description`] = v('streetMax');
    const phone = entry.phone.trim();
    if (phone.length < 6 || phone.length > 20) {
      errors[`${index}.phone`] = v('phoneLength');
    } else if (!/^\+?[0-9\s\-()]+$/.test(phone)) {
      errors[`${index}.phone`] = v('phoneFormat');
    }
    const email = entry.email.trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      errors[`${index}.email`] = v('email');
    }
  });

  return errors;
}

export function LocationsSettings() {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const {
    data: magazin,
    isLoading,
    error,
    refetch,
    setData,
  } = useResource(() => magazinService.getMagazin(), []);

  // The operating country anchors both the region list and the geo search bias.
  // It lives on the profile, not the magazin, so it is read separately.
  const { data: country } = useResource(
    () => agencyProfileService.getProfile().then((r) => r.data.country),
    [],
  );

  const [form, setForm] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Removing an already-saved address is confirmed first — it may still be
  // referenced by assignments, so it's worth a deliberate click.
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

  // Region labels come out of locations.json in the active language.
  const regions = useMemo(() => regionsFor(country, i18n.language), [country, i18n.language]);
  const geoBias = (country ?? '').toLowerCase() || undefined;

  // (Re)seed the form whenever the underlying magazin changes (load / save).
  useEffect(() => {
    if (magazin) {
      setForm(toForm(magazin));
      setFieldErrors({});
    }
  }, [magazin]);

  const toggleRegion = useCallback((key: string, checked: boolean) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = checked
        ? [...prev.coverageAreas, key]
        : prev.coverageAreas.filter((k) => k !== key);
      return { ...prev, coverageAreas: next };
    });
    setFieldErrors((prev) => ({ ...prev, coverage: '' }));
  }, []);

  /** Patch one address row. Any edit drops `pristine`, forcing a fresh `geo`. */
  const patchEntry = useCallback((index: number, patch: Partial<HqFormEntry>) => {
    setForm((prev) => {
      if (!prev) return prev;
      const addresses = prev.addresses.map((entry, i) =>
        i === index ? { ...entry, ...patch, pristine: false } : entry,
      );
      return { ...prev, addresses };
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      Object.keys(patch).forEach((key) => delete next[`${index}.${key}`]);
      return next;
    });
  }, []);

  /**
   * A picked candidate is what makes the entry storable — and what fills it in.
   * Region, city and the street line all come off the resolved components, so
   * the agency normally only types a label and a support phone.
   */
  const handleGeoSelect = useCallback((index: number, address: GeoAddress) => {
    const { street, city, region } = address.components;
    patchEntry(index, {
      geo: address,
      region: region?.trim() ?? '',
      city: city?.trim() ?? '',
      address_description: (street?.trim() || address.formatted_address).slice(0, 200),
    });
  }, [patchEntry]);

  const addAddress = useCallback(() => {
    setForm((prev) => (prev ? { ...prev, addresses: [...prev.addresses, emptyEntry()] } : prev));
  }, []);

  const removeAddress = useCallback((index: number) => {
    setForm((prev) =>
      prev ? { ...prev, addresses: prev.addresses.filter((_, i) => i !== index) } : prev,
    );
  }, []);

  const dirty = useMemo(() => {
    if (!magazin || !form) return false;
    if (!sameCoverage(form.coverageAreas, magazin.coverageAreas ?? [])) return true;
    if (form.addresses.length !== (magazin.headquartersAddresses ?? []).length) return true;
    return form.addresses.some((entry) => !entry.pristine);
  }, [magazin, form]);

  const handleDiscard = useCallback(() => {
    if (magazin) {
      setForm(toForm(magazin));
      setFieldErrors({});
      setSaveError(null);
    }
  }, [magazin]);

  const handleSave = useCallback(async () => {
    if (!magazin || !form) return;

    const errors = validate(form, t);
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors);
      setSaveError(t('common.fixHighlighted'));
      return;
    }

    // Both arrays are a full replace — always send the complete desired value.
    const payload: MagazinUpdatePayload = {
      version: magazin.version,
      coverage_areas: form.coverageAreas,
      headquarters_addresses: form.addresses.map(toAddressPayload),
    };

    setSaving(true);
    setSaveError(null);
    try {
      const updated = await magazinService.updateMagazin(payload);
      setData(updated);
      toast.success(t('locations.saved'));
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        // Optimistic-locking clash — refresh so the agency edits the latest.
        toast.error(t('locations.conflict'));
        await refetch();
      } else {
        setSaveError(getApiErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }, [magazin, form, setData, refetch, t]);

  if (isLoading && !magazin) return <LoadingState label={t('locations.loading')} />;
  if (error && !magazin) return <ErrorState error={error} onRetry={refetch} />;
  if (!magazin || !form) return null;

  // No `sectionGroupClass` here: the only two Cards are the coverage section and
  // the trailing note, and the note keeps its own tinted panel on mobile — a
  // rule above it as well would be one separator too many, and the group's
  // `pt-6` would out-specify the note's own padding.
  return (
    <div className="space-y-6">
      {saveError && (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {/* ─── Coverage regions ──────────────────────────────────────────────── */}
      <Card className={sectionSurfaceClass}>
        <SectionHeading
          title={t('locations.title')}
          description={t('locations.description')}
          short={t('locations.short')}
        />
        <CardContent className="space-y-6 max-md:px-0">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>{t('locations.coverageLabel')}</Label>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" /> {country ?? t('common:values.notAvailable')}
              </span>
            </div>
            {regions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('locations.noRegions')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {regions.map(({ key, label }) => {
                  const isChecked = form.coverageAreas.includes(key);
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(c) => toggleRegion(key, !!c)}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {fieldErrors.coverage && (
              <p className="mt-2 text-xs text-destructive">{fieldErrors.coverage}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">{t('locations.coverageHint')}</p>
          </div>

          <Separator />

          {/* ─── HQ addresses ───────────────────────────────────────────── */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                {t('locations.addressesLabel')}
                <InfoHint className="md:hidden" label={t('locations.addressesAboutLabel')}>
                  {t('locations.addressesHint')}
                </InfoHint>
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addAddress} className="gap-1">
                <Plus className="w-3.5 h-3.5" /> {t('locations.addAddress')}
              </Button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground max-md:hidden">
              {t('locations.addressesHint')}
            </p>
            {fieldErrors.addresses && (
              <p className="mb-2 text-xs text-destructive">{fieldErrors.addresses}</p>
            )}

            <div className="space-y-4">
              {form.addresses.map((entry, index) => (
                <div key={entry.uid} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Building className="w-3.5 h-3.5" />
                      {/* Entries saved before labels existed read back null. */}
                      {entry.label.trim() ||
                        (index === 0
                          ? t('locations.primaryHeadquarters')
                          : t('locations.branchAddress', { number: index + 1 }))}
                    </span>
                    {form.addresses.length > 1 && (
                      <button
                        type="button"
                        aria-label={t('locations.removeAddress')}
                        onClick={() =>
                          entry.original ? setConfirmRemove(index) : removeAddress(index)
                        }
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Address search — fills everything below and pins the coordinates */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      {t('locations.findAddress')}
                      <InfoHint className="md:hidden" label={t('locations.findAddressAboutLabel')}>
                        {t('locations.findAddressHint')}
                      </InfoHint>
                    </Label>
                    <AddressSearchInput
                      value={entry.geo}
                      country={geoBias}
                      hasError={!!fieldErrors[`${index}.geo`]}
                      placeholder={t('locations.searchPlaceholder')}
                      onSelect={(address) => handleGeoSelect(index, address)}
                      onClear={() => patchEntry(index, { geo: null })}
                    />
                    {fieldErrors[`${index}.geo`] ? (
                      <p className="text-xs text-destructive">{fieldErrors[`${index}.geo`]}</p>
                    ) : entry.geo ? null : entry.original ? (
                      <p className="text-xs text-amber-600">{t('locations.legacyNoPin')}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground max-md:hidden">
                        {t('locations.pinRequired')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`hq-label-${entry.uid}`}>
                      {t('locations.label')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`hq-label-${entry.uid}`}
                      value={entry.label}
                      maxLength={50}
                      placeholder={t('locations.labelPlaceholder')}
                      className={cn(fieldErrors[`${index}.label`] && 'border-destructive')}
                      onChange={(e) => patchEntry(index, { label: e.target.value })}
                    />
                    {fieldErrors[`${index}.label`] ? (
                      <p className="text-xs text-destructive">{fieldErrors[`${index}.label`]}</p>
                    ) : (
                      // Saving replaces the whole list, so a stored entry with no label
                      // blocks the save — say so before they hit the button.
                      entry.original &&
                      !entry.original.label && (
                        <p className="text-xs text-amber-600">{t('locations.legacyNoLabel')}</p>
                      )
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`hq-street-${entry.uid}`} className="flex items-center gap-1.5">
                      <span>
                        {t('locations.street')} <span className="text-destructive">*</span>
                      </span>
                      <InfoHint className="md:hidden" label={t('locations.streetAboutLabel')}>
                        {t('locations.streetHint')}
                      </InfoHint>
                    </Label>
                    <Input
                      id={`hq-street-${entry.uid}`}
                      value={entry.address_description}
                      maxLength={200}
                      placeholder={t('locations.streetPlaceholder')}
                      className={cn(
                        fieldErrors[`${index}.address_description`] && 'border-destructive',
                      )}
                      onChange={(e) => patchEntry(index, { address_description: e.target.value })}
                    />
                    {fieldErrors[`${index}.address_description`] ? (
                      <p className="text-xs text-destructive">
                        {fieldErrors[`${index}.address_description`]}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground max-md:hidden">
                        {t('locations.streetHint')}
                      </p>
                    )}
                  </div>

                  {/* City / region are derived from `geo` server-side. We echo what the
                      map result named, and offer an optional input only where it named
                      nothing — `null` is a valid answer for a rural or landmark place. */}
                  {entry.geo && (entry.city || entry.region) && (
                    <p className="text-xs text-muted-foreground">
                      {[entry.city, entry.region].filter(Boolean).join(', ')}
                      <span className="ml-1 opacity-70">{t('locations.fromMapResult')}</span>
                    </p>
                  )}

                  {entry.geo && (!entry.city || !entry.region) && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {!entry.city && (
                        <div className="space-y-1.5">
                          <Label htmlFor={`hq-city-${entry.uid}`}>{t('locations.cityOptional')}</Label>
                          <Input
                            id={`hq-city-${entry.uid}`}
                            value={entry.city}
                            maxLength={100}
                            placeholder={t('locations.cityPlaceholder')}
                            onChange={(e) => patchEntry(index, { city: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">{t('locations.cityNotNamed')}</p>
                        </div>
                      )}
                      {!entry.region && (
                        <div className="space-y-1.5">
                          <Label htmlFor={`hq-region-${entry.uid}`}>
                            {t('locations.regionOptional')}
                          </Label>
                          <Input
                            id={`hq-region-${entry.uid}`}
                            value={entry.region}
                            maxLength={100}
                            placeholder={t('locations.regionPlaceholder')}
                            onChange={(e) => patchEntry(index, { region: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            {t('locations.regionNotNamed')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`hq-phone-${entry.uid}`}>
                        {t('locations.supportPhone')} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`hq-phone-${entry.uid}`}
                        value={entry.phone}
                        maxLength={20}
                        placeholder={t('locations.supportPhonePlaceholder')}
                        className={cn(fieldErrors[`${index}.phone`] && 'border-destructive')}
                        onChange={(e) => patchEntry(index, { phone: e.target.value })}
                      />
                      {fieldErrors[`${index}.phone`] && (
                        <p className="text-xs text-destructive">{fieldErrors[`${index}.phone`]}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`hq-email-${entry.uid}`}>{t('locations.supportEmail')}</Label>
                      <Input
                        id={`hq-email-${entry.uid}`}
                        value={entry.email}
                        type="email"
                        placeholder={t('locations.supportEmailPlaceholder')}
                        className={cn(fieldErrors[`${index}.email`] && 'border-destructive')}
                        onChange={(e) => patchEntry(index, { email: e.target.value })}
                      />
                      {fieldErrors[`${index}.email`] && (
                        <p className="text-xs text-destructive">{fieldErrors[`${index}.email`]}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={noteSurfaceClass}>
        <CardContent className="flex items-start gap-2 py-4 text-sm text-muted-foreground max-md:px-3 max-md:text-xs">
          <Info className="mt-0.5 w-4 h-4 shrink-0" />
          <p>{t('locations.countryNote')}</p>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmRemove !== null}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('locations.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('locations.removeDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => {
                if (confirmRemove !== null) removeAddress(confirmRemove);
                setConfirmRemove(null);
              }}
            >
              {t('common:actions.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedChangesBar
        visible={dirty || saving}
        saving={saving}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </div>
  );
}
