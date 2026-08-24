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
import { useLocation, useNavigate, useNavigationType, type NavigationType } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { isNative, platform } from '../env';

/** How long the "press again" offer stands. Matches the toast's duration. */
const EXIT_CONFIRM_WINDOW_MS = 2000;

/**
 * How long after a handled press another one is ignored.
 *
 * Android's back is dispatched to JS TWICE for every press: `AppPlugin.java`
 * calls `notifyListeners('backButton', …)` and then
 * `bridge.triggerJSEvent('backbutton', 'document')` — the plugin event and the
 * Cordova-compatibility DOM event, from the same `handleOnBackPressed`. Only the
 * first is handled here today, but a single stray listener on the other (a
 * dependency, a future `document.addEventListener('backbutton')`) would silently
 * turn every press into two — which reads as back "skipping" a screen, and is
 * exactly the shape of bug that is impossible to spot from the code.
 *
 * Short enough that deliberate repeated presses still step back once each: a
 * fast human repeat is ~150ms apart at the very quickest, and the two machine
 * dispatches are in the same frame.
 */
const DUPLICATE_PRESS_MS = 120;

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
 * How many screens deep into the app the user is, counted by the router rather
 * than by the WebView.
 *
 * The plugin hands us `canGoBack`, which is `WebView.canGoBack()` — a count of
 * *document* history entries, including any the app did not put there and any a
 * redirect swapped out. It answers "is there anything behind this page", which
 * is not the same question as "is there a screen of ours to go back to", and the
 * two disagree exactly where it matters: at the root, where the difference is
 * between offering to exit and quietly navigating somewhere the user never was.
 *
 * Counting our own pushes removes the guess. `PUSH` added a screen, `POP`
 * removed one, and `REPLACE` did neither — a redirect like
 * `/dashboard/agents → /dashboard/agents/connections` swapped the entry rather
 * than stacking a second one, and must not be counted as somewhere to return to.
 *
 * Keyed on `location.key`, which React Router mints per history entry, so a
 * re-render that does not move cannot be mistaken for a navigation.
 */
function useNavigationDepth(): { current: number } {
  const location = useLocation();
  const navigationType = useNavigationType();
  const depth = useRef(0);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (lastKey.current === location.key) return;
    // The first commit is the entry the app launched on, not a navigation into
    // it — seed the key and leave the depth at zero.
    const isFirst = lastKey.current === null;
    lastKey.current = location.key;
    if (isFirst) return;

    depth.current = nextDepth(depth.current, navigationType);
  }, [location.key, navigationType]);

  return depth;
}

/**
 * The three shapes a navigation can take.
 *
 * Spelled out rather than reusing react-router's `NavigationType` alone: that is
 * a string *enum*, and TypeScript will not let a plain `'PUSH'` stand in for one
 * — which would make every case in the tests a cast. The union accepts both, and
 * the enum's values are exactly these three strings.
 */
export type NavigationKind = 'PUSH' | 'POP' | 'REPLACE';

/**
 * The depth after one navigation of the given kind. Pure, and exported for the
 * unit tests — the hook around it is three lines of React over this rule.
 *
 * `REPLACE` is the one worth stating: it swapped the current entry rather than
 * stacking a new one, so it adds nothing to go back to.
 */
export function nextDepth(
  depth: number,
  navigationType: NavigationKind | NavigationType,
): number {
  if (navigationType === 'PUSH') return depth + 1;
  if (navigationType === 'POP') return Math.max(0, depth - 1);
  return depth;
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
  const depth = useNavigationDepth();

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
  /** When a press was last acted on — see {@link DUPLICATE_PRESS_MS}. */
  const lastPressAt = useRef(0);

  useEffect(() => {
    // `platform`, not just `isNative`: iOS never fires this, and registering
    // there would only take the default handling away from a button that does
    // not exist.
    if (!isNative || platform !== 'android') return;

    let handle: PluginListenerHandle | null = null;
    let cancelled = false;

    void App.addListener('backButton', () => {
      const pressedAt = Date.now();
      // One press, one action. See DUPLICATE_PRESS_MS for why a press can
      // arrive here twice.
      if (pressedAt - lastPressAt.current < DUPLICATE_PRESS_MS) return;
      lastPressAt.current = pressedAt;

      if (dismissTopLayer()) return;

      // `canGoBack` from the event is deliberately ignored — see
      // `useNavigationDepth` for what it counts and why that is the wrong count.
      if (depth.current > 0) {
        exitArmedAt.current = 0;
        navigateRef.current(-1);
        return;
      }

      const now = pressedAt;
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
