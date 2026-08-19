/**
 * Permission vocabulary shared by the capabilities that need one
 * (CAPACITOR-PLAN.md → P4.3, P4.4).
 *
 * Camera, photo library and location all fail in the same four ways, and the
 * plan is explicit that the UI must tell two of them apart: a permission the
 * user declined *this time* deserves a retry button, and one they have
 * permanently declined deserves a route to system settings — because the OS will
 * never show a prompt for it again, and a retry button that silently does
 * nothing is worse than no button.
 *
 * Capacitor reports both as `'denied'`. The distinguishing state is
 * `'prompt-with-rationale'`: Android's "denied once, you may ask again". So
 * `'denied'` read back from `checkPermissions()` — with no rationale offered —
 * is the permanent one.
 */
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import type { PermissionState } from '@capacitor/core';
import { isNative } from './env';

/**
 * What a capability request can come back as.
 *
 * `'blocked'` is the one that changes the UI: it is the only outcome where
 * asking again is pointless.
 */
export type PermissionOutcome = 'granted' | 'denied' | 'blocked';

/**
 * Every permission string any of our plugins can answer.
 *
 * `@capacitor/core`'s `PermissionState` is the common four; the Camera plugin
 * adds iOS's `'limited'`, which core does not know about.
 */
export type AnyPermissionState = PermissionState | 'limited';

/**
 * Read a Capacitor permission state as an outcome.
 *
 * `checked` is what `checkPermissions()` said BEFORE prompting, and it carries
 * the information the post-prompt state has already lost: if it was
 * `'prompt'`/`'prompt-with-rationale'` then the OS did show a prompt just now
 * and a `'denied'` result is this-time-only. If it was already `'denied'`, no
 * prompt was shown and no prompt ever will be.
 */
export function toOutcome(
  checked: AnyPermissionState,
  requested: AnyPermissionState,
): PermissionOutcome {
  if (requested === 'granted') return 'granted';
  // iOS `'limited'` (a partial photo selection) reaches us as its own string on
  // the Camera plugin; it is a grant — the user chose what we may see.
  if (requested === 'limited') return 'granted';
  return checked === 'denied' ? 'blocked' : 'denied';
}

/**
 * Whether an in-app button can actually reach the system settings screen.
 *
 * False on the web, where the equivalent is a browser UI we cannot open and the
 * honest thing is to describe it instead.
 */
export const canOpenAppSettings = isNative;

/**
 * Open this app's entry in the OS settings, where a blocked permission can be
 * re-granted. Never throws — the fallback is the message that accompanies it.
 */
export async function openAppSettings(): Promise<void> {
  if (!isNative) return;
  try {
    await NativeSettings.open({
      // The app's own details page, not the global privacy list: it is one tap
      // from there to the specific toggle, and it is the screen every Android
      // "app info" flow already lands on, so it is the one users recognise.
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });
  } catch (err) {
    console.warn('[permissions] could not open the system settings screen', err);
  }
}
