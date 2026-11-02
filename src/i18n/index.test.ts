// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANGUAGE_STORAGE_KEY } from './config';

describe('a language restored from storage', () => {
  afterEach(() => {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    vi.resetModules();
  });

  // Booting in French starts with only English loaded, so i18next first resolves
  // to `en`. The earnings sentences branch on `resolvedLanguage`, so if it stays
  // there they read English inside a French page after every reload.
  it('is the resolved language once its bundles have loaded', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    vi.resetModules();
    const { i18n, initialLanguageReady } = await import('./index');
    await initialLanguageReady;
    expect(i18n.language).toBe('fr');
    expect(i18n.resolvedLanguage).toBe('fr');
  });
});
