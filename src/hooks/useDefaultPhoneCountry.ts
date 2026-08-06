import { useMemo } from 'react';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { DEFAULT_PHONE_COUNTRY, toPhoneCountry, type CountryCode } from '@/lib/phone';

/**
 * The country every phone field in the app opens on.
 *
 * That is the agency's own operating country — set once during onboarding step 1
 * and immutable afterwards (`403 PROFILE_COUNTRY_IMMUTABLE`), which is exactly
 * the "preferred country configured in the profile" a phone picker should
 * default to. It rides on the session, so this is a context read rather than a
 * fetch and every field agrees without coordinating.
 *
 * Resolution order: an explicit `override` (onboarding step 1, where the country
 * is still being decided and the session cannot answer yet) → the session's
 * country → the platform default. The user can always pick another country in
 * the field itself; this only decides where the picker starts.
 *
 * Must be called under `<OnboardingProvider>`, which wraps every route in
 * `App.tsx`.
 */
export function useDefaultPhoneCountry(override?: string | null): CountryCode {
  const { session } = useOnboarding();
  const sessionCountry = session?.role_entity.country ?? null;

  return useMemo(
    () =>
      toPhoneCountry(override) ?? toPhoneCountry(sessionCountry) ?? DEFAULT_PHONE_COUNTRY,
    [override, sessionCountry],
  );
}
