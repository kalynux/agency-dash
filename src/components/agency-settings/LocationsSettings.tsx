import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building, Info, Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useResource } from '@/hooks/useResource';
import { magazinService } from '@/services/magazin.service';
import { agencyProfileService } from '@/services/agency-profile.service';
import { getApiErrorMessage } from '@/lib/errors';
import type { AnyTFunction } from '@/i18n/tx';
import { phoneIssue, toPhoneCountry, toSubmittablePhone, type CountryCode } from '@/lib/phone';
import { phoneErrorMessage } from '@/lib/validation-schemas';
import { ApiError } from '@/types/api';
import { cn } from '@/lib/utils';
import { getLocationsInUse } from '@/types/magazin.types';
import type {
  AgencyMagazin,
  MagazinHeadquartersAddress,
  MagazinHeadquartersAddressInput,
  MagazinUpdatePayload,
} from '@/types/magazin.types';
import type { GeoAddress } from '@/types/geo.types';

import { AddressSearchInput } from '@/components/common/AddressSearchInput';
import { PhoneInput } from '@/components/common/PhoneInput';
import { LoadingState, ErrorState } from '@/components/common/state-views';
import { UnsavedChangesBar } from '@/components/agency-settings/UnsavedChangesBar';
import { InfoHint } from '@/components/common/InfoHint';
import { noteSurfaceClass, sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RegionPicker } from '@/components/common/RegionPicker';
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
 * Is the pin currently shown the one the backend actually stores?
 *
 * Clearing THAT pin is destructive — it is the coordinate vendors and drivers
 * route to, and the row can't be saved again until a new candidate is picked.
 * Clearing a pin the agency just placed by hand costs them nothing, so only the
 * stored one is worth a confirmation.
 */
function isStoredPin(entry: HqFormEntry): boolean {
  return !!entry.geo && placeKey(entry.geo) === placeKey(entry.original?.geo ?? null);
}

/**
 * Does this row need a freshly-picked `geo` before it can be saved?
 *
 * An entry is "unchanged" — and so grandfathered past `ADDRESS_GEO_REQUIRED` —
 * while its geocoded place still matches what is stored, plus EITHER the same
 * `address_description` OR a matching `id`. We echo the `_id` of every kept row
 * (see `toAddressPayload`), so for a stored entry only moving the pin counts as
 * an edit: correcting the street text of a legacy row no longer forces a
 * re-geocode. A row the backend never assigned an `_id` falls back to matching
 * on the address text.
 */
function requiresGeo(entry: HqFormEntry): boolean {
  const stored = entry.original;
  if (!stored) return true; // brand-new row
  if (!stored._id && entry.address_description.trim() !== (stored.address_description ?? '')) {
    return true;
  }
  return placeKey(entry.geo) !== placeKey(stored.geo ?? null);
}

/**
 * Build one outgoing HQ entry. `location`, `region` and `city` are all derived
 * from `geo` server-side, so a geocoded row sends none of them — region/city go
 * out only as the fallback for a place whose geocode named neither.
 *
 * Note `headquarters_addresses` is a FULL REPLACE, so every row is written on
 * every save — including ones the agency never touched. That is why a kept row
 * echoes its stored `id`: a depot is referenced by `_id` from outside the
 * magazin (a vendor pins a product at one, orders carry it through to the
 * agent's pickup address), so an entry written without it is stored as a NEW
 * depot and every product naming the old one quietly falls back to the primary.
 */
function toAddressPayload(entry: HqFormEntry, country: CountryCode | null): MagazinHeadquartersAddressInput {
  const payload: MagazinHeadquartersAddressInput = {
    ...(entry.original?._id ? { id: entry.original._id } : {}),
    label: entry.label.trim(),
    address_description: entry.address_description.trim(),
    support_contact: {
      // Always E.164 — a legacy row stored in local format is upgraded here
      // rather than written back as-is. See lib/phone.ts.
      phone: toSubmittablePhone(entry.phone, country),
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

/**
 * A destructive click waiting on the agency's confirmation. Both kinds throw a
 * pinned location away: `remove` drops the whole row, `clearPin` drops just the
 * coordinates and leaves the row un-saveable until a new candidate is picked.
 */
type PendingConfirm = { kind: 'remove' | 'clearPin'; index: number };

function validate(form: FormState, t: AnyTFunction, country: CountryCode | null): FieldErrors {
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
    // `country` interprets a legacy row stored before numbers were E.164.
    const phone = phoneIssue(entry.phone, { required: true, country });
    if (phone) errors[`${index}.phone`] = phoneErrorMessage(t, phone);
    const email = entry.email.trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      errors[`${index}.email`] = v('email');
    }
  });

  return errors;
}

/**
 * The heading of one address card — a titled band, not a field label.
 *
 * Each card holds a whole address (pin, label, street, support contacts), so its
 * top row is a section header in its own right: it spans the card's full width,
 * sits on a tinted band and is closed off by a rule, the same shape a settings
 * section uses. The agency's own label is the title; the row's place in the list
 * ("Primary Headquarters", "Branch Address 2") drops to a sub-line, and stands
 * in as the title for rows saved before labels existed.
 */
function AddressRowHeading({
  index,
  label,
  onRemove,
}: {
  index: number;
  label: string;
  /** Omitted for the last remaining address — there must always be one. */
  onRemove?: () => void;
}) {
  const { t } = useTranslation('settings');
  const name = label.trim();
  const role =
    index === 0
      ? t('locations.primaryHeadquarters')
      : t('locations.branchAddress', { number: index + 1 });

  return (
    // Negative margins pull the band out to the card's own `p-4` edges.
    <div className="-mx-4 -mt-4 flex items-center justify-between gap-2 rounded-t-lg border-b bg-muted/40 px-4 py-2.5">
      <span className="flex min-w-0 items-center gap-2">
        <Building className="w-4 h-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight">{name || role}</span>
          {name && (
            <span className="block truncate text-[11px] leading-tight text-muted-foreground">
              {role}
            </span>
          )}
        </span>
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label={t('locations.removeAddress')}
          onClick={onRemove}
          // 32px hit area, pulled flush with the band's right padding.
          className="-mr-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function LocationsSettings() {
  const { t } = useTranslation(['settings', 'common']);
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
  // Throwing away a saved row — or any pin — is confirmed first: the address may
  // still be referenced by assignments, and the pin is what vendors and drivers
  // route to, so both are worth a deliberate click.
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  // Region labels come out of locations.json in the active language — resolved
  // inside `RegionPicker` now, which is shared with onboarding and the agent
  // contract terms so all three offer the same catalogue.
  const geoBias = (country ?? '').toLowerCase() || undefined;
  // Also the phone picker's starting country, and how a legacy support number
  // stored without a `+` is read back.
  const phoneCountry = useMemo(() => toPhoneCountry(country), [country]);

  // (Re)seed the form whenever the underlying magazin changes (load / save).
  useEffect(() => {
    if (magazin) {
      setForm(toForm(magazin));
      setFieldErrors({});
    }
  }, [magazin]);

  const setCoverageAreas = useCallback((next: string[]) => {
    setForm((prev) => (prev ? { ...prev, coverageAreas: next } : prev));
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

  /**
   * A row that is stored, or that carries a pin, is worth asking about. A blank
   * row the agency just added has nothing to lose, so it goes straight away.
   */
  const requestRemove = useCallback((index: number, entry: HqFormEntry) => {
    if (entry.original || entry.geo) setPending({ kind: 'remove', index });
    else removeAddress(index);
  }, [removeAddress]);

  /** Clearing the *stored* pin is confirmed; clearing a just-picked one is not. */
  const requestClearPin = useCallback((index: number, entry: HqFormEntry) => {
    if (isStoredPin(entry)) setPending({ kind: 'clearPin', index });
    else patchEntry(index, { geo: null });
  }, [patchEntry]);

  const confirmPending = useCallback(() => {
    if (!pending) return;
    if (pending.kind === 'remove') removeAddress(pending.index);
    else patchEntry(pending.index, { geo: null });
    setPending(null);
  }, [pending, removeAddress, patchEntry]);

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

    const errors = validate(form, t, phoneCountry);
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors);
      setSaveError(t('common.fixHighlighted'));
      return;
    }

    // Both arrays are a full replace — always send the complete desired value.
    const payload: MagazinUpdatePayload = {
      version: magazin.version,
      coverage_areas: form.coverageAreas,
      headquarters_addresses: form.addresses.map((entry) => toAddressPayload(entry, phoneCountry)),
    };

    setSaving(true);
    setSaveError(null);
    try {
      const updated = await magazinService.updateMagazin(payload);
      setData(updated);
      toast.success(t('locations.saved'));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MAGAZIN_LOCATION_IN_USE') {
        // A dropped depot still holds vendor stock. Nothing was saved, and
        // retrying can't help — those products have to be re-pointed first — so
        // this stays on screen naming the depots instead of refreshing the form
        // and throwing the agency's other edits away.
        const blocked = getLocationsInUse(err.details);
        setSaveError(
          blocked.length > 0
            ? t('locations.locationInUse', {
                locations: blocked
                  .map((loc) =>
                    t('locations.locationInUseEntry', {
                      label: loc.label || t('locations.unnamedLocation'),
                      count: loc.skuCount,
                    }),
                  )
                  .join(' · '),
              })
            : getApiErrorMessage(err),
        );
      } else if (err instanceof ApiError && err.isConflict) {
        // Optimistic-locking clash, or an entry carrying an `id` this magazin
        // doesn't have (`details.unknownIds`) — either way our view of the list
        // is stale, so refresh and let the agency re-apply.
        toast.error(t('locations.conflict'));
        await refetch();
      } else {
        setSaveError(getApiErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }, [magazin, form, setData, refetch, t, phoneCountry]);

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
      {/* No section heading: the page header above already names this tab and
          carries the same sentence. */}
      <Card className={sectionSurfaceClass}>
        <CardContent className="space-y-6 max-md:px-0">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>{t('locations.coverageLabel')}</Label>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" /> {country ?? t('common:values.notAvailable')}
              </span>
            </div>
            <RegionPicker
              value={form.coverageAreas}
              onChange={setCoverageAreas}
              country={country}
              noRegionsLabel={t('locations.noRegions')}
            />
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
                  <AddressRowHeading
                    index={index}
                    label={entry.label}
                    onRemove={
                      form.addresses.length > 1 ? () => requestRemove(index, entry) : undefined
                    }
                  />

                  {/* Address search — fills everything below and pins the coordinates */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      {/* {t('locations.findAddress')} */}
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
                      onClear={() => requestClearPin(index, entry)}
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
                      entry.geo && (entry.city || entry.region) && (
                        <p className="text-xs text-muted-foreground">
                          {t('locations.regionOptional')}: {entry.region || t('locations.regionNotNamed')} | {t('locations.cityOptional')}: {entry.city || t('locations.cityNotNamed')}
                          <span className="ml-1 opacity-70">{t('locations.fromMapResult')}</span>
                        </p>
                      )
                    )}
                  </div>



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
                      <PhoneInput
                        id={`hq-phone-${entry.uid}`}
                        value={entry.phone}
                        onChange={(phone) => patchEntry(index, { phone })}
                        // This screen already holds the profile's own country —
                        // the authoritative answer, so don't make the picker
                        // infer it from the session.
                        defaultCountry={country}
                        required
                        hasError={!!fieldErrors[`${index}.phone`]}
                        describedBy={
                          fieldErrors[`${index}.phone`] ? `hq-phone-${entry.uid}-error` : undefined
                        }
                      />
                      {fieldErrors[`${index}.phone`] && (
                        <p id={`hq-phone-${entry.uid}-error`} className="text-xs text-destructive">
                          {fieldErrors[`${index}.phone`]}
                        </p>
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
        <CardContent className="flex items-start gap-2 p-4 text-sm text-muted-foreground max-md:p-3 max-md:text-xs">
          <Info className="mt-0.5 w-4 h-4 shrink-0" />
          <p>{t('locations.countryNote')}</p>
        </CardContent>
      </Card>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === 'clearPin'
                ? t('locations.clearPinTitle')
                : t('locations.removeTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === 'clearPin'
                ? t('locations.clearPinDescription')
                : // A stored row is already live for vendors and drivers; an
                  // unsaved one only costs the pin the agency just placed.
                  pending && form.addresses[pending.index]?.original
                  ? t('locations.removeDescription')
                  : t('locations.removePinnedDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={confirmPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending?.kind === 'clearPin'
                ? t('locations.clearPinAction')
                : t('common:actions.remove')}
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
