import { useEffect } from 'react';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useLanguage } from './useLanguage';

/**
 * Adopts `preferred_language` from the agency session as soon as `/auth/me`
 * answers, so the dashboard is already in the user's language on the very first
 * screen — not only after they open Account → Profile.
 *
 * Renders nothing. Mounted once inside `OnboardingProvider`, which owns the
 * session. `syncFromProfile` yields to an unsaved in-session choice, so a
 * background session refresh can't yank the language out from under the user
 * mid-edit.
 */
export function ProfileLanguageSync() {
  const { session } = useOnboarding();
  const { syncFromProfile } = useLanguage();
  const preferred = session?.role_entity?.preferred_language;

  useEffect(() => {
    syncFromProfile(preferred);
  }, [preferred, syncFromProfile]);

  return null;
}
