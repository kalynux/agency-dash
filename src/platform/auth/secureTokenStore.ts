/**
 * Native token storage — Keychain on iOS, Keystore-backed encrypted storage on
 * Android (CAPACITOR-PLAN.md → P2.4).
 *
 * **`@capacitor/preferences` is not acceptable here.** On Android it is plaintext
 * `SharedPreferences`, and the backend spec is explicit that tokens must not live
 * there. A 30-day sliding refresh token in plaintext on a rooted device is a
 * standing session for whoever finds it.
 *
 * Two behaviours are load-bearing:
 *
 * 1. **An in-memory cache sits in front.** `authHeaders()` runs on every single
 *    request; awaiting a Keystore round trip there would put native IPC in the
 *    hot path of the whole app.
 * 2. **A storage failure never fails the caller.** Keystore is genuinely flaky on
 *    a minority of devices (a changed lock screen can invalidate keys). Throwing
 *    from `set()` would turn a successful login into a failed one; instead the
 *    session lives in memory for this launch and is loudly logged.
 */
import { SecureStorage, StorageError, StorageErrorType } from '@aparajita/capacitor-secure-storage';
import type { AuthTokens } from '@/types/api';
import { platform } from '../env';
import { isUsableTokens, stampExpiry, type StoredTokens, type TokenStore } from './tokens';

/**
 * The keychain/keystore entry name. The plugin prefixes it (default
 * `capacitor-storage_`), which is fine — nothing else reads this entry.
 *
 * Changing this string signs every installed user out on their next launch,
 * because the old entry becomes unreachable rather than invalid.
 */
const KEY = 'auth-tokens';

let cached: StoredTokens | null = null;

/**
 * The in-flight hydration, so N concurrent first requests do one read.
 *
 * A plain `hydrated` boolean is not enough here, unlike in the dev store:
 * `sessionStorage` is synchronous, but this read is not, and the app fires
 * several requests at once on launch. Without the shared promise each one would
 * start its own Keystore read before any had finished.
 */
let hydration: Promise<void> | null = null;

/** iOS keychain configuration. Applied once, lazily, before the first access. */
let configured: Promise<void> | null = null;

async function configure(): Promise<void> {
  await (configured ??= (async () => {
    try {
      // Never sync session tokens to iCloud: a refresh token that lands on the
      // user's other devices is a session we did not issue and cannot see. This
      // is a no-op outside iOS.
      if (platform === 'ios') await SecureStorage.setSynchronize(false);
    } catch (err) {
      console.error('[auth] secure storage could not be configured', err);
    }
  })());
}

async function hydrate(): Promise<void> {
  await configure();
  try {
    // The string API, not the object one. `set()`/`get()` reinterpret ISO-8601
    // strings as Dates and take a `Record<string, unknown>`, neither of which we
    // want: our payload is a fixed shape and must round-trip byte for byte.
    const text = await SecureStorage.getItem(KEY);
    const raw: unknown = text === null ? null : JSON.parse(text);
    // Validated, never cast: the entry may have been written by an older build
    // with a different shape, and `Authorization: Bearer undefined` reads as a
    // server fault rather than a storage one. See isUsableTokens.
    if (isUsableTokens(raw)) {
      cached = raw;
      return;
    }
    if (raw !== null) {
      // Present but unusable — remove it so we are not re-reading garbage on
      // every launch, and so `canAttemptSession()` stops claiming a session.
      console.warn('[auth] discarding an unusable token entry from secure storage');
      await SecureStorage.remove(KEY).catch(() => {});
    }
    cached = null;
  } catch (err) {
    // `invalidData` means the entry is corrupt — the encrypted blob cannot be
    // decrypted, which on Android is what a reset lock screen looks like. There
    // is nothing to recover; clear it and treat the user as signed out.
    if (err instanceof StorageError && err.code === StorageErrorType.invalidData) {
      await SecureStorage.remove(KEY).catch(() => {});
    } else {
      console.error('[auth] could not read secure storage', err);
    }
    cached = null;
  }
}

export const secureTokenStore: TokenStore = {
  async get() {
    await (hydration ??= hydrate());
    return cached;
  },

  async set(tokens: AuthTokens) {
    const stamped = stampExpiry(tokens);

    // Cache first, and mark hydration done: a request racing this write must see
    // the NEW token, not trigger a read of the old one. Assigning `hydration` to
    // a resolved promise is what retires the pending read.
    cached = stamped;
    hydration = Promise.resolve();

    try {
      await SecureStorage.setItem(KEY, JSON.stringify(stamped));
    } catch (err) {
      // Deliberately swallowed. The caller is mid-login or mid-refresh and holds
      // a working session; failing here would throw that away over a storage
      // problem. The cost is that the session does not survive a relaunch, which
      // is a far smaller failure than not signing in at all.
      console.error('[auth] could not persist tokens to secure storage', err);
    }
  },

  async clear() {
    cached = null;
    hydration = Promise.resolve();
    try {
      await SecureStorage.remove(KEY);
    } catch (err) {
      console.error('[auth] could not clear secure storage', err);
    }
  },
};
