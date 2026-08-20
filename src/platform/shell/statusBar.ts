/**
 * System bars (CAPACITOR-PLAN.md → P3.3).
 *
 * Two jobs: the icons must be readable against whatever the app is drawing, and
 * the app must not draw *underneath* them.
 *
 * ── Why the app stops drawing edge to edge on Android 14 and below ────────────
 *
 * `env(safe-area-inset-*)` is the only way CSS can know how tall the status bar
 * is, and on Android it is Capacitor that decides whether that value is real.
 * `SystemBars` in capacitor-android takes one of two paths per frame:
 *
 *  - **WebView ≥ 140 with `viewport-fit=cover`** — the insets are passed through
 *    to the WebView, `env()` resolves, and the same numbers are also mirrored
 *    into `--safe-area-inset-*`. Everything works.
 *  - **anything older** — the insets are explicitly rewritten to `Insets.of(0,
 *    0, 0, 0)` before the WebView sees them, and `injectSafeAreaCSS` is fed
 *    those same zeroes. On Android 15+ that is harmless, because the branch also
 *    pads the WebView's parent view natively. On **Android 14 and below it pads
 *    nothing** — so the WebView still spans the full screen, `env()` is `0px`,
 *    `--safe-area-inset-top` is `0px`, and there is no signal left anywhere for
 *    CSS to react to.
 *
 * The status bar overlays the WebView in the first place only because
 * `@capacitor/status-bar` defaults `overlaysWebView` to true. So the fix is to
 * decline the overlay on Android: the system then lays the WebView out below
 * the bar, and `env()` reporting `0px` becomes the correct answer rather than a
 * missing one. On Android 15+ the call is ignored — the platform enforces edge
 * to edge for `targetSdk` 35+ and the deprecated flags it uses are no-ops —
 * which is exactly right, because that is the version where the inset machinery
 * does work and `StatusBarScrim` plus the `env()` padding take over.
 *
 * Nothing in CSS needed changing for this, and nothing should be added: on every
 * path where the app draws under the bar, `env()` is populated.
 *
 * ── Why the icons follow the DOM and not the store ────────────────────────────
 *
 * **The theme signal is the `.dark` class on `<html>`**, which is deliberately
 * the same one the pre-paint script in `index.html` writes and `applyDocument
 * Theme()` maintains. Observing the DOM rather than subscribing to `useUIStore`
 * means the bars are correct from the very first frame — before React mounts —
 * and stay correct through a manual switch, an OS switch while `system` is
 * selected, and any future writer of that class. There is no second source of
 * truth to drift.
 */
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNative, platform } from '../env';

let observer: MutationObserver | null = null;
let applied: SystemBarsStyle | null = null;

/**
 * `--background` as a hex string, or null if it cannot be read.
 *
 * Read from the live stylesheet rather than hardcoded, so the bar can never
 * drift from the app's own surface the way a fourth copy of `#fcfdfe` would.
 * Tailwind stores the token as a bare HSL channel triplet (`214 42% 99%`), and
 * `setBackgroundColor` wants hex, hence the conversion.
 */
function backgroundHex(): string | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
  const parts = /^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/.exec(raw);
  if (!parts) return null;

  const hue = Number(parts[1]);
  const sat = Number(parts[2]) / 100;
  const light = Number(parts[3]) / 100;

  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const base = light - chroma / 2;

  const [r, g, b] =
    hue < 60 ? [chroma, second, 0]
    : hue < 120 ? [second, chroma, 0]
    : hue < 180 ? [0, chroma, second]
    : hue < 240 ? [0, second, chroma]
    : hue < 300 ? [second, 0, chroma]
    : [chroma, 0, second];

  const channel = (value: number) =>
    Math.round((value + base) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/**
 * Apply the current theme to both system bars.
 *
 * **`Dark` means *light icons for a dark background*, not "dark icons".** Both
 * plugins name the style after the surface it is for rather than after the
 * colour it produces, which reads backwards every single time — so the mapping
 * is written out once, here, and no call site has to remember it.
 */
function apply(): void {
  const isDark = document.documentElement.classList.contains('dark');
  const style = isDark ? SystemBarsStyle.Dark : SystemBarsStyle.Light;
  if (style === applied) return;
  applied = style;

  // `SystemBars` is Capacitor 8's core plugin and covers BOTH bars — the status
  // bar and Android's gesture/navigation bar. `@capacitor/status-bar` only ever
  // touches the status bar, so on a light theme over a dark OS the gesture bar
  // would keep white-on-white icons.
  void SystemBars.setStyle({ style }).catch(() => {});

  // …and the same style is pushed into `@capacitor/status-bar` as well, which
  // is not redundant. That plugin caches the last style it was given and
  // re-applies it on every configuration change (rotation, an OS dark-mode
  // toggle). Left holding its default it would re-apply *the system's* theme on
  // the next rotation and quietly undo the line above. The two enums carry the
  // same string values but are nominally distinct, hence the second ternary.
  void StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {});

  // The bar is a solid band of its own once the overlay is declined, and the
  // colour it falls back to is whatever the launch theme happened to leave on
  // the window — on this app, the splash. Painting it with `--background` is
  // what makes the band read as part of the app rather than as a seam above it.
  //
  // A no-op on Android 15+, where `Window.setStatusBarColor` is ignored; there
  // the bar is transparent over the app's own pixels and already matches.
  const background = backgroundHex();
  if (background) void StatusBar.setBackgroundColor({ color: background }).catch(() => {});
}

/**
 * Keep the system bars in step with the app theme, for as long as the app runs.
 *
 * Called once from `main.tsx`, before React renders. A no-op off native.
 * Returns an uninstall function; the app never calls it, but a test can.
 */
export function initStatusBar(): () => void {
  if (!isNative || observer) return () => {};

  // Decline the overlay before the first paint, so the layout is never briefly
  // wrong. Android only: on iOS `env()` is reported by the platform itself and
  // has always worked, and turning the overlay off there would trade a working
  // inset for a solid band across the notch.
  if (platform === 'android') {
    void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  }

  apply();
  observer = new MutationObserver(apply);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  return () => {
    observer?.disconnect();
    observer = null;
    applied = null;
  };
}
