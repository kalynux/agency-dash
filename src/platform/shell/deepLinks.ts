/**
 * Deep links (CAPACITOR-PLAN.md → P4.2).
 *
 * Backend notifications already carry `action.path` — `"shipments/{id}"`,
 * `"stock-requests/{id}"`, `"agents/{contractId}"` — and `lib/notification
 * -display.ts` already turns one into an in-app route. What has never existed is
 * anything that routes them *into* the app from outside it.
 *
 * **Half the value of push depends on this.** A notification that opens the
 * dashboard's home screen and leaves the user to find the shipment it was about
 * is barely better than no notification, and it is the thing people judge a
 * mobile app on within the first day.
 *
 * Two sources, one destination:
 *
 *  - `appUrlOpen` — the app was opened by a URL (an App Link from a browser or
 *    another app, or the `wiagency://` scheme).
 *  - `pushNotificationActionPerformed` — the user tapped a notification.
 *
 * Both resolve to an app-relative route and go through the same `navigate()`.
 */
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import type { PluginListenerHandle } from '@capacitor/core';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardRoute } from '@/lib/notification-display';
import { isNative } from '../env';

/**
 * A link that arrived before anything could route it.
 *
 * This is the normal case, not an edge one: tapping a notification on a phone
 * where the app is not running starts the process, and the plugin replays the
 * tap as soon as the JS context exists — which is well before React has mounted
 * and a router exists to receive it. Without somewhere to put it the app opens
 * on the dashboard and the tap is silently lost, which is exactly the failure
 * this module is for.
 */
let pendingRoute: string | null = null;

/** Set once `useDeepLinks` has mounted. */
let deliver: ((route: string) => void) | null = null;

function route(target: string | null): void {
  if (!target) return;
  if (deliver) deliver(target);
  else pendingRoute = target;
}

/**
 * Turn an incoming URL into an in-app route, or null if there is nothing to go
 * to.
 *
 * The two link shapes carry the path at different depths, and conflating them
 * sends every custom-scheme link to the wrong screen:
 *
 * - `https://agency.wi-mall.com/dashboard/shipments/123` — an **App Link**,
 *   minted against the web app. Its pathname is already a full app route.
 * - `wiagency://shipments/123` — our own scheme, carrying the same
 *   dashboard-relative path the notification payload uses. `URL` parses the
 *   first segment as the *host* here (a custom scheme has no authority to
 *   speak of), so `host + pathname` is the path, and it still needs
 *   `/dashboard` in front of it.
 *
 * The origin is never checked. The app is served from
 * `agency.wi-mall.internal` inside the WebView while its links are minted
 * against `agency.wi-mall.com`, so comparing hosts would reject every real link
 * — and the scheme and host are what Android's intent filter already matched
 * on, so by the time a URL is here it has been vouched for.
 */
export function routeFromUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const isWebLink = url.protocol === 'http:' || url.protocol === 'https:';
  const raw = isWebLink ? url.pathname : `${url.host}${url.pathname}`;
  const path = raw.replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '');
  if (!path) return null;

  return `${isWebLink ? `/${path}` : dashboardRoute(path)}${url.search}`;
}

/**
 * The route a push payload is asking for, or null.
 *
 * The data payload mirrors the in-app `action` object (see
 * `AgencyNotificationAction`), so `path` is app-relative — `"shipments/{id}"` —
 * and `notificationHref` is the same resolver the notifications list uses. A
 * fully-qualified `url` is accepted as a fallback for a payload minted by an
 * older sender.
 *
 * FCM flattens `data` to strings, so nothing here assumes a nested object.
 */
export function routeFromPushData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Record<string, unknown>;

  const path = payload.path ?? payload.action_path;
  if (typeof path === 'string' && path.trim()) return dashboardRoute(path.trim());

  const url = payload.url ?? payload.action_url;
  if (typeof url === 'string' && url.trim()) return routeFromUrl(url.trim());

  return null;
}

let listeners: Promise<PluginListenerHandle[]> | null = null;

/**
 * Attach both sources, once per launch, at module scope rather than from the
 * hook.
 *
 * The cold-start tap is the reason. `pushNotificationActionPerformed` replays as
 * soon as the bridge is up; a listener that waits for a React effect is not
 * there yet, and the tap that launched the app is the single most important one
 * to get right.
 */
function installDeepLinkListeners(): Promise<PluginListenerHandle[]> {
  return (listeners ??= Promise.all([
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      route(routeFromUrl(event.url));
    }),
    PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      route(routeFromPushData(notification.data));
    }),
  ]));
}

if (isNative) {
  void installDeepLinkListeners();
}

/**
 * Route incoming deep links. Call once, inside the Router.
 *
 * `navigate` is read through a ref so the listeners registered above never need
 * re-registering, and so a route change cannot leave a window in which a tap has
 * nowhere to go.
 */
export function useDeepLinks(): void {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);

  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    if (!isNative) return;

    deliver = (target) => navigateRef.current(target);

    // Whatever arrived before React was ready — including the tap that started
    // this launch.
    if (pendingRoute) {
      const target = pendingRoute;
      pendingRoute = null;
      deliver(target);
    }

    return () => {
      deliver = null;
    };
  }, []);
}

/** Test seam. Not part of the app's surface. */
export function __resetDeepLinksForTests(): void {
  pendingRoute = null;
  deliver = null;
}
