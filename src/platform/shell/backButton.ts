/**
 * The Android hardware back button (CAPACITOR-PLAN.md → P3.1).
 *
 * Back is not a nicety on Android; it is how people leave things. Capacitor's
 * default — walk the WebView's history — is close enough to right that its
 * absence is the more common bug, and the moment a `backButton` listener exists
 * the default is switched off entirely and JS owns every press. So this handler
 * has to answer all three cases, in this order:
 *
 *   1. **A dialog, sheet or menu is open** → close it. Radix dismisses on
 *      Escape, and Escape is a *keyboard* event that a hardware button never
 *      produces, so without this a back press navigates the page out from
 *      underneath an open sheet.
 *   2. **There is somewhere to go back to** → go there.
 *   3. **We are at the root of the stack** → confirm, then exit. A single press
 *      that quits an app with an unsaved form in it is the reason people learn
 *      not to trust the back button.
 *
 * iOS has no hardware back button and never fires this event; the whole module
 * is inert there and on the web.
 */
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { isNative, platform } from '../env';

/** How long the "press again" offer stands. Matches the toast's duration. */
const EXIT_CONFIRM_WINDOW_MS = 2000;

/** One id, so holding back down replaces the prompt instead of stacking it. */
const EXIT_TOAST_ID = 'shell:confirm-exit';

/**
 * Every overlay in the app that owns the screen and should absorb a back press.
 *
 * Radix marks its open content with `data-state="open"`, but so do Accordion and
 * Collapsible *triggers* — hence the `role` qualifiers, which only a modal
 * layer carries. `[data-radix-popper-content-wrapper]` catches the floating
 * family (select, dropdown, popover, combobox) whose content is a child of the
 * wrapper rather than the element carrying the role.
 */
const DISMISSIBLE_LAYER_SELECTOR = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[data-radix-popper-content-wrapper]',
  '[vaul-drawer][data-state="open"]',
].join(', ');

/** Whether any modal layer is currently on screen. */
export function hasOpenOverlay(): boolean {
  return document.querySelector(DISMISSIBLE_LAYER_SELECTOR) !== null;
}

/**
 * Close the topmost open overlay, if there is one. Returns whether it acted.
 *
 * Synthesises the Escape keypress rather than reaching for each component's
 * `onOpenChange`: Radix's dismissable-layer stack already knows which layer is
 * on top, which ones nest, and which have opted out of dismissal. Re-deriving
 * that from the DOM would be a second, worse implementation of it — and it
 * would need every future overlay to register itself here.
 *
 * A layer that deliberately refuses Escape (a confirmation the user must
 * answer) therefore also refuses back, which is the same answer for the same
 * reason.
 */
export function dismissTopLayer(): boolean {
  if (!hasOpenOverlay()) return false;

  // Dispatched from the focused element so it bubbles up through the layer that
  // owns focus; Radix listens on the document in the capture phase either way.
  const target: EventTarget = document.activeElement ?? document.body;
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true,
    }),
  );
  return true;
}

/**
 * Wire the hardware back button to the router. Call once, inside the Router.
 *
 * The listener is registered once for the life of the app and reads `navigate`
 * and `t` through refs, so a language switch or a route change cannot leave a
 * window in which no handler is attached — during which Android would fall back
 * to "no listeners" behaviour and the app would suddenly quit on a back press.
 */
export function useHardwareBackButton(): void {
  const navigate = useNavigate();
  const { t } = useTranslation('nav');

  const navigateRef = useRef(navigate);
  const tRef = useRef(t);

  // Synced in an effect rather than during render: a ref write during render is
  // not safe under concurrent rendering, and the refs only ever need to be
  // current by the time a *user event* reads them — which is always after the
  // commit that set them.
  useEffect(() => {
    navigateRef.current = navigate;
    tRef.current = t;
  });

  /** When the exit offer was made. 0 means "not armed". */
  const exitArmedAt = useRef(0);

  useEffect(() => {
    // `platform`, not just `isNative`: iOS never fires this, and registering
    // there would only take the default handling away from a button that does
    // not exist.
    if (!isNative || platform !== 'android') return;

    let handle: PluginListenerHandle | null = null;
    let cancelled = false;

    void App.addListener('backButton', ({ canGoBack }) => {
      if (dismissTopLayer()) return;

      if (canGoBack) {
        // `canGoBack` is the WebView's own answer, and every route change in
        // this app is a pushState on one document — so it is false exactly when
        // the user is on the entry they launched into.
        exitArmedAt.current = 0;
        navigateRef.current(-1);
        return;
      }

      const now = Date.now();
      if (now - exitArmedAt.current < EXIT_CONFIRM_WINDOW_MS) {
        void App.exitApp();
        return;
      }

      exitArmedAt.current = now;
      // Kept at the app's normal toast position rather than the bottom-centre
      // an Android Toast would use: bottom-centre lands squarely on the tab bar,
      // covering the navigation at the exact moment the user is deciding
      // whether to navigate.
      toast(tRef.current('mobile.exitConfirm'), {
        id: EXIT_TOAST_ID,
        duration: EXIT_CONFIRM_WINDOW_MS,
      });
    }).then((registered) => {
      if (cancelled) void registered.remove();
      else handle = registered;
    });

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, []);
}
