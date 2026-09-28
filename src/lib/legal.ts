/**
 * Where Wi-Mall's legal documents live — the one place these URLs are written.
 *
 * The documents are hosted on the CDN, not in this app: the text is owned and
 * versioned there, and a copy pasted into a screen would drift from the version
 * a person is actually agreeing to. Always the `.html` rendition (readable on a
 * phone, opens in any browser), never the `.pdf`.
 *
 * Only English and French exist. A French UI gets the French document; every
 * other language — including the pending `pt` / `es` / `ar` — gets English.
 */

export type LegalDocument = 'terms' | 'privacy';

type LegalLanguage = 'en' | 'fr';

export const LEGAL_URLS = {
  terms: {
    en: 'https://cdn.wi-mall.com/legal/terms-of-service-en.html',
    fr: 'https://cdn.wi-mall.com/legal/terms-of-service-fr.html',
  },
  privacy: {
    en: 'https://cdn.wi-mall.com/legal/privacy-policy-en.html',
    fr: 'https://cdn.wi-mall.com/legal/privacy-policy-fr.html',
  },
} as const satisfies Record<LegalDocument, Record<LegalLanguage, string>>;

/** The URL of `doc` for a UI language (a BCP-47 tag; only its base subtag counts). */
export function legalUrl(doc: LegalDocument, language: string | null | undefined): string {
  const base = (language ?? '').toLowerCase().split(/[-_]/)[0];
  return LEGAL_URLS[doc][base === 'fr' ? 'fr' : 'en'];
}
