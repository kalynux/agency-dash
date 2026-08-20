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
const { getBiometryInfo, promptBiometric, canAttemptSession, release, suspendAppStateWatch } =
  vi.hoisted(() => {
    const releaseFn = vi.fn();
    return {
      getBiometryInfo: vi.fn<() => Promise<BiometryInfo>>(),
      promptBiometric: vi.fn<() => Promise<UnlockOutcome>>(),
      canAttemptSession: vi.fn<() => Promise<boolean>>(),
      release: releaseFn,
      suspendAppStateWatch: vi.fn(() => releaseFn),
    };
  });

vi.mock('@/platform/env', () => ({ isNative: true, platform: 'android', useBearerAuth: true }));
vi.mock('@/platform/biometrics', () => ({ getBiometryInfo, promptBiometric }));
vi.mock('@/platform/shell/appState', () => ({ suspendAppStateWatch }));
vi.mock('@/platform/auth/strategy', () => ({ authStrategy: { canAttemptSession } }));
vi.mock('@/i18n', () => ({ default: { t: (key: string) => key } }));

import {
  canOfferBiometricSignIn,
  disableBiometricUnlock,
  enableBiometricUnlock,
  isBiometricUnlockEnabled,
  passesLaunchGate,
  relock,
  resetBiometricUnlockForTests,
  unlockWithBiometrics,
} from './biometricUnlock';

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
  it('clears the preference', async () => {
    await turnOn();
    expect(isBiometricUnlockEnabled()).toBe(true);

    disableBiometricUnlock();

    expect(isBiometricUnlockEnabled()).toBe(false);
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

describe('canOfferBiometricSignIn', () => {
  it('is false when the user never turned the feature on', async () => {
    canAttemptSession.mockResolvedValue(true);
    getBiometryInfo.mockResolvedValue(AVAILABLE);

    await expect(canOfferBiometricSignIn()).resolves.toBe(false);
  });

  it('is false after a sign-out, when there is no stored session left to unlock', async () => {
    await turnOn();
    canAttemptSession.mockResolvedValue(false);
    getBiometryInfo.mockResolvedValue(AVAILABLE);

    // The whole contract of "signing out means the credential leaves the
    // device": the preference survives, the button does not.
    await expect(canOfferBiometricSignIn()).resolves.toBe(false);
  });

  it('is false when the device can no longer ask', async () => {
    await turnOn();
    canAttemptSession.mockResolvedValue(true);
    getBiometryInfo.mockResolvedValue(UNAVAILABLE);

    await expect(canOfferBiometricSignIn()).resolves.toBe(false);
  });

  it('is true with a stored session, an enrolled finger and the preference on', async () => {
    await turnOn();
    canAttemptSession.mockResolvedValue(true);
    getBiometryInfo.mockResolvedValue(AVAILABLE);

    await expect(canOfferBiometricSignIn()).resolves.toBe(true);
  });
});
