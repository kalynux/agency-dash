import parsePhoneNumberFromString, {
  AsYouType,
  formatIncompletePhoneNumber,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  isSupportedCountry,
  parseIncompletePhoneNumber,
  validatePhoneNumberLength,
} from 'libphonenumber-js';
import examples from 'libphonenumber-js/examples.mobile.json';
import type { CountryCode } from 'libphonenumber-js';

import { DEFAULT_COUNTRY } from '@/lib/regions';

/**
 * Phone numbers — one representation, one validator, app-wide.
 *
 * **A phone number is E.164 everywhere it is stored, compared or submitted**:
 * a leading `+`, the country calling code, then the national significant
 * digits, with no spaces or punctuation (`+237671234567`). Formatting is a
 * *rendering* concern and never reaches state or the API. The old per-form
 * `/^\+?[0-9\s\-()]+$/` regexes accepted `(((((` and rejected nothing that
 * mattered, and every screen picked its own length bounds — this module is the
 * single answer to "is this a phone number, and what do we send?".
 *
 * Numbering rules come from Google's libphonenumber (via `libphonenumber-js`),
 * so validity is per-country and stays correct as plans change with a dependency
 * bump rather than a regex edit. The default ("min") metadata is loaded: it
 * validates and formats every country but carries no line-type patterns, which
 * is the trade we want — we never ask whether a number is mobile or landline.
 *
 * Country *names* are resolved through `Intl.DisplayNames`, the same trade
 * `lib/countries` makes for the payout country list: no list for a translator to
 * maintain, and every UI language is covered for free.
 *
 * The UI for all of this is [PhoneInput](../components/common/PhoneInput.tsx) —
 * nothing else should be building a phone field.
 */

// ─── Countries ────────────────────────────────────────────────────────────────

/**
 * The country a phone field opens on when nothing else is known.
 *
 * Anchored to the platform's home country (`lib/regions`) so the coverage
 * picker and the phone picker can never disagree about where an agency is.
 * Real defaults come from the agency's own profile — see `useDefaultPhoneCountry`.
 */
export const DEFAULT_PHONE_COUNTRY = DEFAULT_COUNTRY as CountryCode;

/** Narrow an ISO-2 string (from the API, a form, anywhere) to a dialable country. */
export function toPhoneCountry(value: string | null | undefined): CountryCode | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  return isSupportedCountry(code) ? code : null;
}

/**
 * ISO-2 → flag emoji, by mapping each letter to its regional indicator symbol.
 *
 * Platforms without flag glyphs (Windows, notably) fall back to rendering the
 * two indicator letters, which still reads as the country code — which is why
 * the picker always shows the calling code beside the flag rather than relying
 * on it.
 */
export function countryFlag(country: string): string {
  const code = country.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((char) => 0x1f1a5 + char.charCodeAt(0)));
}

/** Calling code without the `+`, e.g. `"237"`. */
export function callingCodeOf(country: CountryCode): string {
  return getCountryCallingCode(country);
}

export interface PhoneCountryOption {
  code: CountryCode;
  /** Calling code without the `+`, e.g. `"237"`. */
  callingCode: string;
  /** Country name in the active UI language. */
  name: string;
  flag: string;
  /** Pre-lowercased name + code + calling code, so filtering is a substring test. */
  search: string;
}

/** ~240 entries × one `Intl` lookup each is worth doing once per language. */
const optionsByLanguage = new Map<string, PhoneCountryOption[]>();

/** Every dialable country, named in `language` and sorted the way that language sorts. */
export function phoneCountryOptions(language: string): PhoneCountryOption[] {
  const cached = optionsByLanguage.get(language);
  if (cached) return cached;

  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames([language], { type: 'region' });
  } catch {
    // A runtime (or language tag) without DisplayNames falls back to the ISO code.
  }

  const options = getCountries().map<PhoneCountryOption>((code) => {
    const name = display?.of(code) ?? code;
    const callingCode = getCountryCallingCode(code);
    return {
      code,
      callingCode,
      name,
      flag: countryFlag(code),
      search: `${name} ${code} +${callingCode}`.toLowerCase(),
    };
  });

  try {
    const collator = new Intl.Collator(language);
    options.sort((a, b) => collator.compare(a.name, b.name));
  } catch {
    options.sort((a, b) => a.name.localeCompare(b.name));
  }

  optionsByLanguage.set(language, options);
  return options;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

/** Digits only — drops `+`, spaces, hyphens and every other separator. */
export function phoneDigits(value: string): string {
  return value.replace(/\D+/g, '');
}

export interface ParsedPhone {
  /** The country the value resolves to, or the fallback while it is too short to tell. */
  country: CountryCode | null;
  /** Calling code without the `+`. */
  callingCode: string;
  /** National significant digits — the trunk prefix (a leading `0`, …) removed. */
  nationalNumber: string;
  /** E.164, or `''` when there are no national digits yet. */
  e164: string;
  isValid: boolean;
  isEmpty: boolean;
}

/**
 * Read a stored or half-typed value.
 *
 * `fallbackCountry` interprets a value that names no country of its own — either
 * a legacy row stored in local format before this module existed, or a national
 * number the user is still typing. A `+`-prefixed value always wins over it.
 */
export function parsePhone(
  value: string | null | undefined,
  fallbackCountry?: CountryCode | null,
): ParsedPhone {
  const raw = (value ?? '').trim();
  const fallback = fallbackCountry ?? null;

  if (!raw) {
    return {
      country: fallback,
      callingCode: fallback ? getCountryCallingCode(fallback) : '',
      nationalNumber: '',
      e164: '',
      isValid: false,
      isEmpty: true,
    };
  }

  const parsed = parsePhoneNumberFromString(raw, fallback ?? undefined);
  if (parsed) {
    return {
      country: parsed.country ?? fallback,
      callingCode: parsed.countryCallingCode,
      nationalNumber: parsed.nationalNumber,
      e164: parsed.number,
      isValid: parsed.isValid(),
      isEmpty: false,
    };
  }

  // Too short to parse as a number — `AsYouType` still resolves as much of the
  // prefix as exists, which is what a field mid-typing needs.
  const formatter = new AsYouType(fallback ?? undefined);
  formatter.input(raw);
  const country = formatter.getCountry() ?? fallback;
  const callingCode =
    formatter.getCallingCode() ?? (country ? getCountryCallingCode(country) : '');
  const nationalNumber = formatter.getNationalNumber();

  return {
    country,
    callingCode,
    nationalNumber,
    e164: nationalNumber && callingCode ? `+${callingCode}${nationalNumber}` : '',
    isValid: false,
    isEmpty: nationalNumber.length === 0,
  };
}

/**
 * `country` + whatever the user typed nationally → E.164.
 *
 * Once the digits are long enough to parse, the library's own result is used, so
 * a trunk prefix the user is used to dialling (`06…` in France, `0…` in Nigeria)
 * is dropped rather than smuggled into the middle of the number. Below that
 * length the digits are concatenated as-is: the result is a valid *prefix* of
 * E.164 that validation will reject until it is finished, and it self-corrects
 * on the keystroke that makes the number parseable.
 */
export function toE164(country: CountryCode, nationalInput: string): string {
  const digits = phoneDigits(nationalInput);
  if (!digits) return '';
  const parsed = parsePhoneNumberFromString(digits, country);
  if (parsed?.number) return parsed.number;
  return `+${getCountryCallingCode(country)}${digits}`;
}

/** National grouping for the text the user sees while typing, e.g. `6 71 23 45 67`. */
export function formatNationalInput(country: CountryCode, nationalInput: string): string {
  return formatIncompletePhoneNumber(phoneDigits(nationalInput), country);
}

/**
 * The national text a number that is *already stored* should appear as.
 *
 * Not the same job as `formatNationalInput`, which groups the digits a user is
 * typing. In a trunk-prefix country — France's `06…`, Nigeria's `0802…`, the UK's
 * `07…` — those are not the digits E.164 kept: the prefix is dropped on the way
 * in, and re-grouping what's left yields an unformatted run (`612345678`). So a
 * value complete enough to parse is formatted by the library, which puts the
 * prefix back; anything shorter falls through to as-you-type grouping.
 *
 * Editing the result is safe either way: the prefix is stripped again on the way
 * out, so the same number comes back out as the same E.164.
 */
export function formatNationalDisplay(
  value: string | null | undefined,
  fallbackCountry?: CountryCode | null,
): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const parsed = parsePhoneNumberFromString(raw, fallbackCountry ?? undefined);
  if (parsed?.isValid()) return parsed.formatNational();
  const partial = parsePhone(raw, fallbackCountry);
  const country = partial.country ?? fallbackCountry ?? DEFAULT_PHONE_COUNTRY;
  return formatNationalInput(country, partial.nationalNumber);
}

/**
 * Normalize typed-or-pasted text to `+`-and-digits, keeping a leading `+` so the
 * caller can tell "this is an international number" from "these are national
 * digits". Re-exported so `PhoneInput` and this module agree on what a keystroke
 * means.
 */
export { parseIncompletePhoneNumber };

/** A stored number in readable international form, e.g. `+237 6 71 23 45 67`. */
export function formatPhoneDisplay(
  value: string | null | undefined,
  fallbackCountry?: CountryCode | null,
): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const parsed = parsePhoneNumberFromString(raw, fallbackCountry ?? undefined);
  return parsed ? parsed.formatInternational() : raw;
}

/** An example national number for `country`, for use as a field placeholder. */
export function phoneExample(country: CountryCode): string {
  try {
    return getExampleNumber(country, examples)?.formatNational() ?? '';
  } catch {
    return '';
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Why a phone value was rejected. Each member is a key under `validation:phone.*`
 * — see `phoneErrorMessage` in `lib/validation-schemas`.
 */
export type PhoneIssue = 'required' | 'tooShort' | 'tooLong' | 'invalid';

export interface PhoneCheckOptions {
  /** Reject an empty value. Optional fields stay clearable. */
  required?: boolean;
  /** Interprets a legacy value stored without a `+`. */
  country?: CountryCode | null;
}

/** Is this a real, complete number under its country's numbering rules? */
export function isValidPhone(
  value: string | null | undefined,
  country?: CountryCode | null,
): boolean {
  const raw = (value ?? '').trim();
  if (!raw) return false;
  return parsePhoneNumberFromString(raw, country ?? undefined)?.isValid() ?? false;
}

/**
 * The one phone check. Returns `null` when the value may be submitted.
 *
 * Length is reported separately from shape because "you're two digits short" is
 * a fixable message and "invalid phone number" is not.
 */
export function phoneIssue(
  value: string | null | undefined,
  options: PhoneCheckOptions = {},
): PhoneIssue | null {
  const raw = (value ?? '').trim();
  const country = options.country ?? undefined;

  if (!raw) return options.required ? 'required' : null;
  if (isValidPhone(raw, country)) return null;

  switch (validatePhoneNumberLength(raw, country)) {
    case 'TOO_SHORT':
      return 'tooShort';
    case 'TOO_LONG':
      return 'tooLong';
    default:
      return 'invalid';
  }
}

/**
 * The value to put on the wire: E.164, or `''` for a cleared optional field.
 *
 * Call this on every phone field at submit time — including ones the user never
 * touched, so a legacy row stored in local format is upgraded the next time its
 * form is saved. Anything unparseable collapses to `''` rather than being sent,
 * which `phoneIssue` has already refused to let get this far.
 */
export function toSubmittablePhone(
  value: string | null | undefined,
  country?: CountryCode | null,
): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  return parsePhoneNumberFromString(raw, country ?? undefined)?.number ?? '';
}

export type { CountryCode };
