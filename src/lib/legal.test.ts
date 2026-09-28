import { describe, expect, it } from 'vitest';
import { LEGAL_URLS, legalUrl } from './legal';

describe('legalUrl', () => {
  it('gives a French UI the French documents', () => {
    expect(legalUrl('terms', 'fr')).toBe('https://cdn.wi-mall.com/legal/terms-of-service-fr.html');
    expect(legalUrl('privacy', 'fr')).toBe('https://cdn.wi-mall.com/legal/privacy-policy-fr.html');
    expect(legalUrl('terms', 'fr-CM')).toBe(LEGAL_URLS.terms.fr);
  });

  it('gives every other language the English documents', () => {
    for (const lang of ['en', 'en-GB', 'pt', 'es', 'ar', '', null, undefined]) {
      expect(legalUrl('terms', lang)).toBe('https://cdn.wi-mall.com/legal/terms-of-service-en.html');
      expect(legalUrl('privacy', lang)).toBe('https://cdn.wi-mall.com/legal/privacy-policy-en.html');
    }
  });

  it('only ever links the HTML rendition', () => {
    for (const byLang of Object.values(LEGAL_URLS)) {
      for (const url of Object.values(byLang)) expect(url).toMatch(/^https:\/\/cdn\.wi-mall\.com\/legal\/.+\.html$/);
    }
  });
});
