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
 * ## Two things can sit behind the prompt
 *
 * 1. **The stored session**, when the launch gate bounced someone off a token
 *    pair that is still sitting in the Keystore. Unlocking restores it.
 * 2. **A stored credential** — the identifier and password, kept in secure
 *    storage by `platform/auth/biometricLogin.ts` once the user ticks the opt-in
 *    on the sign-in screen. This is the one that survives `logout()` and a
 *    session expiring, and it is why "sign in with your fingerprint" is a *sign
 *    in* rather than a lock screen. Read that file's header for what is stored
 *    and the trade-off it carries.
 *
 * The two are opted into separately and neither implies the other. The launch
 * gate is a *lock* — an OS dialog on every cold start — and it is asked for in
 * Settings. The credential is a *sign-in*, asked for on the sign-in screen. A
 * user can have either, both, or neither.
 *
 * The credential wins when both are present: it works in strictly more
 * situations, and it is the one that knows *whose* account the thumb opens.
 *
 * ## Sign-out
 *
 * `authService.logout()` destroys the tokens. It does **not** destroy the
 * credential — signing out and back in with a thumb is the entire point of the
 * feature. The explicit off switch is Settings → Security, which forgets the
 * credential and the preference together; that is the one place "make this
 * device forget me" lives, and it is where someone would look for it.
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
import {
  clearBiometricCredential,
  readBiometricCredential,
  writeBiometricCredential,
} from '@/platform/auth/biometricLogin';
import { isNative } from '@/platform/env';
import { suspendAppStateWatch } from '@/platform/shell/appState';
import type { AgencyLoginInput } from '@/services/auth.service';

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

/**
 * Turn the feature off, everywhere.
 *
 * No prompt — locking someone out is not a risk here. The stored credential goes
 * with the preference on purpose: a switch labelled "biometric unlock" that left
 * a password behind in the Keystore would be lying about what it did.
 */
export async function disableBiometricUnlock(): Promise<void> {
  writePreference(false);
  unlockedThisRun = false;
  await clearBiometricCredential();
}

/**
 * Forget only the stored credential, leaving the preference alone.
 *
 * For the case the sign-in screen owns: a *different* account just signed in on
 * this phone. The biometric gate proves "someone enrolled on this device", not
 * "the person who saved this credential" — so on a handset with more than one
 * finger enrolled, leaving the previous user's credential behind would let
 * whoever holds the phone next open an account that is not theirs.
 */
export async function forgetBiometricSignIn(): Promise<void> {
  await clearBiometricCredential();
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

/** Everything the sign-in screen needs in order to decide what to render. */
export interface BiometricSignInStatus {
  /** Offer the unlock button: the device can ask, and there is something to open. */
  offer: boolean;
  /** Offer the opt-in: the device can ask, but nothing is stored to open yet. */
  canOptIn: boolean;
  /** Drives whether the copy says "fingerprint" or "face unlock". */
  kind: BiometryKind;
  /**
   * Whose account the thumb opens — shown under the button, because it matters
   * on a phone more than one person uses. `null` on the stored-session path,
   * which knows a token pair exists but not who it belongs to.
   */
  identifier: string | null;
}

/**
 * Resolve that state in one pass.
 *
 * Order matters. Biometry first, because a device that cannot ask should offer
 * neither control — a button leading to "biometrics unavailable" is worse than
 * no button, and a checkbox promising a way in that will not work is worse
 * still. Then the credential, which works in strictly more situations than the
 * stored session and is the only one that can name the account.
 */
export async function biometricSignInStatus(): Promise<BiometricSignInStatus> {
  const info = await getBiometryInfo();
  if (!info.available) return { offer: false, canOptIn: false, kind: info.kind, identifier: null };

  const stored = await readBiometricCredential();
  if (stored) {
    return { offer: true, canOptIn: false, kind: info.kind, identifier: stored.identifier };
  }

  // Nothing stored — but the launch gate may still have bounced someone off a
  // session sitting right there in the Keystore, and unlocking restores it.
  // While that is true the feature is already on, so the opt-in stays away
  // rather than asking someone to enable what they are looking at.
  const gated = isBiometricUnlockEnabled() && (await authStrategy.canAttemptSession());
  return { offer: gated, canOptIn: !gated, kind: info.kind, identifier: null };
}

/** Whether the sign-in screen should offer a biometric button. */
export async function canOfferBiometricSignIn(): Promise<boolean> {
  return (await biometricSignInStatus()).offer;
}

/**
 * Turn on fingerprint sign-in for a credential that has **just been used to
 * sign in successfully**.
 *
 * That precondition is why this is never called speculatively: an unverified
 * password stored here would fail on every future unlock, and the user would
 * have no way to tell a broken feature from a broken finger.
 *
 * The prompt runs *before* the write, so enabling and using the feature go
 * through the same gate — a phone left unlocked on a table cannot silently
 * acquire a stored password.
 *
 * ⚠ **It deliberately does NOT arm the launch gate.** Those are two different
 * promises and only one of them was made here. This checkbox promises a button
 * on the sign-in screen; the launch gate raises an OS dialog on every cold
 * start, which is a *lock*, and the only place anyone asks for that is the
 * Settings toggle (`enableBiometricUnlock`). Setting the preference here meant
 * someone who ticked "next time, sign in with your fingerprint" got an
 * unasked-for system prompt on the next launch and never reached the sign-in
 * screen the checkbox was talking about.
 *
 * The credential alone is enough for what was promised: while the session is
 * still good the app opens straight to the dashboard and no sign-in is needed,
 * and the moment one *is* needed — after a sign-out, or once the session
 * expires — the button is there.
 */
export async function enableBiometricSignIn(
  credential: AgencyLoginInput,
): Promise<UnlockOutcome> {
  const info = await getBiometryInfo();
  if (!info.available) return 'unavailable';

  const outcome = await prompt('enable');
  if (outcome !== 'ok') return outcome;

  if (!(await writeBiometricCredential(credential))) return 'failed';
  return 'ok';
}

/** What {@link unlockForSignIn} hands back. */
export type SignInUnlock =
  | {
      ok: true;
      /**
       * The credential to sign in with, or `null` when there was none stored and
       * the caller should restore the existing session instead.
       */
      credential: AgencyLoginInput | null;
    }
  | { ok: false; outcome: Exclude<UnlockOutcome, 'ok'> };

/**
 * Prompt, then hand back whatever is behind the gate.
 *
 * The caller performs the sign-in rather than this module, because only it knows
 * what to do with the session afterwards — and only it can tell a rejected
 * credential (a password changed on another device) from a network failure. On
 * a rejection the caller must call {@link forgetBiometricSignIn}: re-prompting a
 * thumb against a dead password is a loop.
 */
export async function unlockForSignIn(): Promise<SignInUnlock> {
  const outcome = await unlockWithBiometrics();
  if (outcome !== 'ok') {
    // Biometry has been removed from the device. The credential can never be
    // released again, so it is dead weight rather than a secret worth keeping.
    if (outcome === 'unavailable') await clearBiometricCredential();
    return { ok: false, outcome };
  }

  const stored = await readBiometricCredential();
  return {
    ok: true,
    credential: stored ? { identifier: stored.identifier, password: stored.password } : null,
  };
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

/** The opt-in offered on the sign-in screen, where the password is in hand. */
export const OPT_IN_LABEL_KEY = {
  fingerprint: 'biometric.optIn.fingerprint',
  face: 'biometric.optIn.face',
  iris: 'biometric.optIn.iris',
  none: 'biometric.optIn.none',
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
