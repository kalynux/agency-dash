/**
 * The bank countries a payout method can name.
 *
 * The *value* is the English country name, because that is what the backend
 * persists on `payout_details[].bank.country`. The *label* is localized through
 * `Intl.DisplayNames`, which already knows every country in every language — so
 * there is no country list for a translator to maintain or get wrong. This is
 * the same trade-off `lib/format` makes for dates and relative time.
 *
 * Onboarding (`Step2Payout`) and Account → Payout (`PayoutSettings`) edit the
 * same field, so they share this list. They must not diverge: a country offered
 * during onboarding but missing from settings leaves the saved value unmatched
 * by any option, and the select renders blank.
 */

/** Backend-facing country names, keyed by ISO 3166-1 alpha-2 code. */
export const COUNTRY_VALUES: Record<string, string> = {
  CM: 'Cameroon',
  CI: "Côte d'Ivoire",
  SN: 'Senegal',
  NG: 'Nigeria',
  GH: 'Ghana',
  KE: 'Kenya',
  TZ: 'Tanzania',
  UG: 'Uganda',
  RW: 'Rwanda',
  ZA: 'South Africa',
  FR: 'France',
  GB: 'United Kingdom',
  US: 'United States',
};

export const COUNTRY_CODES = Object.keys(COUNTRY_VALUES);

export interface CountryOption {
  /** What the backend stores — always the English name. */
  value: string;
  /** What the user reads — localized to the active language. */
  label: string;
}

/** Country options with labels in `language`, ordered as `COUNTRY_CODES`. */
export function countryOptions(language: string): CountryOption[] {
  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames([language], { type: 'region' });
  } catch {
    // A runtime without DisplayNames falls back to the stored English name.
  }
  return COUNTRY_CODES.map((code) => ({
    value: COUNTRY_VALUES[code],
    label: display?.of(code) ?? COUNTRY_VALUES[code],
  }));
}
