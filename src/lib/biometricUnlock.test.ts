/**
 * @vitest-environment jsdom
 *
 * The policy around the biometric gate — which is where every interesting
 * decision in this feature lives. The prompt itself is a native dialog and is
 * not testable off a device; what is testable, and what has real consequences,
 * is *when we ask*, and what we do with each answer:
 *
 *   - a gate that fails closed strands a user out of a valid session over a
 *     fingerprint they deleted months ago;
 *   - a gate that never asks is a setting that silently does nothing;
 *   - a sign-in button offered when there are no stored tokens leads to a dead
 *     end that looks like a broken login;
 *   - a preference written without a successful prompt promises a way in that
 *     may not work on the next cold start.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { BiometryInfo, UnlockOutcome } from '@/platform/biometrics';

// `vi.hoisted` because `vi.mock` factories are lifted above every other
// statement in the file — a plain `const` above them is still in its temporal
// dead zone by the time a factory runs.
const {
  getBiometryInfo,
  promptBiometric,
  canAttemptSession,
  release,
  suspendAppStateWatch,
  readBiometricCredential,
  writeBiometricCredential,
  clearBiometricCredential,
} = vi.hoisted(() => {
  const releaseFn = vi.fn();
  return {
    getBiometryInfo: vi.fn<() => Promise<BiometryInfo>>(),
    promptBiometric: vi.fn<() => Promise<UnlockOutcome>>(),
    canAttemptSession: vi.fn<() => Promise<boolean>>(),
    release: releaseFn,
    suspendAppStateWatch: vi.fn(() => releaseFn),
    readBiometricCredential: vi.fn<() => Promise<{ identifier: string; password: string } | null>>(),
    writeBiometricCredential: vi.fn<() => Promise<boolean>>(),
    clearBiometricCredential: vi.fn<() => Promise<void>>(),
  };
});

vi.mock('@/platform/env', () => ({ isNative: true, platform: 'android', useBearerAuth: true }));
vi.mock('@/platform/biometrics', () => ({ getBiometryInfo, promptBiometric }));
vi.mock('@/platform/shell/appState', () => ({ suspendAppStateWatch }));
vi.mock('@/platform/auth/strategy', () => ({ authStrategy: { canAttemptSession } }));
vi.mock('@/platform/auth/biometricLogin', () => ({
  readBiometricCredential,
  writeBiometricCredential,
  clearBiometricCredential,
}));
vi.mock('@/i18n', () => ({ default: { t: (key: string) => key } }));

import {
  biometricSignInStatus,
  canOfferBiometricSignIn,
  disableBiometricUnlock,
  enableBiometricSignIn,
  enableBiometricUnlock,
  isBiometricUnlockEnabled,
  passesLaunchGate,
  relock,
  resetBiometricUnlockForTests,
  unlockForSignIn,
  unlockWithBiometrics,
} from './biometricUnlock';

const CREDENTIAL = { identifier: '+237671234567', password: 'hunter2' };

const AVAILABLE: BiometryInfo = {
  available: true,
  kind: 'fingerprint',
  notEnrolled: false,
  reason: '',
};

const UNAVAILABLE: BiometryInfo = {
  available: false,
  kind: 'none',
  notEnrolled: false,
  reason: 'no hardware',
};

/** Put the module in the state a user who has turned the feature on is in. */
async function turnOn(): Promise<void> {
  getBiometryInfo.mockResolvedValue(AVAILABLE);
  promptBiometric.mockResolvedValue('ok');
  await enableBiometricUnlock();
  relock();
  getBiometryInfo.mockReset();
  promptBiometric.mockReset();
}

beforeEach(() => {
  localStorage.clear();
  resetBiometricUnlockForTests();
  getBiometryInfo.mockReset();
  promptBiometric.mockReset();
  canAttemptSession.mockReset();
  suspendAppStateWatch.mockClear();
  release.mockClear();
  // The default world: nothing saved for the fingerprint button.
  readBiometricCredential.mockReset().mockResolvedValue(null);
  writeBiometricCredential.mockReset().mockResolvedValue(true);
  clearBiometricCredential.mockReset().mockResolvedValue(undefined);
});

describe('enableBiometricUnlock', () => {
  it('only writes the preference once a prompt has actually succeeded', async () => {
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    promptBiometric.mockResolvedValue('ok');

    await expect(enableBiometricUnlock()).resolves.toBe('ok');
    expect(isBiometricUnlockEnabled()).toBe(true);
  });

  it('leaves the preference off when the user backs out of the prompt', async () => {
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    promptBiometric.mockResolvedValue('cancelled');

    await expect(enableBiometricUnlock()).resolves.toBe('cancelled');
    expect(isBiometricUnlockEnabled()).toBe(false);
  });

  it('does not even prompt when the device has no biometry', async () => {
    getBiometryInfo.mockResolvedValue(UNAVAILABLE);

    await expect(enableBiometricUnlock()).resolves.toBe('unavailable');
    expect(promptBiometric).not.toHaveBeenCalled();
    expect(isBiometricUnlockEnabled()).toBe(false);
  });

  it('suspends the resume watch around the prompt, and releases it after', async () => {
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    promptBiometric.mockResolvedValue('ok');

    await enableBiometricUnlock();

    // Without this the prompt's own trip through a native activity reads as
    // "the user left the app", and the lock re-arms on top of the unlock.
    expect(suspendAppStateWatch).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('releases the resume watch even when the prompt throws', async () => {
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    promptBiometric.mockRejectedValue(new Error('bridge died'));

    await expect(enableBiometricUnlock()).rejects.toThrow('bridge died');
    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe('disableBiometricUnlock', () => {
  it('clears the preference AND the stored credential', async () => {
    await turnOn();
    expect(isBiometricUnlockEnabled()).toBe(true);

    await disableBiometricUnlock();

    // A switch labelled "biometric unlock" that left a password behind in the
    // Keystore would be lying about what it did.
    expect(isBiometricUnlockEnabled()).toBe(false);
    expect(clearBiometricCredential).toHaveBeenCalledTimes(1);
  });
});

describe('passesLaunchGate', () => {
  it('waves the session through when the feature is off, without asking anything', async () => {
    await expect(passesLaunchGate()).resolves.toBe(true);
    expect(getBiometryInfo).not.toHaveBeenCalled();
    expect(promptBiometric).not.toHaveBeenCalled();
  });

  it('asks for a fingerprint when the feature is on', async () => {
    await turnOn();
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    promptBiometric.mockResolvedValue('ok');

    await expect(passesLaunchGate()).resolves.toBe(true);
    expect(promptBiometric).toHaveBeenCalledTimes(1);
  });

  it('refuses the session when the user does not unlock', async () => {
    await turnOn();
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    promptBiometric.mockResolvedValue('cancelled');

    await expect(passesLaunchGate()).resolves.toBe(false);
  });

  it('asks only once per run, however many times it is called', async () => {
    await turnOn();
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    promptBiometric.mockResolvedValue('ok');

    await passesLaunchGate();
    await passesLaunchGate();

    expect(promptBiometric).toHaveBeenCalledTimes(1);
  });

  it('asks again after the app has re-locked', async () => {
    await turnOn();
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    promptBiometric.mockResolvedValue('ok');

    await passesLaunchGate();
    relock();
    await passesLaunchGate();

    expect(promptBiometric).toHaveBeenCalledTimes(2);
  });

  it('fails OPEN when biometry has gone away since the user turned it on', async () => {
    await turnOn();
    getBiometryInfo.mockResolvedValue(UNAVAILABLE);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // The alternative is locking someone out of a valid session because they
    // deleted the fingerprint they enrolled with — for a gate that was never
    // the thing protecting the tokens. See the module header.
    await expect(passesLaunchGate()).resolves.toBe(true);
    expect(promptBiometric).not.toHaveBeenCalled();
  });
});

describe('unlockWithBiometrics', () => {
  it('passes the outcome straight through', async () => {
    promptBiometric.mockResolvedValue('lockedOut');

    await expect(unlockWithBiometrics()).resolves.toBe('lockedOut');
  });

  it('satisfies the launch gate for the rest of the run once it succeeds', async () => {
    await turnOn();
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    promptBiometric.mockResolvedValue('ok');

    // This is the sign-in-screen button's path: the user cancelled the launch
    // gate, landed on /login, and unlocked from there. The gate must not ask a
    // second time on the way in.
    await unlockWithBiometrics();
    await expect(passesLaunchGate()).resolves.toBe(true);
    expect(promptBiometric).toHaveBeenCalledTimes(1);
  });
});

describe('biometricSignInStatus', () => {
  it('offers nothing at all when the device cannot ask', async () => {
    getBiometryInfo.mockResolvedValue(UNAVAILABLE);
    canAttemptSession.mockResolvedValue(true);

    // A button leading to "biometrics unavailable" is worse than no button, and
    // a checkbox promising a way in that will not work is worse still.
    await expect(biometricSignInStatus()).resolves.toMatchObject({
      offer: false,
      canOptIn: false,
    });
  });

  it('offers the OPT-IN on a fresh install: biometry works, nothing saved yet', async () => {
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    canAttemptSession.mockResolvedValue(false);

    await expect(biometricSignInStatus()).resolves.toMatchObject({
      offer: false,
      canOptIn: true,
      identifier: null,
    });
  });

  it('offers the BUTTON once a credential is stored, and names the account', async () => {
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    canAttemptSession.mockResolvedValue(false);
    readBiometricCredential.mockResolvedValue(CREDENTIAL);

    // No stored session — this is the state after an explicit sign-out, and it
    // is exactly the case the credential exists to cover.
    await expect(biometricSignInStatus()).resolves.toMatchObject({
      offer: true,
      canOptIn: false,
      identifier: CREDENTIAL.identifier,
    });
  });

  it('still offers the button for a gated session with no credential saved', async () => {
    await turnOn();
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    canAttemptSession.mockResolvedValue(true);

    // The launch gate bounced someone off tokens that are sitting right there.
    // The identifier is unknown on this path — a token pair does not say whose
    // it is, and guessing on a shared phone is where that would be worst.
    await expect(biometricSignInStatus()).resolves.toMatchObject({
      offer: true,
      canOptIn: false,
      identifier: null,
    });
  });

  it('falls back to the opt-in once the gated session is gone', async () => {
    await turnOn();
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    canAttemptSession.mockResolvedValue(false);

    await expect(biometricSignInStatus()).resolves.toMatchObject({
      offer: false,
      canOptIn: true,
    });
    await expect(canOfferBiometricSignIn()).resolves.toBe(false);
  });
});

describe('enableBiometricSignIn', () => {
  it('stores the credential once the prompt has succeeded', async () => {
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    promptBiometric.mockResolvedValue('ok');

    await expect(enableBiometricSignIn(CREDENTIAL)).resolves.toBe('ok');
    expect(writeBiometricCredential).toHaveBeenCalledWith(CREDENTIAL);
  });

  it('does NOT arm the launch gate — that is a different promise', async () => {
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    promptBiometric.mockResolvedValue('ok');

    await enableBiometricSignIn(CREDENTIAL);

    // Ticking "next time, sign in with your fingerprint" must not turn the app
    // into one that raises an OS dialog on every cold start. That is the lock,
    // it is asked for in Settings, and someone who got it here would never even
    // reach the sign-in screen the checkbox was talking about.
    expect(isBiometricUnlockEnabled()).toBe(false);
  });

  it('stores nothing when the user backs out of the prompt', async () => {
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    promptBiometric.mockResolvedValue('cancelled');

    await expect(enableBiometricSignIn(CREDENTIAL)).resolves.toBe('cancelled');
    expect(writeBiometricCredential).not.toHaveBeenCalled();
    expect(isBiometricUnlockEnabled()).toBe(false);
  });

  it('does not claim success when the write itself fails', async () => {
    getBiometryInfo.mockResolvedValue(AVAILABLE);
    promptBiometric.mockResolvedValue('ok');
    writeBiometricCredential.mockResolvedValue(false);

    // Reported rather than swallowed: someone asked for a switch to be flipped
    // and it was not, so they need to know it is still off.
    await expect(enableBiometricSignIn(CREDENTIAL)).resolves.toBe('failed');
    expect(isBiometricUnlockEnabled()).toBe(false);
  });

  it('does not prompt at all when the device has no biometry', async () => {
    getBiometryInfo.mockResolvedValue(UNAVAILABLE);

    await expect(enableBiometricSignIn(CREDENTIAL)).resolves.toBe('unavailable');
    expect(promptBiometric).not.toHaveBeenCalled();
  });
});

describe('unlockForSignIn', () => {
  it('hands back the stored credential after a successful prompt', async () => {
    promptBiometric.mockResolvedValue('ok');
    readBiometricCredential.mockResolvedValue(CREDENTIAL);

    await expect(unlockForSignIn()).resolves.toEqual({ ok: true, credential: CREDENTIAL });
  });

  it('hands back a null credential when only a stored session is behind the gate', async () => {
    promptBiometric.mockResolvedValue('ok');

    // The caller reads this as "restore the session you already have" rather
    // than "sign in from scratch".
    await expect(unlockForSignIn()).resolves.toEqual({ ok: true, credential: null });
  });

  it('reports a refusal without touching the credential', async () => {
    promptBiometric.mockResolvedValue('failed');
    readBiometricCredential.mockResolvedValue(CREDENTIAL);

    await expect(unlockForSignIn()).resolves.toEqual({ ok: false, outcome: 'failed' });
    expect(clearBiometricCredential).not.toHaveBeenCalled();
  });

  it('throws the credential away when biometry has gone from the device', async () => {
    promptBiometric.mockResolvedValue('unavailable');
    readBiometricCredential.mockResolvedValue(CREDENTIAL);

    // It can never be released again, so it is dead weight rather than a secret
    // worth keeping around.
    await expect(unlockForSignIn()).resolves.toEqual({ ok: false, outcome: 'unavailable' });
    expect(clearBiometricCredential).toHaveBeenCalledTimes(1);
  });
});
