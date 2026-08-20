/**
 * Push notifications (CAPACITOR-PLAN.md → P4.1).
 *
 * A native provider installed into the **existing** `window.wiMallGetPushToken`
 * seam that `usePushRegistration` already consumes — the same seam `lib/push.ts`
 * fills with Firebase Web on the browser build. One consumer, two providers,
 * selected by platform.
 *
 * ⚠ The plan said "no hook changes", and that turned out to be half true. The
 * *token* half needs none: the seam already exists and native simply fills it.
 * The rest of what the hook does is browser-only and cannot survive on a device —
 *
 *   - `'Notification' in window` is **false** in an Android WebView. The
 *     Notifications API is a browser API and is not implemented there, so the
 *     unmodified hook reports `'unsupported'` and the settings screen offers no
 *     way to turn push on at all.
 *   - `Notification.permission` / `requestPermission()` likewise do not exist;
 *     Android 13+ has its own POST_NOTIFICATIONS runtime grant.
 *   - `platform: 'web'` is hardcoded at the registration call (D5 wants
 *     `'android' | 'ios'`).
 *   - the token is cached in `localStorage`, which the plan explicitly moves.
 *
 * So this module exports the four things the hook cannot ask a browser for —
 * support, permission, device platform, token cache — each falling back to
 * exactly today's browser behaviour when `isNative` is false (ground rule 3).
 * The web build's code path is unchanged down to the `localStorage` key.
 */
import { PushNotifications } from '@capacitor/push-notifications';
import type { PluginListenerHandle } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { isNative, platform } from './env';
import type { DevicePlatform } from '@/types/notification.types';

/**
 * Normalised permission state.
 *
 * Capacitor answers `'prompt' | 'prompt-with-rationale' | 'granted' | 'denied'`
 * and the browser answers `'default' | 'granted' | 'denied'`; both collapse to
 * these three, because the only question a caller ever has is "can I ask?".
 */
export type PushPermission = 'granted' | 'denied' | 'prompt';

/**
 * How long to wait for FCM to hand back a token before giving up.
 *
 * `register()` resolves as soon as the *request* is made — the token arrives
 * later on the `registration` event, or never: a device with no Play Services,
 * no network, or a missing `google-services.json` simply stays silent. Without a
 * deadline the settings screen spins forever on a case that is not rare.
 */
const TOKEN_TIMEOUT_MS = 15_000;

/** Secure-storage entry for the device token. Distinct from `auth-tokens`. */
const NATIVE_TOKEN_KEY = 'push-token';

/** The browser cache key, unchanged from the one the hook used before. */
const WEB_TOKEN_KEY = 'agency:pushToken';

/**
 * The `platform` value `POST /agency/devices` is told (D5).
 *
 * The backend accepts `'web' | 'android' | 'ios'`, and it is not cosmetic: it
 * picks which credential the sender signs with. A device registered as `'web'`
 * takes a web-push payload and delivers nothing.
 */
export const devicePlatform: DevicePlatform = platform;

/**
 * Whether this runtime can do push at all.
 *
 * On native the answer is yes by construction — the plugin is linked into the
 * binary. On web it is the Notifications API test the hook used to make inline.
 */
export const pushSupported = isNative || (typeof window !== 'undefined' && 'Notification' in window);

// ─── Permission ───────────────────────────────────────────────────────────────

function fromCapacitor(state: string): PushPermission {
  if (state === 'granted') return 'granted';
  if (state === 'denied') return 'denied';
  // 'prompt' and 'prompt-with-rationale' both mean "we may ask".
  return 'prompt';
}

function fromBrowser(state: NotificationPermission): PushPermission {
  return state === 'default' ? 'prompt' : state;
}

/** Current permission, without prompting. */
export async function getPushPermission(): Promise<PushPermission> {
  if (!pushSupported) return 'denied';
  if (isNative) {
    try {
      return fromCapacitor((await PushNotifications.checkPermissions()).receive);
    } catch (err) {
      console.error('[push] could not read notification permission', err);
      return 'denied';
    }
  }
  return fromBrowser(Notification.permission);
}

/**
 * Prompt for permission. Only ever called from the settings toggle — never at
 * startup, where a permission sheet before the user has seen the app is the
 * single most reliable way to get "Don't allow".
 */
export async function requestPushPermission(): Promise<PushPermission> {
  if (!pushSupported) return 'denied';
  if (isNative) {
    try {
      return fromCapacitor((await PushNotifications.requestPermissions()).receive);
    } catch (err) {
      console.error('[push] permission request failed', err);
      return 'denied';
    }
  }
  // Already-granted short-circuits: calling requestPermission() again is legal
  // but returns without a user gesture in some browsers.
  if (Notification.permission === 'granted') return 'granted';
  return fromBrowser(await Notification.requestPermission());
}

// ─── Token cache ──────────────────────────────────────────────────────────────
//
// Native goes to the Keystore/Keychain rather than `localStorage`. A push token
// is not a credential the way a refresh token is — it authorises delivery *to*
// this device, not action *as* this user — but it is a durable device
// identifier, WebView `localStorage` is world-readable on a rooted device, and
// the secure store is already linked and configured. There is no reason to
// reach for a weaker option for the sake of it.

/** The device token last registered with the backend, or null. */
export async function readCachedPushToken(): Promise<string | null> {
  if (isNative) {
    try {
      const value = await SecureStorage.getItem(NATIVE_TOKEN_KEY);
      return typeof value === 'string' && value.length > 0 ? value : null;
    } catch (err) {
      console.error('[push] could not read the cached token', err);
      return null;
    }
  }
  try {
    return localStorage.getItem(WEB_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function cachePushToken(token: string): Promise<void> {
  if (isNative) {
    try {
      await SecureStorage.setItem(NATIVE_TOKEN_KEY, token);
    } catch (err) {
      // Swallowed like the auth store's write, and for the same reason: the
      // device IS registered server-side at this point. Failing here would
      // report a working registration as broken. The cost is that the next
      // launch cannot prove it registered and offers to do it again.
      console.error('[push] could not persist the token', err);
    }
    return;
  }
  try {
    localStorage.setItem(WEB_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export async function clearCachedPushToken(): Promise<void> {
  if (isNative) {
    try {
      await SecureStorage.remove(NATIVE_TOKEN_KEY);
    } catch (err) {
      console.error('[push] could not clear the cached token', err);
    }
    return;
  }
  try {
    localStorage.removeItem(WEB_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// ─── Native token acquisition ─────────────────────────────────────────────────

/**
 * The most recent token the OS has handed us this launch.
 *
 * FCM rotates tokens on its own schedule — a restore to a new device, a data
 * clear, an app update in some cases — and delivers the new one on the same
 * `registration` event as the first. Whoever holds the old one server-side is
 * then registered to a token that silently accepts sends and delivers nothing,
 * which is indistinguishable from push being broken.
 */
let latestToken: string | null = null;

type TokenListener = (token: string) => void;
const tokenListeners = new Set<TokenListener>();

let registrationListeners: Promise<PluginListenerHandle[]> | null = null;

/**
 * Attach the `registration` / `registrationError` listeners, once per launch.
 *
 * Deliberately never removed: they are how a rotated token reaches us, and a
 * rotation that lands while nothing is listening is a device that stops
 * receiving until the user next opens the settings screen.
 */
function ensureRegistrationListeners(): Promise<PluginListenerHandle[]> {
  return (registrationListeners ??= Promise.all([
    PushNotifications.addListener('registration', ({ value }) => {
      if (!value) return;
      latestToken = value;
      // Every token is announced, not only one that changed *within this
      // launch*. The in-memory value starts null on a cold start, so comparing
      // against it would classify the most important case — the token rotated
      // while the app was closed, and the backend still holds the old one — as
      // "first sight" and stay silent. The subscriber compares against what it
      // actually registered, which is the only copy that matters.
      for (const listener of tokenListeners) listener(value);
    }),
    PushNotifications.addListener('registrationError', (err) => {
      // Not thrown: `register()` has already resolved by the time this fires, so
      // there is no caller left to reject. The timeout below is what turns this
      // into an answer.
      console.error('[push] FCM registration failed', err);
    }),
  ]));
}

/**
 * Subscribe to token rotation. Returns the unsubscribe.
 *
 * The consumer re-registers the new token with the backend. It lives outside
 * this module because `src/platform/` does not call services — that is the same
 * boundary that keeps `@capacitor/*` on this side of the line.
 */
export function subscribePushTokenRotation(listener: TokenListener): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

/**
 * Ask the OS for this device's push token.
 *
 * Resolves null rather than throwing, because that is the contract
 * `usePushRegistration` already has with the web provider: null means "could not
 * obtain a push token", and the screen says so.
 *
 * ⚠ **iOS returns an APNs token here, not an FCM one.** `@capacitor/push
 * -notifications` wraps APNs directly on iOS, while the backend sends through
 * FCM — so an iOS token registered as-is would be accepted and never deliver.
 * Closing that needs Firebase's own iOS messaging SDK to do the APNs→FCM
 * exchange. Android, which is what Phase 4 ships, is unaffected: the token below
 * IS the FCM token. Tracked against Phase 6.
 */
async function getNativeToken(): Promise<string | null> {
  await ensureRegistrationListeners();

  // A token already in hand from an earlier register() this launch — including
  // one that arrived by rotation — needs no second round trip.
  if (latestToken) return latestToken;

  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      tokenListeners.delete(onToken);
      resolve(token);
    };

    const onToken: TokenListener = (token) => finish(token);
    const timer = setTimeout(() => finish(latestToken), TOKEN_TIMEOUT_MS);

    // Subscribed before `register()` so a token that arrives synchronously
    // cannot land before anyone is listening.
    tokenListeners.add(onToken);

    void PushNotifications.register().catch((err) => {
      console.error('[push] register() failed', err);
      finish(null);
    });
  });
}

// ─── Delivery: the channel, and pushes that land while the app is on screen ───

/**
 * The Android notification channel every agency push is delivered on.
 *
 * Not ours to pick: the backend stamps `ANDROID_CHANNELS.DEFAULT` onto every
 * send (`fcm-push.service.ts` in the wi-mall API) and Android matches channels
 * by string. Naming one the device does not have fails **quietly** — the
 * Firebase SDK falls back to the manifest default, then to a channel of its own
 * called "Miscellaneous" — so the importance, sound and lights asked for below
 * are simply lost, and the user is left muting something they cannot identify.
 *
 * Three places hold this string and all three must agree: here,
 * `res/values/strings.xml`, and the backend.
 */
export const ANDROID_CHANNEL_ID = 'jovi_default';

/**
 * Create the notification channel. Idempotent, and a no-op off Android.
 *
 * Android updates the name and description of a channel that already exists and
 * ignores everything else — which is the behaviour we want when the agency
 * switches language, and also why importance is not something this can change
 * after the fact. Once the channel exists its importance belongs to the user,
 * and the platform will not let an app raise it back. That is correct: someone
 * who has quietened us should stay quietened.
 *
 * The labels are handed in already translated. `src/platform/` owns the OS, not
 * the app's language — see `usePushDelivery`, which supplies them.
 */
export async function ensureNotificationChannel(name: string, description: string): Promise<void> {
  if (!isNative || platform !== 'android') return;
  try {
    await PushNotifications.createChannel({
      id: ANDROID_CHANNEL_ID,
      name,
      description,
      // IMPORTANCE_HIGH — heads-up, with sound. Everything the backend pushes an
      // agency is about their money or their work; none of it is a digest.
      importance: 4,
      // VISIBILITY_PUBLIC. A shipment reference on a lock screen is not a
      // secret, and a notification the user has to unlock to read is one they
      // will not act on.
      visibility: 1,
      lights: true,
      lightColor: '#1350DD',
      vibration: true,
    });
  } catch (err) {
    // Non-fatal: without the channel the SDK still delivers, just on its own
    // fallback. Worth logging, never worth blocking a render for.
    console.error('[push] could not create the notification channel', err);
  }
}

/** A push that arrived while the app was in the foreground. */
export interface ForegroundPush {
  /** From the payload's `notification` block, or its `data` for a data-only send. */
  title: string | null;
  body: string | null;
  /** The FCM `data` map, flattened to strings. Feed to `routeFromPushData`. */
  data: unknown;
}

/**
 * Subscribe to pushes that arrive while the app is on screen. Returns the
 * unsubscribe; a no-op off native.
 *
 * **This is the gap that makes push look broken to whoever is testing it.** A
 * message carrying a `notification` block is drawn by the OS only while the app
 * is backgrounded or killed. In the foreground FCM hands it to the app instead
 * and draws nothing — and Capacitor draws nothing either unless
 * `presentationOptions` is set. So the one case a tester always tries first,
 * phone in hand with the app open, is the one case where absolutely nothing
 * happens.
 *
 * `presentationOptions` is deliberately NOT the fix. It would post a tray
 * notification over an app the user is already looking at, for a list they can
 * see updating behind it. The app answers in its own language instead — a toast
 * that deep-links, and the badge refreshing — which is what `usePushDelivery`
 * does with this.
 */
export function subscribeForegroundPush(listener: (push: ForegroundPush) => void): () => void {
  if (!isNative) return () => {};

  const handle = PushNotifications.addListener('pushNotificationReceived', (notification) => {
    listener({
      title: notification.title ?? null,
      body: notification.body ?? null,
      data: notification.data,
    });
  });

  return () => {
    void handle
      .then((h) => h.remove())
      .catch((err) => console.error('[push] could not detach the foreground listener', err));
  };
}

// Native setup, at module load and before first render.
//
// The seam install is the timing contract `lib/push.ts` documents for the web
// half: `usePushRegistration` must see a provider on its first `hasProvider`
// read. `lib/push.ts` guards itself with `!isNative` (P2.6), so the two can
// never both be installed and there is no ordering question between them.
//
// The listeners go up here too, rather than lazily on first use, because
// `registration` is also how a ROTATED token arrives — including one FCM
// refreshed while the app was closed, which it delivers shortly after launch. A
// listener attached only when the settings screen opens would miss exactly that
// case, and the backend would keep sending to a token that accepts every send
// and delivers nothing.
if (isNative && typeof window !== 'undefined') {
  window.wiMallGetPushToken = getNativeToken;
  void ensureRegistrationListeners();
}
