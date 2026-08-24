/**
 * The credential behind "sign in with your fingerprint" — storage seam only.
 *
 * ## Why a credential and not the tokens
 *
 * The tokens were the obvious candidate and they do not work. Three options,
 * one of which actually delivers the feature:
 *
 *   1. **The token pair.** Already in secure storage and already restored on
 *      launch without any prompt — so gating it adds a *lock screen*, not a
 *      login. And `logout()` destroys it, which is precisely the moment someone
 *      next needs to sign in.
 *   2. **The refresh token, kept past logout.** Same 30-day sliding expiry, so
 *      it stops working exactly when someone who has not opened the app for a
 *      month needs it most — and keeping a live session token across an explicit
 *      sign-out is worse than what is below, not better.
 *   3. **The credential that was typed.** Works after a sign-out, after the
 *      session expires, indefinitely — which is what "let me in with my thumb"
 *      means to the person asking for it.
 *
 * So this stores the identifier and password, in the same Keystore/Keychain the
 * session tokens live in (`secureTokenStore` documents why `@capacitor/
 * preferences` is not acceptable for either), under a **separate entry** — so
 * clearing a session cannot disable the feature, and disabling the feature
 * cannot disturb a live session.
 *
 * ⚠ **The honest trade-off:** someone who both roots the device *and* defeats
 * the biometric prompt gets a reusable password rather than a revocable token.
 * The clean fix is a backend-issued, device-bound, individually revocable
 * biometric credential (`POST /auth/mobile/biometric-token` or similar), at
 * which point only the payload here changes and every call site stays as it is.
 * That is a backend ticket, not a reason to ship nothing.
 *
 * ## No prompting here
 *
 * This file never raises the OS dialog. The prompt has to be wrapped in
 * `suspendAppStateWatch()` or the round trip through Android's biometric
 * activity reads as "the user left the app" and the resume lock re-arms on top
 * of the unlock — that wrapping lives in `lib/biometricUnlock.ts`, which owns
 * every policy decision in this feature. Here there is only the box.
 */
import { SecureStorage, StorageError, StorageErrorType } from '@aparajita/capacitor-secure-storage';

import type { AgencyLoginInput } from '@/services/auth.service';
import { isNative } from '../env';

/**
 * Its own entry, separate from `auth-tokens`.
 *
 * Changing this string silently turns the feature off for every installed user
 * — the old entry becomes unreachable rather than invalid — and they would land
 * on a sign-in screen with no fingerprint button and no explanation.
 */
const KEY = 'biometric-login';

interface StoredCredential {
  identifier: string;
  password: string;
  /** ISO-8601. Diagnostics only — nothing keys off it. */
  savedAt: string;
}

/**
 * Validated, never cast. The entry may have been written by an older build with
 * a different shape, and posting `{ identifier: undefined }` to `/auth/login`
 * reads as a server fault rather than a storage one.
 */
function isStoredCredential(value: unknown): value is StoredCredential {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Partial<StoredCredential>;
  return (
    typeof c.identifier === 'string' &&
    c.identifier.length > 0 &&
    typeof c.password === 'string' &&
    c.password.length > 0
  );
}

/**
 * Read the stored credential, or `null`.
 *
 * Anything unreadable is *removed* rather than ignored, so the sign-in screen
 * stops offering a button that could only ever fail. `invalidData` is the case
 * that matters on Android: it is what a reset lock screen looks like — the blob
 * can no longer be decrypted and never will be again.
 */
export async function readBiometricCredential(): Promise<StoredCredential | null> {
  if (!isNative) return null;
  try {
    // The string API, not the object one — same reason as `secureTokenStore`:
    // `get()`/`set()` reinterpret ISO-8601 strings as `Date`s, and this payload
    // has to round-trip byte for byte.
    const text = await SecureStorage.getItem(KEY);
    const raw: unknown = typeof text === 'string' ? JSON.parse(text) : null;
    if (isStoredCredential(raw)) return raw;
    if (raw !== null) {
      console.warn('[auth] discarding an unusable biometric credential');
      await SecureStorage.remove(KEY).catch(() => {});
    }
    return null;
  } catch (err) {
    if (!(err instanceof StorageError) || err.code === StorageErrorType.invalidData) {
      await SecureStorage.remove(KEY).catch(() => {});
    } else {
      console.error('[auth] could not read the biometric credential', err);
    }
    return null;
  }
}

/** Whose account the thumb would open, or `null`. Never the password. */
export async function storedBiometricIdentifier(): Promise<string | null> {
  return (await readBiometricCredential())?.identifier ?? null;
}

/**
 * Store a credential that has **just signed in successfully**.
 *
 * That precondition is the caller's to keep, and it is why this is never called
 * speculatively: an unverified password stored here would fail on every future
 * unlock, and there would be no way to tell a broken feature from a broken
 * finger.
 *
 * Returns whether it landed. Unlike a token write — which is swallowed because
 * the caller holds a working session either way — a failure here has to be
 * reported: someone asked for a switch to be flipped and it was not.
 */
export async function writeBiometricCredential(credential: AgencyLoginInput): Promise<boolean> {
  if (!isNative) return false;
  const payload: StoredCredential = {
    identifier: credential.identifier,
    password: credential.password,
    savedAt: new Date().toISOString(),
  };
  try {
    await SecureStorage.setItem(KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('[auth] could not store the biometric credential', err);
    return false;
  }
}

/** Forget the credential. Safe to call when there is nothing stored. */
export async function clearBiometricCredential(): Promise<void> {
  if (!isNative) return;
  try {
    await SecureStorage.remove(KEY);
  } catch (err) {
    console.error('[auth] could not clear the biometric credential', err);
  }
}

/**
 * Keep the stored credential in step with a password just changed from inside
 * the app.
 *
 * Without this, changing a password in Settings → Security silently breaks
 * fingerprint sign-in: the next unlock 401s, the credential is thrown away, and
 * the user is back to typing with no idea which of the two things they did
 * caused it. A no-op when the feature is off.
 *
 * Best-effort on failure — the password change itself already succeeded, and the
 * fallback (a 401 on the next unlock, which clears the entry) is a recoverable
 * inconvenience rather than a lost session.
 */
export async function updateBiometricPassword(newPassword: string): Promise<void> {
  if (!isNative) return;
  const stored = await readBiometricCredential();
  if (!stored) return;
  try {
    await SecureStorage.setItem(
      KEY,
      JSON.stringify({ ...stored, password: newPassword, savedAt: new Date().toISOString() }),
    );
  } catch (err) {
    console.error('[auth] could not re-key the biometric credential', err);
  }
}
