/**
 * Single source of truth for which languages the dashboard speaks.
 *
 * The set mirrors `preferred_language` on the agency profile (see
 * `types/api.ts` → `AgencyRoleEntity`), because the dashboard language and the
 * language the backend renders notifications in are the *same* user choice —
 * picked once on Account → Profile.
 *
 * Adding a language is a three-line change here plus a `locales/<code>/`
 * directory; everything else (direction, formatting, the picker, the fallback
 * chain) derives from this table.
 */

import { directionForLanguage, type Direction } from '@/lib/direction';

export interface LanguageDescriptor {
  /** BCP-47 base subtag. Must match the backend's `preferred_language` enum. */
  code: string;
  /** Name in the language itself — a picker must be readable before you switch. */
  nativeName: string;
  /** Locale passed to `Intl` for numbers, currency and dates. */
  intlLocale: string;
  dir: Direction;
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', nativeName: 'English', intlLocale: 'en-GB', dir: 'ltr' },
  { code: 'fr', nativeName: 'Français', intlLocale: 'fr-FR', dir: 'ltr' },
  { code: 'pt', nativeName: 'Português', intlLocale: 'pt-PT', dir: 'ltr' },
  { code: 'es', nativeName: 'Español', intlLocale: 'es-ES', dir: 'ltr' },
  { code: 'ar', nativeName: 'العربية', intlLocale: 'ar', dir: 'rtl' },
] as const satisfies readonly LanguageDescriptor[];

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

/** Where the choice survives a reload before `/auth/me` has answered. */
export const LANGUAGE_STORAGE_KEY = 'jovi-agency-language';

export const SUPPORTED_LANGUAGE_CODES: readonly LanguageCode[] =
  SUPPORTED_LANGUAGES.map((l) => l.code);

export function isSupportedLanguage(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(value);
}

/**
 * Narrow any incoming tag (`fr-CM`, `FR`, `en-US`, junk) to a supported code,
 * falling back to English. Used for the stored value, the backend value and the
 * browser's `navigator.language` alike.
 */
export function normalizeLanguage(value: unknown): LanguageCode {
  if (typeof value !== 'string') return DEFAULT_LANGUAGE;
  const base = value.split('-')[0]?.toLowerCase();
  return isSupportedLanguage(base) ? base : DEFAULT_LANGUAGE;
}

export function getLanguageDescriptor(code: LanguageCode): LanguageDescriptor {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code) ?? SUPPORTED_LANGUAGES[0];
}

/** The `Intl` locale for a language code — used by `lib/format`. */
export function intlLocaleFor(code: string): string {
  return getLanguageDescriptor(normalizeLanguage(code)).intlLocale;
}

export function directionFor(code: string): Direction {
  return directionForLanguage(normalizeLanguage(code));
}
