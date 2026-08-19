/**
 * System bars (CAPACITOR-PLAN.md → P3.3).
 *
 * The app draws edge to edge: on Android 15+ the platform enforces it, and on
 * older versions `@capacitor/status-bar` opts in by default. Either way the
 * status bar and the gesture bar are transparent strips of *icons* laid over
 * the app's own background, so the only thing left to get right is whether
 * those icons are light or dark — and the answer is whatever the app's theme is
 * doing underneath them. Get it wrong and the clock and the battery vanish.
 *
 * **The theme signal is the `.dark` class on `<html>`**, which is deliberately
 * the same one the pre-paint script in `index.html` writes and `applyDocument
 * Theme()` maintains. Observing the DOM rather than subscribing to `useUIStore`
 * means the bars are correct from the very first frame — before React mounts —
 * and stay correct through a manual switch, an OS switch while `system` is
 * selected, and any future writer of that class. There is no second source of
 * truth to drift.
 *
 * The `env(safe-area-inset-*)` padding that keeps content out from under those
 * bars is CSS and lives with the components; Capacitor 8 injects the values
 * (see `SystemBars` in capacitor-android) once `viewport-fit=cover` is set,
 * which `index.html` does.
 */
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNative } from '../env';

let observer: MutationObserver | null = null;
let applied: SystemBarsStyle | null = null;

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
}

/**
 * Keep the system bars in step with the app theme, for as long as the app runs.
 *
 * Called once from `main.tsx`, before React renders. A no-op off native.
 * Returns an uninstall function; the app never calls it, but a test can.
 */
export function initStatusBar(): () => void {
  if (!isNative || observer) return () => {};

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
