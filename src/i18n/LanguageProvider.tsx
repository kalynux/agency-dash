import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { SUPPORTED_LANGUAGES, normalizeLanguage, type LanguageCode } from './config';
import { changeLanguage, i18n, initialLanguageReady } from './index';
import { LanguageContext, type LanguageContextValue } from './language-context';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() =>
    normalizeLanguage(i18n.language),
  );
  const [ready, setReady] = useState(false);

  // True once the *user* has picked a language in this session. After that a
  // late-arriving profile refresh must not yank the UI back — their unsaved
  // choice is the more recent intent.
  const userChoseRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void initialLanguageReady.finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // react-i18next re-renders `t()` consumers on its own, but this context also
  // feeds non-`t()` consumers (Intl formatting, the `dir` attribute), so mirror
  // the active language into React state.
  useEffect(() => {
    const onChanged = (lng: string) => setLanguageState(normalizeLanguage(lng));
    i18n.on('languageChanged', onChanged);
    return () => {
      i18n.off('languageChanged', onChanged);
    };
  }, []);

  const setLanguage = useCallback((code: LanguageCode) => {
    userChoseRef.current = true;
    void changeLanguage(code);
  }, []);

  const syncFromProfile = useCallback((value: string | null | undefined) => {
    if (userChoseRef.current) return;
    if (!value) return;
    const next = normalizeLanguage(value);
    if (next === normalizeLanguage(i18n.language)) return;
    void changeLanguage(next);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      languages: SUPPORTED_LANGUAGES,
      setLanguage,
      syncFromProfile,
      ready,
    }),
    [language, setLanguage, syncFromProfile, ready],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
