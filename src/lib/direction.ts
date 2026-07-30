/**
 * Text-direction foundation for the multi-language rollout (EN · FR · PT · ES · AR).
 *
 * Arabic is right-to-left, so the whole shell must mirror. The app's layout is
 * authored with CSS logical properties (Tailwind `ms/me/ps/pe`, `start/end`,
 * `border-s/e`, `rounded-s/e`) plus `rtl:` variants for directional glyphs, so
 * flipping `document.documentElement.dir` mirrors the interface with no other
 * per-component work. This module is the single seam a language switcher calls.
 */

export type Direction = 'ltr' | 'rtl';

/** Base language subtags that render right-to-left. */
export const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

/** Whether a BCP-47 tag (e.g. `ar`, `ar-CM`, `fr-CM`) is right-to-left. */
export function isRtlLanguage(lang: string): boolean {
  const base = lang.split('-')[0]?.toLowerCase();
  return !!base && RTL_LANGUAGES.has(base);
}

export function directionForLanguage(lang: string): Direction {
  return isRtlLanguage(lang) ? 'rtl' : 'ltr';
}

/**
 * Apply `lang` and `dir` to <html>. Call once on boot and again whenever the
 * active language changes; the logical-property layout does the rest.
 * Returns the resolved direction.
 */
export function applyDocumentDirection(lang: string): Direction {
  const dir = directionForLanguage(lang);
  if (typeof document !== 'undefined') {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = dir;
  }
  return dir;
}
