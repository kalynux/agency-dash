/**
 * Outbound links (CAPACITOR-PLAN.md → P3.5).
 *
 * A Capacitor shell is a single WebView with no chrome: no address bar, no tab
 * strip, no back gesture out of a page it navigated to. Let an `<a>` to
 * `https://wa.me/…` navigate that WebView and the app is *gone* — replaced by a
 * web page the user has no way to leave except by force-quitting. `target
 * ="_blank"` does not save it either; a WebView has nowhere to put a second
 * window, so those links tend to do nothing at all.
 *
 * `@capacitor/browser` opens a Chrome Custom Tab (Android) / `SFSafariView
 * Controller` (iOS) instead: a real browser, over the app, with its own close
 * button, and the app still running underneath.
 *
 * Two entry points, because outbound links arrive two ways:
 *
 *  - {@link openExternal} for code that opens a URL itself.
 *  - {@link installExternalLinkInterceptor} for markup — including the
 *    `<a target="_blank">` that `LiveTrackingMap` injects into a Leaflet popup
 *    as an HTML string, which no component-level fix could reach.
 *
 * On web both fall through to today's behaviour, so the browser build is
 * untouched (ground rule 3).
 */
import { Browser } from '@capacitor/browser';
import { isNative } from './env';

/**
 * Open a URL outside the app.
 *
 * Native gets an in-app browser; the web build gets the `window.open` it always
 * had. Never throws — a link that cannot be opened is not worth taking a screen
 * down for.
 */
export async function openExternal(url: string): Promise<void> {
  if (!isNative) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  try {
    await Browser.open({ url });
  } catch (err) {
    console.warn('[shell] could not open an external URL', url, err);
  }
}

/**
 * Whether a resolved URL points somewhere the WebView must not navigate to.
 *
 * Compared on protocol + host rather than `origin` on purpose: under iOS the
 * document's scheme is `capacitor:`, which `URL` does not treat as a special
 * scheme, so `new URL('/dashboard', location.href).origin` is the string
 * `"null"` — and an origin comparison would classify every in-app route as
 * external and hand the whole app to Safari.
 *
 * Non-http schemes (`mailto:`, `tel:`, `whatsapp:`, `intent:`) are deliberately
 * left alone: Capacitor's own `WebViewClient` already hands those to the system,
 * which is the correct destination, and `Browser.open` cannot load them.
 */
function isExternal(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return url.host !== window.location.host || url.protocol !== window.location.protocol;
}

function onDocumentClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const anchor = (event.target as Element | null)?.closest?.('a');
  const href = anchor?.getAttribute('href');
  if (!anchor || !href) return;

  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    // Not a URL we can reason about (`#anchor` handling lives in the router).
    return;
  }
  if (!isExternal(url)) return;

  event.preventDefault();
  void openExternal(url.href);
}

let interceptorInstalled = false;

/**
 * Route every external `<a>` through the in-app browser. Native only.
 *
 * Registered in the **capture** phase so it runs before any component's own
 * `onClick`, and bails on `defaultPrevented` so a handler that already dealt
 * with the click (a router link, a menu item) keeps precedence.
 *
 * Returns an uninstall function; the app never calls it, but a test can.
 */
export function installExternalLinkInterceptor(): () => void {
  if (!isNative || interceptorInstalled) return () => {};
  interceptorInstalled = true;

  document.addEventListener('click', onDocumentClick, { capture: true });
  return () => {
    document.removeEventListener('click', onDocumentClick, { capture: true });
    interceptorInstalled = false;
  };
}
