/**
 * "The user came back to the app" — and how long they were gone.
 *
 * `@capacitor/app`'s `appStateChange` reports the transition but not the
 * duration, and duration is the whole question for anything that re-arms on
 * return: locking the app after a two-second glance at a notification is
 * hostile, locking it after twenty minutes in someone else's hand is the point.
 *
 * Inert on the web, where a packaged app's notion of "backgrounded" has no
 * equivalent — `visibilitychange` fires on tab switches, which is a different
 * and much noisier event, and the web build has no lock to re-arm anyway.
 */
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { isNative } from '../env';

/**
 * How long the watch stays deaf after {@link suspendAppStateWatch} is released.
 *
 * The releasing caller is typically a native dialog that has just closed, and
 * `appStateChange(true)` for its dismissal lands *after* the promise that
 * dismissed it resolves. Re-arming synchronously would let that trailing event
 * through and, in the case of the unlock prompt, immediately re-lock the app
 * the user just unlocked.
 */
const SETTLE_MS = 1000;

type ResumeHandler = (awayMs: number) => void;

const handlers = new Set<ResumeHandler>();

/** Epoch ms of the moment the app went to the background; null while active. */
let awaySince: number | null = null;

/** Outstanding {@link suspendAppStateWatch} holds. Nested calls are fine. */
let suspensions = 0;

/**
 * The in-flight (or settled) native registration.
 *
 * The *promise* is the handle we keep, not the resolved listener: `addListener`
 * is async, and the last subscriber can perfectly well unsubscribe before it
 * comes back — a component that mounts and unmounts in the same tick, which
 * StrictMode does to every effect in development. Holding only the resolved
 * value would leave that registration alive with nobody left to deliver to.
 */
let listening: Promise<PluginListenerHandle | null> | null = null;

function onStateChange(isActive: boolean): void {
  if (!isActive) {
    // Only the FIRST background wins: Android can emit a pause/resume pair for
    // a permission dialog inside an already-backgrounded stretch, and taking
    // the later timestamp would reset the clock the user was away on.
    if (suspensions === 0 && awaySince === null) awaySince = Date.now();
    return;
  }

  const since = awaySince;
  awaySince = null;
  if (suspensions > 0 || since === null) return;

  const awayMs = Date.now() - since;
  for (const handler of handlers) {
    try {
      handler(awayMs);
    } catch (err) {
      console.error('[appState] a resume handler threw', err);
    }
  }
}

/**
 * Stop reacting to background/foreground transitions until the returned
 * function is called.
 *
 * For the stretches where *we* sent the user out of the app — a biometric
 * prompt, a system settings screen, a photo picker — and the round trip must
 * not read as "they left and came back".
 */
export function suspendAppStateWatch(): () => void {
  suspensions += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    // Drop the recorded departure first: whatever happened during the
    // suspension is by definition not an absence we care about.
    awaySince = null;
    setTimeout(() => {
      suspensions = Math.max(0, suspensions - 1);
      awaySince = null;
    }, SETTLE_MS);
  };
}

/**
 * Call `handler` each time the app returns to the foreground, with how long it
 * was away in milliseconds. Returns an unsubscribe function.
 *
 * A no-op off native — the handler simply never fires.
 */
export function onAppResume(handler: ResumeHandler): () => void {
  if (!isNative) return () => {};

  handlers.add(handler);

  // One native listener for the whole app, attached lazily on the first
  // subscriber. Registering per-subscriber would fan the same event out through
  // N native bridges for no gain.
  listening ??= App.addListener('appStateChange', ({ isActive }) =>
    onStateChange(isActive),
  ).catch((err) => {
    console.error('[appState] could not observe app state', err);
    return null;
  });

  return () => {
    handlers.delete(handler);
    if (handlers.size > 0) return;

    const pending = listening;
    listening = null;
    // Chained rather than read: see the note on `listening`. If the
    // registration is still in flight, this removes it the moment it lands.
    void pending?.then((handle) => handle?.remove()).catch(() => {});
  };
}

/** Test seam: forget every handler and the recorded absence. */
export function resetAppStateWatchForTests(): void {
  handlers.clear();
  awaySince = null;
  suspensions = 0;
  listening = null;
}
