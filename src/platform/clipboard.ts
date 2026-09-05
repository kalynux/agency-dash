/**
 * Clipboard (CAPACITOR-PLAN.md → P4.5).
 *
 * `navigator.clipboard` is unreliable in a WebView: it is gated on a secure
 * context and a user gesture, Android's implementation has historically returned
 * a promise that never settles, and where it does fail it rejects — which, at
 * the one call site we have, was an unhandled rejection with a "Copied!" state
 * that never arrived and no explanation.
 *
 * `@capacitor/clipboard` goes to `ClipboardManager` / `UIPasteboard` directly
 * and has none of those conditions.
 *
 * Returns whether the copy actually happened, so the caller can stop claiming it
 * did. On web the path is the same `navigator.clipboard.writeText` as before,
 * with its rejection turned into `false` instead of left to float.
 */
import { Clipboard } from '@capacitor/clipboard';
import { isNative } from './env';

/** Copy `text`. Resolves true on success, false if the platform refused. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (isNative) {
      await Clipboard.write({ string: text });
      return true;
    }
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.warn('[clipboard] could not copy', err);
    return false;
  }
}
