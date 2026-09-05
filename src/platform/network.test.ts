/**
 * @vitest-environment jsdom
 *
 * Connectivity (CAPACITOR-PLAN.md → P3.4).
 *
 * The browser half is the one that is testable without a device, and it is also
 * the half that ships to web today — so what is under test here is that the
 * store only notifies on real changes, and that "the network came back" is an
 * *edge* rather than a level. Getting that second one wrong is invisible until a
 * live-tracking socket reconnects on every status tick.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('./env', () => ({ isNative: false, platform: 'web', useBearerAuth: false }));
vi.mock('@capacitor/network', () => ({ Network: { addListener: vi.fn(), getStatus: vi.fn() } }));

import {
  getNetworkState,
  subscribeNetwork,
  subscribeNetworkRestored,
  __resetNetworkForTests,
} from './network';

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

describe('network store (browser transport)', () => {
  beforeEach(() => {
    __resetNetworkForTests();
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    __resetNetworkForTests();
  });

  it('seeds from navigator.onLine on first read', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    expect(getNetworkState().connected).toBe(false);
  });

  it('follows the online/offline events', () => {
    const seen: boolean[] = [];
    subscribeNetwork((s) => seen.push(s.connected));

    setOnline(false);
    setOnline(true);

    expect(seen).toEqual([false, true]);
  });

  it('does not notify when nothing changed', () => {
    const listener = vi.fn();
    subscribeNetwork(listener);

    // Already online; the event carries no new information.
    setOnline(true);

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const off = subscribeNetwork(listener);
    off();

    setOnline(false);

    expect(listener).not.toHaveBeenCalled();
  });

  it('fires "restored" only on the offline → online edge', () => {
    const restored = vi.fn();
    subscribeNetworkRestored(restored);

    setOnline(false);
    expect(restored).not.toHaveBeenCalled();

    setOnline(true);
    expect(restored).toHaveBeenCalledTimes(1);

    // A second, redundant "online" must not look like a second recovery.
    setOnline(true);
    expect(restored).toHaveBeenCalledTimes(1);

    setOnline(false);
    setOnline(true);
    expect(restored).toHaveBeenCalledTimes(2);
  });

  it('does not fire "restored" for a subscriber that starts online', () => {
    const restored = vi.fn();
    subscribeNetworkRestored(restored);
    expect(restored).not.toHaveBeenCalled();
  });

  it('returns an identical snapshot while nothing changes', () => {
    // useSyncExternalStore compares snapshots by identity — a fresh object per
    // read would re-render every subscriber on every commit.
    expect(getNetworkState()).toBe(getNetworkState());
  });
});
