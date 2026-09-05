/**
 * i18next bootstrap.
 *
 * Imported for side effects from `main.tsx` before the first render so `t()` is
 * usable from module scope (constant tables, service-layer messages) as well as
 * from components.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { applyDocumentDirection } from '@/lib/direction';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
  type LanguageCode,
} from './config';
import { DEFAULT_NAMESPACE, NAMESPACES, type Namespace } from './namespaces';
import { enResources, loadLanguageBundles } from './resources';

/**
 * Best guess at the user's language before `/auth/me` answers: the last choice
 * they made in this browser, else the browser's own language, else English.
 * Once the profile loads, `LanguageProvider` reconciles with the server value.
 */
function detectInitialLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) return normalizeLanguage(stored);
  } catch {
    // Private mode / storage disabled — fall through to the navigator.
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return normalizeLanguage(navigator.language);
  }
  return DEFAULT_LANGUAGE;
}

const initialLanguage = detectInitialLanguage();

void i18n.use(initReactI18next).init({
  resources: { en: enResources },
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  // A locale that is only partially translated must fall back key-by-key, not
  // namespace-by-namespace, or one missing key would blank a whole surface.
  fallbackNS: false,
  ns: [...NAMESPACES],
  defaultNS: DEFAULT_NAMESPACE,
  interpolation: {
    // React escapes for us; double-escaping mangles apostrophes in French copy.
    escapeValue: false,
  },
  returnNull: false,
  // Keys are authored as `namespace:some.key`; `:` is the namespace separator
  // and `.` the nesting separator, which is i18next's default and what the
  // JSON files are shaped for.
  nsSeparator: ':',
  keySeparator: '.',
  react: {
    useSuspense: false,
  },
  // Surface untranslated keys loudly in development, silently in production.
  // i18next only invokes `missingKeyHandler` when `saveMissing` is on, so the
  // two have to be flipped together — there is no backend connector wired, so
  // "saving" here means nothing more than calling the handler below.
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: import.meta.env.DEV
    ? (lngs, ns, key) => {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] missing key "${ns}:${key}" for ${lngs.join(', ')}`);
      }
    : undefined,
});

applyDocumentDirection(initialLanguage);

const loadedLanguages = new Set<LanguageCode>([DEFAULT_LANGUAGE]);

/**
 * Switch the active language, fetching its bundles first so the UI never
 * repaints in a half-translated state. Idempotent and safe to call with the
 * language already active.
 */
export async function changeLanguage(next: LanguageCode): Promise<void> {
  const language = normalizeLanguage(next);
  if (!loadedLanguages.has(language)) {
    await loadLanguageBundles(language, (lng, ns: Namespace, resources) => {
      i18n.addResourceBundle(lng, ns, resources, true, true);
    });
    loadedLanguages.add(language);
  }
  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }
  applyDocumentDirection(language);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Non-fatal: the profile is the durable store, this is just a fast path.
  }
}

// Kick off the initial non-English load. `LanguageProvider` awaits readiness so
// nothing renders against a half-loaded bundle.
export const initialLanguageReady: Promise<void> =
  initialLanguage === DEFAULT_LANGUAGE ? Promise.resolve() : changeLanguage(initialLanguage);

export { i18n };
export default i18n;
