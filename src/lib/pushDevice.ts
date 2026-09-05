/**
 * Device registration policy for push (CAPACITOR-PLAN.md → P4.1).
 *
 * The one place that knows the *sequence*: talk to the backend, then update the
 * local cache — never the other way round, so a failed call can never leave the
 * app believing it is registered.
 *
 * It sits between two layers that must not import each other. `src/platform/`
 * owns the OS (permission, token, secure cache) and deliberately calls no
 * services; `src/services/` owns the API and knows nothing about a device. Both
 * `usePushRegistration` and `authService.logout()` need the pair done in order,
 * and neither is a good home for it.
 */
import { notificationsService } from '@/services/notifications.service';
import {
  cachePushToken,
  clearCachedPushToken,
  devicePlatform,
  readCachedPushToken,
} from '@/platform/push';

/**
 * Register `token` for this device and remember it.
 *
 * The cache write follows the call on purpose: a cached token the server never
 * saw would show the settings screen as "registered" while nothing is ever
 * delivered — the exact state that is hardest to diagnose from a bug report.
 *
 * Throws whatever the API threw; the caller decides how loudly to say so.
 */
export async function registerPushDevice(token: string): Promise<void> {
  await notificationsService.registerDevice({
    token,
    platform: devicePlatform,
    // The WebView's UA on a device. Not a great device name, but it is what the
    // backend's device list has always shown and changing it is not this
    // phase's call.
    userAgent: navigator.userAgent,
  });
  await cachePushToken(token);
}

/**
 * Unregister this device, if it was registered. Never throws.
 *
 * ⚠ **Call this BEFORE credentials are discarded.** `DELETE /agency/devices` is
 * an authenticated call, so on the bearer transport it authenticates with the
 * very token `logout()` is about to destroy. Reversed, it fails with a 401 and
 * the device stays subscribed — signed out of the app, still receiving its
 * notifications.
 *
 * Best-effort by design: a logout must not be blocked by a network that is not
 * answering. The local cache is cleared either way, because the alternative is
 * an app that refuses to offer push to the next person who signs in on this
 * device.
 */
export async function unregisterPushDevice(): Promise<void> {
  try {
    const token = await readCachedPushToken();
    if (token) await notificationsService.unregisterDevice(token);
  } catch (err) {
    console.warn('[push] could not unregister this device', err);
  } finally {
    await clearCachedPushToken();
  }
}
