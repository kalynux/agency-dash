/**
 * Device biometrics — Android fingerprint/face/iris, iOS Touch ID / Face ID.
 *
 * The plugin seam and nothing else: this file knows about
 * `@aparajita/capacitor-biometric-auth` so that no screen has to, and it holds
 * no policy, no storage and no copy. What the app *does* with an unlock is
 * `src/lib/biometricUnlock.ts`'s problem.
 *
 * ⚠ **What a successful prompt does and does not prove.** It proves the person
 * holding the phone right now is its owner. It does NOT re-derive any key — the
 * session tokens are already protected by the Android Keystore / iOS Keychain
 * (`platform/auth/secureTokenStore.ts`), and this check sits *in front of* them
 * rather than encrypting them. So the gate raises the bar for someone who picks
 * up an unlocked phone; it is not a defence against someone who has rooted the
 * device and can read the Keystore entry directly. That is the standard
 * trade-off for this pattern and it is why the gate is allowed to fail open
 * (see `biometricUnlock.ts`) rather than strand a user out of their own account.
 */
import {
  BiometricAuth,
  BiometryError,
  BiometryErrorType,
  BiometryType,
} from '@aparajita/capacitor-biometric-auth';
import { isNative } from './env';

/**
 * The kind of biometry the device leads with, reduced to what the copy needs to
 * distinguish. The plugin reports six variants; a user only needs to be told
 * whether we are about to ask for a finger or a face.
 */
export type BiometryKind = 'fingerprint' | 'face' | 'iris' | 'none';

export interface BiometryInfo {
  /** Hardware present, user enrolled, nothing blocking a prompt right now. */
  available: boolean;
  kind: BiometryKind;
  /**
   * True when the only thing missing is enrolment — the device *can* do this,
   * the user just has not registered a finger or a face. The one unavailable
   * state worth offering a route to system settings for, because it is the only
   * one the user can fix.
   */
  notEnrolled: boolean;
  /** The OS's own untranslated explanation, for logs. Never render this. */
  reason: string;
}

/** Every way `unlock()` can end, collapsed to what a caller can act on. */
export type UnlockOutcome =
  /** Identity confirmed. */
  | 'ok'
  /** The user backed out. Not an error, and never worth an error message. */
  | 'cancelled'
  /** Presented and not recognised. Worth offering a retry. */
  | 'failed'
  /** Too many bad attempts; the OS has closed the door for a while. */
  | 'lockedOut'
  /** No biometry to ask for. Callers fall back to the password. */
  | 'unavailable';

/** The strings shown *inside* the OS dialog. Localised by the caller. */
export interface BiometricPromptCopy {
  /** Android dialog title. */
  title: string;
  /** Android subtitle / iOS reason line — why we are asking. */
  reason: string;
  /** The dialog's negative button. */
  cancel: string;
}

const UNAVAILABLE: BiometryInfo = {
  available: false,
  kind: 'none',
  notEnrolled: false,
  reason: 'not a native platform',
};

function toKind(type: BiometryType): BiometryKind {
  switch (type) {
    case BiometryType.touchId:
    case BiometryType.fingerprintAuthentication:
      return 'fingerprint';
    case BiometryType.faceId:
    case BiometryType.faceAuthentication:
      return 'face';
    case BiometryType.irisAuthentication:
      return 'iris';
    default:
      return 'none';
  }
}

/**
 * What biometry this device can offer, right now.
 *
 * Cheap enough to call on every render of the settings toggle, but it is a
 * native round trip — cache it in component state rather than in a render body.
 * Never throws: an unreadable answer is reported as "unavailable", which is the
 * conservative reading and the one every caller already handles.
 */
export async function getBiometryInfo(): Promise<BiometryInfo> {
  if (!isNative) return UNAVAILABLE;
  try {
    const result = await BiometricAuth.checkBiometry();
    return {
      // `isAvailable` already means "supported AND enrolled AND usable"; the
      // weak/strong distinction is deliberately not surfaced. Requiring strong
      // biometry would exclude face unlock on a large slice of mid-range
      // Android — the exact devices this app ships to — for a gate that is a
      // convenience over an already-encrypted store.
      available: result.isAvailable,
      kind: toKind(result.biometryType),
      notEnrolled: result.code === BiometryErrorType.biometryNotEnrolled,
      reason: result.reason,
    };
  } catch (err) {
    console.warn('[biometrics] could not read biometry availability', err);
    return { ...UNAVAILABLE, reason: String(err) };
  }
}

/**
 * Ask the OS to confirm the user's identity.
 *
 * Resolves to an outcome instead of throwing: every one of these is an ordinary
 * thing for a person to do (change their mind, present the wrong finger, have
 * never enrolled), and a `try`/`catch` at each of the three call sites would be
 * three chances to treat a cancel as a failure.
 *
 * `allowDeviceCredential: true` lets the device PIN/pattern/passcode through the
 * same dialog. That is deliberate: without it, five bad reads produce
 * `biometryLockout` and the *only* way back into the app is a full password
 * sign-in — a dead end reached by a wet thumb. With it, the OS offers the PIN
 * as the fallback, which is the same secret that protects the Keystore holding
 * the tokens anyway, so it concedes nothing.
 */
export async function promptBiometric(copy: BiometricPromptCopy): Promise<UnlockOutcome> {
  if (!isNative) return 'unavailable';

  try {
    await BiometricAuth.authenticate({
      reason: copy.reason,
      cancelTitle: copy.cancel,
      androidTitle: copy.title,
      androidSubtitle: copy.reason,
      iosFallbackTitle: '',
      allowDeviceCredential: true,
      // The default is `true`, which adds a "Confirm" tap after a weak-biometry
      // match. For a gate that runs on every cold start that second tap is pure
      // friction — the user has already proven who they are.
      androidConfirmationRequired: false,
    });
    return 'ok';
  } catch (err) {
    if (!(err instanceof BiometryError)) {
      console.error('[biometrics] authenticate failed with a non-BiometryError', err);
      return 'failed';
    }
    switch (err.code) {
      case BiometryErrorType.userCancel:
      case BiometryErrorType.appCancel:
      case BiometryErrorType.systemCancel:
      case BiometryErrorType.userFallback:
        return 'cancelled';
      case BiometryErrorType.biometryLockout:
        return 'lockedOut';
      case BiometryErrorType.biometryNotAvailable:
      case BiometryErrorType.biometryNotEnrolled:
      case BiometryErrorType.passcodeNotSet:
      case BiometryErrorType.noDeviceCredential:
        return 'unavailable';
      default:
        return 'failed';
    }
  }
}
