import { useMemo } from 'react';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { readAccountStanding, type AccountStanding } from '@/lib/account-standing';

/**
 * Whether this account may operate, and whether an administrator has vetted it.
 *
 * Read off the session the app already holds — no request. Read
 * `lib/account-standing.ts` before branching on any of it: the two questions
 * look like one field and are not.
 *
 * The session refreshes on sign-in, on `refreshSession()`, and after the profile
 * writes that go through the onboarding store — so an approval that lands mid-
 * session shows on the next of those, not instantly. That is fine for every
 * caller here: the copy this drives is an invitation to do something, and the
 * screens that must be current about a verdict (Account → Verification) read
 * `/api/agency/kyc` directly instead.
 */
export function useAccountStanding(): AccountStanding {
  const { session } = useOnboarding();
  const entity = session?.role_entity ?? null;
  return useMemo(() => readAccountStanding(entity), [entity]);
}
