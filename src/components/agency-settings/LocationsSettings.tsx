import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building, Info, Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useResource } from '@/hooks/useResource';
import { magazinService } from '@/services/magazin.service';
import { agencyProfileService } from '@/services/agency-profile.service';
import { getApiErrorMessage } from '@/lib/errors';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (form.coverageAreas.length === 0) {
    errors.coverage = 'Select at least one coverage region.';
  }
  if (form.addresses.length === 0) {
    errors.addresses = 'At least one headquarters address is required.';
  }

  // Every row is validated, touched or not — the array is a full replace, so an
  // untouched row is still (re)written and must satisfy the write schema. Only
  // the `geo` requirement is relaxed for rows that haven't moved.
  form.addresses.forEach((entry, index) => {
    const label = entry.label.trim();
    if (!label) errors[`${index}.label`] = 'Label is required.';
    else if (label.length > 50) errors[`${index}.label`] = 'Max 50 characters.';
    if (!entry.geo && requiresGeo(entry)) {
      errors[`${index}.geo`] = 'Search for and select this location’s address.';
    }
    // `region` / `city` are derived from `geo` and may legitimately end up null —
    // nothing to validate.
    const desc = entry.address_description.trim();
    if (!desc) errors[`${index}.address_description`] = 'Street address is required.';
    else if (desc.length > 200) errors[`${index}.address_description`] = 'Max 200 characters.';
    const phone = entry.phone.trim();
    if (phone.length < 6 || phone.length > 20) {
      errors[`${index}.phone`] = 'Phone must be between 6 and 20 characters.';
    } else if (!/^\+?[0-9\s\-()]+$/.test(phone)) {
      errors[`${index}.phone`] = 'Use digits, +, spaces, hyphens or parentheses.';
    }
    const email = entry.email.trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      errors[`${index}.email`] = 'Enter a valid email address.';
    }
  });

  return errors;
}

export function LocationsSettings() {
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

  const regions = useMemo(() => regionsFor(country), [country]);
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

    const errors = validate(form);
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors);
      setSaveError('Please fix the highlighted fields before saving.');
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
      toast.success('Coverage & locations saved');
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        // Optimistic-locking clash — refresh so the agency edits the latest.
        toast.error('Your locations were updated elsewhere. Refreshed — please re-apply your changes.');
        await refetch();
      } else {
        setSaveError(getApiErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }, [magazin, form, setData, refetch]);

  if (isLoading && !magazin) return <LoadingState label="Loading coverage & locations…" />;
  if (error && !magazin) return <ErrorState error={error} onRetry={refetch} />;
  if (!magazin || !form) return null;

  return (
    <div className="space-y-6">
      {saveError && (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {/* ─── Coverage regions ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Coverage & Locations</CardTitle>
          <CardDescription>
            The regions you serve and your headquarters addresses — the operational footprint
            vendors see when choosing an agency.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Coverage Regions</Label>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" /> {country ?? '—'}
              </span>
            </div>
            {regions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No region data is available for your operating country yet.
              </p>
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
            <p className="mt-2 text-xs text-muted-foreground">
              Only regions of your operating country can be selected.
            </p>
          </div>

          <Separator />

          {/* ─── HQ addresses ───────────────────────────────────────────── */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>Headquarters & Pickup Locations</Label>
              <Button type="button" variant="outline" size="sm" onClick={addAddress} className="gap-1">
                <Plus className="w-3.5 h-3.5" /> Add address
              </Button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Search for each location and pick it from the results — we read the street, city and
              region straight off the map result. The first address is your primary headquarters.
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
                        (index === 0 ? 'Primary Headquarters' : `Branch Address ${index + 1}`)}
                    </span>
                    {form.addresses.length > 1 && (
                      <button
                        type="button"
                        aria-label="Remove address"
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
                    <Label>Find address</Label>
                    <AddressSearchInput
                      value={entry.geo}
                      country={geoBias}
                      hasError={!!fieldErrors[`${index}.geo`]}
                      placeholder="Search a street, area, or city…"
                      onSelect={(address) => handleGeoSelect(index, address)}
                      onClear={() => patchEntry(index, { geo: null })}
                    />
                    {fieldErrors[`${index}.geo`] ? (
                      <p className="text-xs text-destructive">{fieldErrors[`${index}.geo`]}</p>
                    ) : entry.geo ? null : entry.original ? (
                      <p className="text-xs text-amber-600">
                        This address predates map search, so it has no pin. Search for it to place it
                        on the map — you can still edit everything else without re-selecting.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Required — the pin is what lets vendors and drivers route to you.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`hq-label-${entry.uid}`}>
                      Label <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`hq-label-${entry.uid}`}
                      value={entry.label}
                      maxLength={50}
                      placeholder="e.g. Main Warehouse, Douala Hub"
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
                        <p className="text-xs text-amber-600">
                          This location was saved before labels existed — name it to save any change
                          on this page.
                        </p>
                      )
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`hq-street-${entry.uid}`}>
                      Street Address / Landmark <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`hq-street-${entry.uid}`}
                      value={entry.address_description}
                      maxLength={200}
                      placeholder="e.g. Akwa, Rue Sylvani, 3rd floor"
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
                      <p className="text-xs text-muted-foreground">
                        Filled in from the map result — refine it with a floor, unit or landmark.
                      </p>
                    )}
                  </div>

                  {/* City / region are derived from `geo` server-side. We echo what the
                      map result named, and offer an optional input only where it named
                      nothing — `null` is a valid answer for a rural or landmark place. */}
                  {entry.geo && (entry.city || entry.region) && (
                    <p className="text-xs text-muted-foreground">
                      {[entry.city, entry.region].filter(Boolean).join(', ')}
                      <span className="ml-1 opacity-70">· from the map result</span>
                    </p>
                  )}

                  {entry.geo && (!entry.city || !entry.region) && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {!entry.city && (
                        <div className="space-y-1.5">
                          <Label htmlFor={`hq-city-${entry.uid}`}>City (optional)</Label>
                          <Input
                            id={`hq-city-${entry.uid}`}
                            value={entry.city}
                            maxLength={100}
                            placeholder="Douala"
                            onChange={(e) => patchEntry(index, { city: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            The map result named no city — add one if it helps.
                          </p>
                        </div>
                      )}
                      {!entry.region && (
                        <div className="space-y-1.5">
                          <Label htmlFor={`hq-region-${entry.uid}`}>Region (optional)</Label>
                          <Input
                            id={`hq-region-${entry.uid}`}
                            value={entry.region}
                            maxLength={100}
                            placeholder="Littoral"
                            onChange={(e) => patchEntry(index, { region: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            The map result named no region — add one if it helps.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`hq-phone-${entry.uid}`}>
                        Support Phone <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`hq-phone-${entry.uid}`}
                        value={entry.phone}
                        maxLength={20}
                        placeholder="+237 6XX XXX XXX"
                        className={cn(fieldErrors[`${index}.phone`] && 'border-destructive')}
                        onChange={(e) => patchEntry(index, { phone: e.target.value })}
                      />
                      {fieldErrors[`${index}.phone`] && (
                        <p className="text-xs text-destructive">{fieldErrors[`${index}.phone`]}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`hq-email-${entry.uid}`}>Support Email (optional)</Label>
                      <Input
                        id={`hq-email-${entry.uid}`}
                        value={entry.email}
                        type="email"
                        placeholder="support@youragency.com"
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

      <Card>
        <CardContent className="flex items-start gap-2 py-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 w-4 h-4 shrink-0" />
          <p>
            Your operating country was set during onboarding and can't be changed. Coverage regions
            and addresses must both fall inside it.
          </p>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmRemove !== null}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this location?</AlertDialogTitle>
            <AlertDialogDescription>
              Vendors and drivers routing to this address will lose it once you save. Deliveries
              already assigned to it aren't affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => {
                if (confirmRemove !== null) removeAddress(confirmRemove);
                setConfirmRemove(null);
              }}
            >
              Remove
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
