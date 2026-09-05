/**
 * Connectivity (CAPACITOR-PLAN.md → P3.4).
 *
 * One source of truth for "is this device on the network?", so the sidebar
 * status dot, the offline banner and the live-tracking socket all agree instead
 * of each asking a different oracle.
 *
 * Native reads `@capacitor/network`, which reflects the OS's own connectivity
 * manager — airplane mode, a dropped cell, a Wi-Fi network that vanished. The
 * browser falls back to `navigator.onLine` plus its `online`/`offline` events,
 * which is what the placeholder in `PlatformStatus` always said it would use.
 *
 * **`navigator.onLine` answers a narrower question than it looks like it does.**
 * It reports whether the machine has *a* network interface up, not whether the
 * internet is reachable: a laptop on a captive-portal Wi-Fi is "online" and can
 * reach nothing. So it is honest about the case the exit criteria name (airplane
 * mode) and optimistic about a broken uplink. Treat `connected === false` as
 * proof of offline and `connected === true` as an absence of proof — which is
 * why nothing here signs anyone out or cancels a request.
 *
 * Like every module under `src/platform/`, this one falls back to today's
 * browser behaviour when `isNative` is false (ground rule 3).
 */
import { Network } from '@capacitor/network';
import { useSyncExternalStore } from 'react';
import { isNative } from './env';

export interface NetworkState {
  /** The device believes it has a network. See the caveat above. */
  connected: boolean;
  /**
   * `'wifi' | 'cellular' | 'none' | 'unknown'` on native. Always `'unknown'` in
   * a browser, which has no equivalent that is safe to trust (`navigator
   * .connection` is unshipped on Safari and lies behind privacy heuristics on
   * the rest).
   */
  connectionType: string;
}

type Listener = (state: NetworkState) => void;

/**
 * The cached snapshot.
 *
 * `useSyncExternalStore` compares snapshots by identity, so this object is
 * replaced only when a value actually changes — returning a fresh object on
 * every read would re-render every subscriber on every tick.
 */
let state: NetworkState = { connected: true, connectionType: 'unknown' };

const listeners = new Set<Listener>();
let installed = false;

function publish(next: NetworkState): void {
  if (next.connected === state.connected && next.connectionType === state.connectionType) return;
  state = next;
  for (const listener of listeners) listener(state);
}

/**
 * Attach to the platform's connectivity source, once per app lifetime.
 *
 * Deliberately never torn down. The listener costs nothing while idle, and
 * ref-counting it would mean StrictMode's double-mount detaches and re-attaches
 * on every subscriber — during which a change would be missed.
 */
function install(): void {
  if (installed) return;
  installed = true;

  if (isNative) {
    void Network.addListener('networkStatusChange', (status) => {
      publish({ connected: status.connected, connectionType: status.connectionType });
    });
    // The listener only fires on *changes*, so the current state has to be
    // asked for separately. Until it answers we assume connected — an app that
    // flashes "offline" on every launch teaches people to ignore the banner.
    void Network.getStatus().then((status) => {
      publish({ connected: status.connected, connectionType: status.connectionType });
    });
    return;
  }

  if (typeof window === 'undefined') return;
  const sync = () => publish({ connected: navigator.onLine, connectionType: 'unknown' });
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  sync();
}

/** Subscribe to connectivity changes. Returns the unsubscribe. */
export function subscribeNetwork(listener: Listener): () => void {
  install();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The last known connectivity state. Synchronous and safe before the first change. */
export function getNetworkState(): NetworkState {
  install();
  return state;
}

/** React binding. Re-renders only when the state actually changes. */
export function useNetworkState(): NetworkState {
  return useSyncExternalStore(subscribeNetwork, getNetworkState, getNetworkState);
}

/** Convenience for the common case. */
export function useIsOnline(): boolean {
  return useNetworkState().connected;
}

/**
 * Run `onRestored` when connectivity returns, and only then.
 *
 * The transition is what callers care about — a socket wants to stop waiting out
 * its backoff the moment there is a network again, and would learn nothing from
 * being told it is still online. Subscribing to the state and diffing it in each
 * consumer is the same three lines written five times, with five chances to fire
 * on the wrong edge.
 */
export function subscribeNetworkRestored(onRestored: () => void): () => void {
  let wasConnected = getNetworkState().connected;
  return subscribeNetwork(({ connected }) => {
    const restored = connected && !wasConnected;
    wasConnected = connected;
    if (restored) onRestored();
  });
}

/** Test seam. Not part of the app's surface. */
export function __resetNetworkForTests(): void {
  listeners.clear();
  installed = false;
  state = { connected: true, connectionType: 'unknown' };
}
