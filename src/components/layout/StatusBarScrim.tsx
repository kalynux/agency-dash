/**
 * An opaque band of the app's own background sitting behind the OS status bar.
 *
 * The shell draws edge to edge — on Android 15+ the platform enforces it and
 * `setStatusBarColor`/`setOverlaysWebView` are no-ops, so there is no native
 * knob left to paint that strip with (see `src/platform/shell/statusBar.ts`,
 * and note this app targets SDK 36). The status bar is a transparent layer of
 * *icons* over whatever the WebView happens to be drawing underneath.
 *
 * `main`'s `pt-[calc(1.5rem+env(safe-area-inset-top))]` keeps content clear of
 * it at rest, but padding only holds while the page is at the top: scroll down
 * and every row passes under the clock and the battery, which is exactly the
 * collision this fixes. A fixed element is the only thing that stays put while
 * the document moves.
 *
 * `bg-background` and not a blur: a translucent bar still shows the content
 * sliding underneath, which is the complaint rather than the cure.
 *
 * **z-40 is deliberate.** Above every page surface (the tallest is `z-30` — the
 * desktop header and `MobilePageHeader`) and below every overlay (`z-50` — the
 * tab bar, the offline banner, dialogs and sheets), so a modal still dims the
 * status-bar band along with the rest of the screen and the offline banner can
 * still claim it.
 *
 * Zero-height everywhere `env(safe-area-inset-top)` resolves to 0, which is
 * every desktop browser — so the web build is untouched and this needs no
 * `isNative` check.
 */
export function StatusBarScrim() {
  return (
    <div
      aria-hidden
      // pointer-events-none: the band is decoration. Without it, taps meant for
      // a control that scrolled up under the status bar would be swallowed by
      // an invisible div rather than reaching the page.
      className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-background"
    />
  );
}
