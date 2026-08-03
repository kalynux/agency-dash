import { useContext } from 'react';

import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, normalizeLanguage } from './config';
import { changeLanguage, i18n } from './index';
import { LanguageContext, type LanguageContextValue } from './language-context';

/**
 * The active language plus the switcher. Read `language` when you need the code
 * itself (formatting, `lang`/`dir` attributes); for copy use `useTranslation`.
 */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Outside the provider (e.g. an isolated test render) the app still has to
    // work — fall back to the i18next singleton rather than throwing.
    return {
      language: normalizeLanguage(i18n.language ?? DEFAULT_LANGUAGE),
      languages: SUPPORTED_LANGUAGES,
      setLanguage: (code) => void changeLanguage(code),
      syncFromProfile: () => {},
      ready: true,
    };
  }
  return ctx;
}
