import locationsData from '@/constants/locations.json';
import i18n from '@/i18n';

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

/**
 * Region names are per-language inside locations.json itself, so they don't go
 * through a translation namespace — pick the requested language's entry and fall
 * back to English for a language the data file doesn't carry.
 */
function localizedName(name: Record<string, string>, language: string): string {
  return name[language] ?? name[language.split('-')[0]] ?? name.en;
}

/**
 * Regions of `country` (ISO-2, case-insensitive), labelled in `language`.
 * Empty when unknown.
 *
 * `language` is an explicit parameter rather than a read of the live i18next
 * instance so callers can memoize on it — a hidden global read would let a
 * `useMemo` serve stale English labels after a language switch.
 */
export function regionsFor(
  country: string | null | undefined,
  language: string = i18n.resolvedLanguage ?? i18n.language ?? 'en',
): RegionEntry[] {
  const key = (country ?? DEFAULT_COUNTRY).toLowerCase() as CountryKey;
  const entry = COUNTRIES[key];
  if (!entry) return [];
  return Object.entries(entry.regions).map(([regionKey, val]) => ({
    key: regionKey,
    label: localizedName(val.name, language),
    cities: val.cities,
  }));
}
