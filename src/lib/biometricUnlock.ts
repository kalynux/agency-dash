/**
 * Biometric sign-in: the policy layer over `platform/biometrics.ts`.
 *
 * ## What this feature actually is
 *
 * On the bearer (native) transport the app already holds a 30-day sliding
 * refresh token in the Keystore, so a returning user is signed in without ever
 * typing a password — see `platform/auth/secureTokenStore.ts`. "Sign in with
 * your fingerprint" therefore cannot mean *sending* a fingerprint anywhere, and
 * it does not need to mean storing a password either. It means: **the stored
 * session is not usable until the person holding the phone proves they are its
 * owner.**
 *
 * That gives one mechanism and two visible behaviours:
 *
 * 1. **On launch** — `passesLaunchGate()` runs inside the session bootstrap. No
 *    unlock, no session: the app lands on the sign-in screen instead.
 * 2. **On the sign-in screen** — when a stored session is sitting there waiting,
 *    `canOfferBiometricSignIn()` is true and the screen offers a one-tap way
 *    back in rather than making the user type a password it does not need.
 * 3. **On resume** — `BiometricAppLock` re-arms after a stretch in the
 *    background, so an unlocked phone left on a table does not stay an open
 *    dashboard.
 *
 * ## Sign-out
 *
 * `authService.logout()` destroys the tokens, and this feature deliberately does
 * not keep a copy: after an explicit sign-out there is nothing for a fingerprint
 * to unlock and the next sign-in is a password one. That is the point of the
 * button — "sign out" has to mean the credential is off the device, or it is a
 * promise the app is not keeping. The *preference* survives, so biometric
 * unlock re-arms by itself on the next successful sign-in.
 *
 * ## Failing open
 *
 * If the preference is on but biometry has become unavailable — the user
 * removed their only fingerprint, or a hardware sensor failed — the gate lets
 * them through and says so in the log. The alternative is locking someone out
 * of a valid session over a setting they may not remember turning on, in
 * exchange for a gate that was never the thing protecting the tokens (the
 * Keystore is). See the warning at the top of `platform/biometrics.ts`.
 */
import i18n from '@/i18n';
import { authStrategy } from '@/platform/auth/strategy';
import {
  getBiometryInfo,
  promptBiometric,
  type BiometryKind,
  type UnlockOutcome,
} from '@/platform/biometrics';
import { isNative } from '@/platform/env';
import { suspendAppStateWatch } from '@/platform/shell/appState';

/**
 * Where the preference lives.
 *
 * `localStorage` and not the secure store on purpose: this is a boolean about
 * how the app behaves, not a secret, and the one thing it must be is readable
 * *before* the first prompt — the whole point is deciding whether to ask.
 * Nothing is unlocked by knowing it is on.
 */
const PREFERENCE_KEY = 'wi-agency:biometric-unlock';

/**
 * Set once the user has proven themselves in this run of the app.
 *
 * Scoped to the module, so it dies with the process — an app the OS killed in
 * the background comes back locked, which is the whole point. Never persisted.
 */
let unlockedThisRun = false;

/** Whether the user has asked for biometric unlock. Always false off native. */
export function isBiometricUnlockEnabled(): boolean {
  if (!isNative) return false;
  try {
    return localStorage.getItem(PREFERENCE_KEY) === 'on';
  } catch {
    // Storage blocked — the honest answer is "not enabled", which costs the
    // user a password rather than locking them out.
    return false;
  }
}

/**
 * Record the preference. Turning it *on* is only ever correct after a
 * successful prompt — see `enableBiometricUnlock`, which is the way in.
 */
function writePreference(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(PREFERENCE_KEY, 'on');
    else localStorage.removeItem(PREFERENCE_KEY);
  } catch (err) {
    console.warn('[biometrics] could not persist the unlock preference', err);
  }
}

/** Which OS dialog copy to use — the two asks are for different things. */
type UnlockPurpose = 'unlock' | 'enable';

function promptCopy(purpose: UnlockPurpose) {
  return purpose === 'enable'
    ? {
        title: i18n.t('auth:biometric.enableTitle'),
        reason: i18n.t('auth:biometric.enableReason'),
        cancel: i18n.t('auth:biometric.promptCancel'),
      }
    : {
        title: i18n.t('auth:biometric.promptTitle'),
        reason: i18n.t('auth:biometric.promptReason'),
        cancel: i18n.t('auth:biometric.promptCancel'),
      };
}

/**
 * Show the OS prompt and report what happened.
 *
 * The app-state watch is suspended around it because on Android the prompt is
 * its own activity: without this, the round trip through it reads as "the user
 * left and came back" and `BiometricAppLock` would re-lock the app the instant
 * it was unlocked.
 */
async function prompt(purpose: UnlockPurpose): Promise<UnlockOutcome> {
  const release = suspendAppStateWatch();
  try {
    const outcome = await promptBiometric(promptCopy(purpose));
    if (outcome === 'ok') unlockedThisRun = true;
    return outcome;
  } finally {
    release();
  }
}

/**
 * Ask the user to unlock. `'ok'` is the only outcome that grants access; every
 * other one is described by {@link UnlockOutcome} and has its own copy.
 */
export function unlockWithBiometrics(): Promise<UnlockOutcome> {
  return prompt('unlock');
}

/**
 * Turn the feature on, but only if it demonstrably works.
 *
 * The prompt is the point: promising "you can get in with your fingerprint" and
 * finding out on the next cold start that the sensor refuses is the failure
 * mode this rules out. Returns the outcome so the toggle can explain a refusal.
 */
export async function enableBiometricUnlock(): Promise<UnlockOutcome> {
  const info = await getBiometryInfo();
  if (!info.available) return 'unavailable';

  const outcome = await prompt('enable');
  if (outcome === 'ok') writePreference(true);
  return outcome;
}

/** Turn the feature off. No prompt — locking someone out is not a risk here. */
export function disableBiometricUnlock(): void {
  writePreference(false);
  unlockedThisRun = false;
}

/**
 * The launch gate, called from the session bootstrap before `auth-me`.
 *
 * `true` means "carry on and restore the session". `false` means the user did
 * not unlock, and the caller must treat the app as signed out — the tokens stay
 * where they are, and the sign-in screen offers the fingerprint button that
 * gets them back.
 */
export async function passesLaunchGate(): Promise<boolean> {
  if (!isBiometricUnlockEnabled() || unlockedThisRun) return true;

  const info = await getBiometryInfo();
  if (!info.available) {
    // Fail open — see the module header. Loud, because the user turned this on
    // and is no longer getting it, and nothing else in the UI will say so.
    console.warn(
      `[biometrics] unlock is enabled but unavailable (${info.reason || 'no reason given'}) — allowing the session through`,
    );
    unlockedThisRun = true;
    return true;
  }

  return (await unlockWithBiometrics()) === 'ok';
}

/**
 * Whether the sign-in screen should offer a biometric button.
 *
 * All three conditions matter: the user asked for it, there is actually a
 * stored session for it to unlock (after a sign-out there is not), and the
 * device can still ask. A button that leads to "biometrics unavailable" is
 * worse than no button.
 */
export async function canOfferBiometricSignIn(): Promise<boolean> {
  if (!isBiometricUnlockEnabled()) return false;
  if (!(await authStrategy.canAttemptSession())) return false;
  return (await getBiometryInfo()).available;
}

/**
 * Forget that the user unlocked in this run, so the next gate asks again.
 * Called when the app has been in the background long enough to re-lock.
 */
export function relock(): void {
  unlockedThisRun = false;
}

/** Whether this run has been unlocked. Read by the resume lock. */
export function isUnlockedThisRun(): boolean {
  return unlockedThisRun;
}

/**
 * Copy tables for the two screens that surface this feature.
 *
 * `Record`s over the full enum rather than keys built with a template string,
 * so adding a biometry type or an outcome is a type error here instead of a raw
 * key painted into the UI — the pattern `src/i18n/tx.ts` asks for whenever a
 * key is chosen at runtime. `as const satisfies` is what keeps the *values*
 * literal, which is what makes `t()` check them against the English bundle.
 *
 * Keys are namespace-relative: every consumer holds a `t` from
 * `useTranslation('auth')`.
 */
export const SIGN_IN_LABEL_KEY = {
  fingerprint: 'biometric.signIn.fingerprint',
  face: 'biometric.signIn.face',
  iris: 'biometric.signIn.iris',
  none: 'biometric.signIn.none',
} as const satisfies Record<BiometryKind, string>;

export const UNLOCK_LABEL_KEY = {
  fingerprint: 'biometric.unlock.fingerprint',
  face: 'biometric.unlock.face',
  iris: 'biometric.unlock.iris',
  none: 'biometric.unlock.none',
} as const satisfies Record<BiometryKind, string>;

/**
 * Outcome → message. `'ok'` and `'cancelled'` map to `null` on purpose: success
 * moves on, and a cancel is a decision rather than a fault — the password form
 * is right there, and an error under it would be scolding someone for choosing
 * it.
 */
export const OUTCOME_MESSAGE = {
  ok: null,
  cancelled: null,
  failed: 'biometric.error.failed',
  lockedOut: 'biometric.error.lockedOut',
  unavailable: 'biometric.error.unavailable',
} as const satisfies Record<UnlockOutcome, string | null>;

/** Test seam: reset the run-scoped latch between cases. */
export function resetBiometricUnlockForTests(): void {
  unlockedThisRun = false;
}
