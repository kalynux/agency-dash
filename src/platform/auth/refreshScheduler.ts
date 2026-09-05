/**
 * Proactive token refresh (CAPACITOR-PLAN.md → P2.5).
 *
 * Access tokens live 900s. Waiting for a 401 to notice means every session shows
 * the user a stalled screen once every fifteen minutes while the retry unwinds.
 * This module refreshes a minute before the deadline instead, so the 401 path in
 * `api.ts` becomes the fallback it was always meant to be.
 *
 * **It also owns the single-flight lock**, which is why {@link refreshSession}
 * lives here rather than in `api.ts`. Two independent locks would mean a resume
 * and a request can each start a refresh; the second one lands with a refresh
 * token the first has already rotated away, and the user is signed out for
 * reasons nothing in the logs explains. One lock, both callers.
 *
 * On the cookie transport the whole timer half is inert — the no-op token store
 * has no expiry to schedule against — so the web build keeps exactly the
 * reactive behaviour Phase 1 shipped. Only the lock is shared, and around a call
 * `api.ts` was already making one at a time.
 */
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { ApiError } from '@/types/api';
import { authStrategy } from './strategy';
import { tokenStore } from './tokenStore';
import { isNative } from '../env';

/**
 * How far ahead of expiry to refresh.
 *
 * Wide enough to cover a slow mobile round trip and a little clock skew; narrow
 * enough that the refresh rate stays ~1 per 14 minutes per active user, well
 * inside the 300/min/IP session bucket.
 */
const SKEW_MS = 60_000;

/** `setTimeout` truncates anything past this to a 32-bit int and fires immediately. */
const MAX_TIMEOUT_MS = 2_147_483_647;

/** Backoff for a refresh that failed on the network rather than on an answer. */
const NETWORK_RETRY_MS = 30_000;

/** Fallback when a 429 carries no `Retry-After` — the buckets are per-minute. */
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 60_000;

/**
 * The floor between two *scheduled* refreshes, and the one thing standing
 * between this module and a hot loop against the auth service.
 *
 * The loop is easy to fall into: refresh, re-arm from the new deadline, find
 * that deadline already in the past, refresh again. A fresh token normally makes
 * that impossible — but not if the device clock runs more than SKEW ahead of the
 * server's, which is exactly the case nobody can reproduce and everybody's phone
 * eventually hits. In healthy operation refreshes are ~14 minutes apart, so this
 * only ever engages when something is already wrong.
 */
const MIN_REFRESH_INTERVAL_MS = 30_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
let started = false;
let appStateListener: PluginListenerHandle | null = null;
let lastScheduledRefreshAt = 0;

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

// ─── The shared lock ──────────────────────────────────────────────────────────

/**
 * Refresh the session, coalescing concurrent callers onto one network call.
 *
 * Both the timer below and the 401 path in `api.ts` come through here. The
 * promise is shared, so the second caller waits on the first's result rather
 * than starting a refresh with a token that is about to be rotated.
 *
 * Throws whatever the strategy threw — the caller decides what a failure means.
 * `api.ts` signs out on a terminal code; the timer, deliberately, does not.
 */
export function refreshSession(): Promise<void> {
  return (inFlight ??= (async () => {
    try {
      await authStrategy.refresh();
      // Re-arm from the NEW deadline. Without this the timer stays pointed at
      // the old expiry, which has already passed, and every subsequent tick
      // fires instantly against a perfectly fresh token.
      if (started) void scheduleNext();
    } finally {
      inFlight = null;
    }
  })());
}

// ─── The timer ────────────────────────────────────────────────────────────────

function arm(delayMs: number): void {
  clearTimer();
  timer = setTimeout(() => {
    timer = null;
    void tick();
  }, Math.min(Math.max(delayMs, 0), MAX_TIMEOUT_MS));
}

/**
 * Work out when the next refresh is due and arm the timer.
 *
 * No tokens means no session — on the cookie transport that is *always* true, so
 * this returns without arming anything and the web build never grows a timer.
 */
async function scheduleNext(): Promise<void> {
  clearTimer();
  if (!started) return;

  const tokens = await tokenStore.get();
  if (!tokens) return;

  arm(tokens.accessExpiresAt - SKEW_MS - Date.now());
}

async function tick(): Promise<void> {
  if (!started) return;

  const tokens = await tokenStore.get();
  // Signed out while we waited. Nothing to refresh, nothing to re-arm.
  if (!tokens) return;

  const dueAt = tokens.accessExpiresAt - SKEW_MS;
  if (Date.now() < dueAt) {
    // Not actually due: either the MAX_TIMEOUT_MS clamp fired early, or a
    // refresh landed while we were waiting and pushed the deadline out.
    arm(dueAt - Date.now());
    return;
  }

  await runScheduledRefresh();
}

/**
 * A refresh the *user did not ask for*, which is what makes its failure handling
 * different from the 401 path's.
 *
 * A proactive refresh must never sign anyone out. The two ways it fails are a
 * dead network — extremely ordinary on a phone, and no statement about the
 * session — and a real refusal from the server. Only the second is a verdict,
 * and `api.ts` already delivers that verdict correctly the moment the user
 * actually does something. Acting on it here would mean a tunnel or a lift
 * logging people out.
 */
async function runScheduledRefresh(): Promise<void> {
  const sinceLast = Date.now() - lastScheduledRefreshAt;
  if (sinceLast < MIN_REFRESH_INTERVAL_MS) {
    // Due again already, having just refreshed. Something is wrong with the
    // arithmetic rather than with the session — most likely a device clock ahead
    // of the server's. Keep the timer alive but throttled, so the app recovers
    // on its own if the clock is corrected, without spending a request a
    // millisecond in the meantime.
    arm(MIN_REFRESH_INTERVAL_MS - sinceLast);
    return;
  }
  lastScheduledRefreshAt = Date.now();

  try {
    await refreshSession();
    // Success re-arms inside refreshSession(), from the new deadline.
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.isRateLimited) {
        // The session is fine, the ceiling is not. Wait it out and try again —
        // retrying sooner would feed the bucket that is already full.
        arm(
          err.retryAfterSeconds != null
            ? err.retryAfterSeconds * 1000
            : DEFAULT_RATE_LIMIT_BACKOFF_MS,
        );
        return;
      }
      // A real refusal (invalid refresh token, expired session, password
      // changed). Stop the timer and leave it to the reactive path: the next
      // request the user makes gets the same answer and signs out cleanly, with
      // the cause attached to the `auth:logout` event. Retrying on a schedule
      // would just hammer an endpoint that has made its decision.
      clearTimer();
      return;
    }

    // Not an ApiError — the request never reached the server. Try again shortly;
    // the access token may still be valid for the rest of SKEW_MS.
    console.warn('[auth] scheduled refresh could not reach the server; retrying', err);
    arm(NETWORK_RETRY_MS);
  }
}

// ─── Resume ───────────────────────────────────────────────────────────────────

/**
 * Re-check on resume, and re-arm unconditionally.
 *
 * Background timers are not a contract: Android freezes them under Doze and iOS
 * suspends the whole WebView, so a timer armed for 14 minutes can come back
 * hours late or not at all. The remaining time on a pending timer is therefore
 * untrustworthy after a suspension — which is why this re-arms even when the
 * token is nowhere near expiry, rather than only when it is.
 */
async function onResume(): Promise<void> {
  if (!started) return;

  const tokens = await tokenStore.get();
  if (!tokens) return;

  if (Date.now() >= tokens.accessExpiresAt - SKEW_MS) {
    await runScheduledRefresh();
  } else {
    await scheduleNext();
  }
}

function installResumeListener(): void {
  if (isNative) {
    // Returns a promise for the handle; nothing awaits it because stop() is the
    // only consumer and an app that stops before the listener has registered has
    // nothing to remove.
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void onResume();
    }).then((handle) => {
      appStateListener = handle;
    });
    return;
  }

  // The browser analogue, so the VITE_FORCE_MOBILE_AUTH path behaves the same
  // way when a laptop wakes from sleep or a background tab is returned to.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') void onResume();
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Start (or re-arm) the scheduler.
 *
 * Idempotent and safe to call on every session change — `captureSession()` in
 * `auth.service.ts` calls it after login, register and auth-me, which is exactly
 * the set of moments a new deadline exists. Calling it with an empty token store
 * simply arms nothing.
 */
export function startRefreshScheduler(): void {
  if (!started) {
    started = true;
    installResumeListener();
    // The single exit both transports already share. Logout must cancel the
    // timer, or a signed-out app keeps calling refresh until it is closed.
    window.addEventListener('auth:logout', stopRefreshScheduler);
  }
  void scheduleNext();
}

/** Cancel everything. Called on `auth:logout`, and directly on an explicit sign-out. */
export function stopRefreshScheduler(): void {
  started = false;
  clearTimer();
  window.removeEventListener('auth:logout', stopRefreshScheduler);
  if (appStateListener) {
    void appStateListener.remove();
    appStateListener = null;
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }
}

/** Test seam. Not part of the app's surface. */
export function __resetRefreshSchedulerForTests(): void {
  stopRefreshScheduler();
  inFlight = null;
  lastScheduledRefreshAt = 0;
}
