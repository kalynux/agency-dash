import { txStatic } from '@/i18n/tx';

/**
 * Copy for a backend token, falling back to its humanized form.
 *
 * Contract origins, history event types, eligibility rules and deposit statuses
 * are all open unions on the wire (`(string & {})`) and the membership log is
 * append-only, so a value we have no copy for still has to read as something.
 *
 * Shared rather than private to one screen: the membership sheet and the roster
 * history tab render the same event tokens, and a second copy of this fallback
 * would drift the first time a new event type shipped.
 */
export function tokenLabel(group: string, token: string): string {
  const key = `${group}.${token}`;
  const translated = txStatic(key);
  // i18next answers a missing key with the key MINUS its namespace, so both
  // forms have to count as "no copy for this". Comparing only against the
  // prefixed one painted `availability.<token>` onto the screen instead of
  // falling back.
  const bare = key.slice(key.indexOf(':') + 1);
  return translated === key || translated === bare ? token.replace(/_/g, ' ') : translated;
}
