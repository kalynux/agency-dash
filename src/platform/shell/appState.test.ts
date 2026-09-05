/**
 * The resume watch that the biometric app lock is built on.
 *
 * Everything worth testing here is a timing rule that is invisible on a device
 * until it misfires: a lock that re-arms after a two-second glance at a
 * notification, or one that never arms at all because a native dialog reset the
 * clock. Both are cheap to get wrong and expensive to notice.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../env', () => ({ isNative: true, platform: 'android', useBearerAuth: true }));

/** The handler the module hands to Capacitor, captured at registration. */
let nativeHandler: ((event: { isActive: boolean }) => void) | null = null;
const remove = vi.fn();

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn((_event: string, handler: (e: { isActive: boolean }) => void) => {
      // Recorded synchronously, before the returned promise settles, so a test
      // can drive the module without awaiting the bridge.
      nativeHandler = handler;
      return Promise.resolve({ remove });
    }),
  },
}));

import { onAppResume, resetAppStateWatchForTests, suspendAppStateWatch } from './appState';

/** Send the app to the background, wait `awayMs`, bring it back. */
function goAway(awayMs: number): void {
  nativeHandler?.({ isActive: false });
  vi.advanceTimersByTime(awayMs);
  nativeHandler?.({ isActive: true });
}

describe('onAppResume', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T09:00:00Z'));
    nativeHandler = null;
    remove.mockClear();
    resetAppStateWatchForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports how long the app was away', () => {
    const seen: number[] = [];
    onAppResume((awayMs) => seen.push(awayMs));

    goAway(30_000);

    expect(seen).toEqual([30_000]);
  });

  it('does not fire on a foreground event that follows no background one', () => {
    const seen: number[] = [];
    onAppResume((awayMs) => seen.push(awayMs));

    // Android emits this on a cold start, before anything has been away.
    nativeHandler?.({ isActive: true });

    expect(seen).toEqual([]);
  });

  it('keeps the first departure when several background events arrive', () => {
    const seen: number[] = [];
    onAppResume((awayMs) => seen.push(awayMs));

    nativeHandler?.({ isActive: false });
    vi.advanceTimersByTime(60_000);
    // A second pause mid-absence — a permission dialog, say. Taking its
    // timestamp would report a one-minute absence as a zero-length one.
    nativeHandler?.({ isActive: false });
    vi.advanceTimersByTime(5_000);
    nativeHandler?.({ isActive: true });

    expect(seen).toEqual([65_000]);
  });

  it('fans one native event out to every subscriber', () => {
    const a = vi.fn();
    const b = vi.fn();
    onAppResume(a);
    onAppResume(b);

    goAway(10_000);

    expect(a).toHaveBeenCalledWith(10_000);
    expect(b).toHaveBeenCalledWith(10_000);
  });

  it('stops calling a handler once it unsubscribes', async () => {
    const handler = vi.fn();
    const off = onAppResume(handler);

    off();
    goAway(10_000);

    expect(handler).not.toHaveBeenCalled();
    // Detached from the bridge too, and specifically when the unsubscribe beat
    // the registration promise home — which is what StrictMode's
    // mount/unmount/mount does to this effect on every dev render.
    await vi.runAllTimersAsync();
    expect(remove).toHaveBeenCalled();
  });

  it('survives a handler that throws, and still calls the others', () => {
    const thrower = vi.fn(() => {
      throw new Error('boom');
    });
    const after = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    onAppResume(thrower);
    onAppResume(after);

    expect(() => goAway(10_000)).not.toThrow();
    expect(after).toHaveBeenCalledWith(10_000);
  });
});

describe('suspendAppStateWatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T09:00:00Z'));
    nativeHandler = null;
    remove.mockClear();
    resetAppStateWatchForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('swallows the round trip through an excursion we started ourselves', () => {
    const handler = vi.fn();
    onAppResume(handler);

    const release = suspendAppStateWatch();
    // The biometric prompt / camera / gallery activity.
    goAway(90_000);
    release();

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores the trailing foreground event that lands after the release', () => {
    const handler = vi.fn();
    onAppResume(handler);

    const release = suspendAppStateWatch();
    nativeHandler?.({ isActive: false });
    vi.advanceTimersByTime(90_000);
    // Release runs when the plugin's promise resolves — Capacitor's own
    // `appStateChange(true)` for the same dismissal arrives a beat later. This
    // is the event that would otherwise re-lock an app the user just unlocked.
    release();
    vi.advanceTimersByTime(200);
    nativeHandler?.({ isActive: true });

    expect(handler).not.toHaveBeenCalled();
  });

  it('watches again once the settle window has passed', () => {
    const handler = vi.fn();
    onAppResume(handler);

    suspendAppStateWatch()();
    vi.advanceTimersByTime(2_000);

    goAway(45_000);

    expect(handler).toHaveBeenCalledWith(45_000);
  });

  it('stays suspended until the last of several holds is released', () => {
    const handler = vi.fn();
    onAppResume(handler);

    const releaseOuter = suspendAppStateWatch();
    const releaseInner = suspendAppStateWatch();

    releaseInner();
    vi.advanceTimersByTime(2_000);
    goAway(45_000);
    expect(handler).not.toHaveBeenCalled();

    releaseOuter();
    vi.advanceTimersByTime(2_000);
    goAway(45_000);
    expect(handler).toHaveBeenCalledWith(45_000);
  });

  it('is idempotent — releasing twice does not decrement someone else’s hold', () => {
    const handler = vi.fn();
    onAppResume(handler);

    const releaseOuter = suspendAppStateWatch();
    const releaseInner = suspendAppStateWatch();

    releaseInner();
    releaseInner();
    vi.advanceTimersByTime(2_000);

    goAway(45_000);

    expect(handler).not.toHaveBeenCalled();
    releaseOuter();
  });
});
