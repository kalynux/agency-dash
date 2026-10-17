import { useOnboarding } from '@/onboarding/store/onboarding.store';

/**
 * The signed-in user's `users` id — the id the backend stamps on what this
 * account authors (`created_by_user_id` on a ticket, `author_user_id` on a
 * note). NOT the agency profile id (`role_entity`), which is a different
 * collection.
 *
 * `/auth/me` documents `_id`; `id` is read too, since the same document
 * serialised through the backend's base `toJSON` carries `id` instead.
 * `null` until the session has loaded.
 */
export function useCurrentUserId(): string | null {
  const user = useOnboarding().session?.user as { _id?: string; id?: string } | undefined;
  return user?._id ?? user?.id ?? null;
}
