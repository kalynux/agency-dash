import { ApiError } from '@/types/api';
import type { GeoAddress } from '@/types/geo.types';

/**
 * `400 ADDRESS_REGION_INVALID` on a headquarters list (onboarding step 1 and the
 * magazin PATCH): a NEW or EDITED entry names no region of the agency's country,
 * neither by its region text nor by its city. Unchanged entries are never
 * refused. See api-doc/agency/magazin.md → `headquarters_addresses`.
 *
 * The repair is in the error itself: `details.allowedRegions` is the picker,
 * `details.index` / `details.label` name the entry. The client sets that entry's
 * `geo.components.region` to the picked `key` and resends the whole list.
 */
export interface AddressRegionOption {
  key: string;
  /** In the active language — `name.fr` for French, else English, else the key. */
  label: string;
}

export interface AddressRegionRefusal {
  /** Position in the list that was SENT. `null` when the server left it out. */
  index: number | null;
  label: string | null;
  /** What the geocode said, for the sentence. */
  region: string | null;
  city: string | null;
  allowedRegions: AddressRegionOption[];
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

export function addressRegionRefusal(err: unknown, language: string): AddressRegionRefusal | null {
  if (!(err instanceof ApiError) || err.code !== 'ADDRESS_REGION_INVALID') return null;
  const d = (err.details ?? {}) as Record<string, unknown>;
  const lang = language.split('-')[0];
  const allowed = Array.isArray(d.allowedRegions) ? d.allowedRegions : [];
  return {
    index: typeof d.index === 'number' && Number.isInteger(d.index) && d.index >= 0 ? d.index : null,
    label: str(d.label),
    region: str(d.region),
    city: str(d.city),
    allowedRegions: allowed.flatMap((r): AddressRegionOption[] => {
      if (!r || typeof r !== 'object') return [];
      const { key, name } = r as { key?: unknown; name?: Record<string, unknown> };
      const k = str(key);
      if (!k) return [];
      return [{ key: k, label: str(name?.[lang]) ?? str(name?.en) ?? k }];
    }),
  };
}

/**
 * Which entry of the list we sent was refused. `index` is authoritative; the
 * label is a fallback for a server that omitted it, used only when it matches
 * exactly one entry.
 */
export function refusedEntryIndex(refusal: AddressRegionRefusal, labels: string[]): number | null {
  if (refusal.index !== null && refusal.index < labels.length) return refusal.index;
  if (refusal.label) {
    const hits = labels.flatMap((l, i) => (l.trim() === refusal.label!.trim() ? [i] : []));
    if (hits.length === 1) return hits[0];
  }
  return null;
}

/** The entry's `geo` with its region set to the picked key — the documented repair. */
export function withRegion(geo: GeoAddress, key: string): GeoAddress {
  return { ...geo, components: { ...geo.components, region: key } };
}
