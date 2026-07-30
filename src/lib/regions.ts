import locationsData from '@/constants/locations.json';

/**
 * Region lookup over `constants/locations.json`, keyed by ISO-2 country.
 *
 * This backs the **coverage-area picker only**. The agency's coverage areas must
 * be region keys of its operating country (`country` on the profile, set once
 * during onboarding); sending a key that isn't a region of that country fails
 * with `400 AGENCY_COVERAGE_AREA_INVALID`.
 *
 * Addresses do NOT come from here — an HQ / pickup location's region, city and
 * street are read off the geocoded candidate the agency picked in
 * `GET /api/geo/search`, so there is no city list to look up.
 *
 * Only `cm` ships in locations.json today, so `regionsFor` returns an empty list
 * for anything else — callers should treat that as "no coverage picker" rather
 * than silently falling back to Cameroon's regions.
 */

export interface RegionEntry {
  /** The lowercase key the backend expects, e.g. "littoral". */
  key: string;
  /** Human display label, e.g. "Littoral". */
  label: string;
  cities: string[];
}

type CountryKey = keyof typeof locationsData.countries;

const COUNTRIES = locationsData.countries as Record<
  string,
  { name: Record<string, string>; regions: Record<string, { name: Record<string, string>; cities: string[] }> }
>;

/** The one country locations.json currently ships data for. */
export const DEFAULT_COUNTRY = 'CM';

/** Regions of `country` (ISO-2, case-insensitive). Empty when unknown. */
export function regionsFor(country: string | null | undefined): RegionEntry[] {
  const key = (country ?? DEFAULT_COUNTRY).toLowerCase() as CountryKey;
  const entry = COUNTRIES[key];
  if (!entry) return [];
  return Object.entries(entry.regions).map(([regionKey, val]) => ({
    key: regionKey,
    label: val.name.en,
    cities: val.cities,
  }));
}
