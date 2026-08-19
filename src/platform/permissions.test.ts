/**
 * Permission outcomes (CAPACITOR-PLAN.md → P4.3, P4.4).
 *
 * One function, and the whole reason it exists is that Capacitor reports "no,
 * and don't ask again" and "no, this time" with the same string. Getting the
 * distinction backwards produces either a retry button that can never work, or
 * a trip to system settings for a user who only had to tap Allow.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('./env', () => ({ isNative: false, platform: 'web', useBearerAuth: false }));
vi.mock('capacitor-native-settings', () => ({
  NativeSettings: { open: vi.fn() },
  AndroidSettings: { ApplicationDetails: 'application_details' },
  IOSSettings: { App: 'app' },
}));

import { toOutcome } from './permissions';

describe('toOutcome', () => {
  it('grants when the request was granted', () => {
    expect(toOutcome('prompt', 'granted')).toBe('granted');
    expect(toOutcome('denied', 'granted')).toBe('granted');
  });

  it("treats iOS's limited photo access as a grant", () => {
    // The user chose which photos we may see. That is a yes, not a partial no.
    expect(toOutcome('prompt', 'limited')).toBe('granted');
  });

  it('reports a fresh refusal as denied, not blocked', () => {
    // The OS prompted and the user said no. Asking again is legitimate.
    expect(toOutcome('prompt', 'denied')).toBe('denied');
    expect(toOutcome('prompt-with-rationale', 'denied')).toBe('denied');
  });

  it('reports an already-denied permission as blocked', () => {
    // Nothing was shown — Android does not prompt twice — so the only route
    // back is the settings screen. This is the case the whole function is for.
    expect(toOutcome('denied', 'denied')).toBe('blocked');
  });

  it('does not call a still-promptable permission blocked', () => {
    // A request that somehow came back still-promptable is not a refusal for
    // good; sending the user to system settings here would be a dead end for a
    // permission they were never asked about.
    expect(toOutcome('prompt', 'prompt')).toBe('denied');
    expect(toOutcome('prompt-with-rationale', 'prompt-with-rationale')).toBe('denied');
  });
});
