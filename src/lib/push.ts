/**
 * Firebase Cloud Messaging bootstrap.
 *
 * Imported for its side effect in main.tsx: it installs the
 * `window.wiMallGetPushToken` provider that usePushRegistration consumes
 * (see src/hooks/usePushRegistration.ts). Installation happens synchronously
 * at module load so the hook sees the provider on first render; Firebase
 * itself is initialised lazily, only when a token is actually requested.
 *
 * When any VITE_FIREBASE_* value is missing the provider is NOT installed and
 * the settings UI keeps showing "Push messaging is not configured for this
 * deployment" (in-app notifications still work). See env/.env.development.
 */
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, type Messaging } from 'firebase/messaging';
import { isNative } from '@/platform/env';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

const configured = Boolean(vapidKey) && Object.values(firebaseConfig).every(Boolean);

// Memoised so repeated Enable clicks reuse the same app / SW registration.
let messagingPromise: Promise<Messaging | null> | null = null;
let swPromise: Promise<ServiceWorkerRegistration> | null = null;

async function initMessaging(): Promise<Messaging | null> {
  // Guards against browsers without the Push/SW APIs (e.g. iOS < 16.4).
  if (!(await isSupported())) return null;
  return getMessaging(initializeApp(firebaseConfig));
}

/**
 * Resolve a current FCM registration token for this device, or null when the
 * environment can't produce one. Never throws — usePushRegistration treats
 * null as "could not obtain a push token".
 */
async function getPushToken(): Promise<string | null> {
  try {
    const messaging = await (messagingPromise ??= initMessaging());
    if (!messaging) return null;
    // FCM requires its service worker at the origin root (served from public/).
    const serviceWorkerRegistration = await (swPromise ??=
      navigator.serviceWorker.register('/firebase-messaging-sw.js'));
    return await getToken(messaging, { vapidKey, serviceWorkerRegistration });
  } catch (err) {
    console.error('[push] Could not obtain an FCM token:', err);
    // Allow a retry to re-init if the first attempt failed mid-way.
    messagingPromise = null;
    swPromise = null;
    return null;
  }
}

// `!isNative` is load-bearing, not defensive (CAPACITOR-PLAN.md → P2.6).
//
// `'serviceWorker' in navigator` is TRUE inside a Capacitor WebView, so without
// it this installs a web-push provider on a device: FCM registers a service
// worker that no native push service will ever deliver to, and the settings
// screen reports push as working when nothing can arrive. Phase 4 replaces the
// provider with a native one at the same `window.wiMallGetPushToken` seam, which
// is why the guard lives here and not in `usePushRegistration`.
if (!isNative && configured && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.wiMallGetPushToken = getPushToken;
}
