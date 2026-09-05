/**
 * The on-screen keyboard (CAPACITOR-PLAN.md → P3.2).
 *
 * Two separate problems live here, and only the second needs any code.
 *
 * **Resizing.** When the keyboard opens, something has to give the WebView a
 * smaller viewport or the focused field ends up behind it. On Android that is
 * already handled below the JS layer: Capacitor 8's built-in `SystemBars`
 * applies the IME inset as padding on the WebView's container, and zeroes the
 * bottom safe-area inset while the keyboard is up, so `fixed bottom-0` and
 * `env(safe-area-inset-bottom)` both stay honest. iOS has no equivalent default
 * and is told explicitly, in {@link initKeyboard}.
 *
 * **Fixed bars.** Resizing does *not* solve them. `MobileTabBar` is `fixed
 * bottom-0`, so it faithfully re-pins itself directly on top of the keyboard —
 * a row of navigation buttons sitting between the text field and the keys, over
 * the suggestion strip. `UnsavedChangesBar` floats in the same band and has the
 * same problem. Both need to know the keyboard is up, which is what
 * {@link useKeyboardOpen} is for.
 *
 * The browser fall-back is `false`, always: on the web the tab bar has never
 * hidden itself, and ground rule 3 says the web build is the control group.
 * `visualViewport` could synthesise the same signal in a mobile browser, but it
 * would be a behaviour change to a shipping surface in service of a problem
 * browsers do not have — they resize the visual viewport and leave the layout
 * viewport alone, so a fixed bar stays put rather than riding the keyboard.
 */
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { useSyncExternalStore } from 'react';
import { isNative, platform } from '../env';

export interface KeyboardState {
  open: boolean;
  /** Keyboard height in CSS pixels, or 0 when closed. Native only. */
  height: number;
}

type Listener = (state: KeyboardState) => void;

const CLOSED: KeyboardState = { open: false, height: 0 };

/** Cached snapshot — `useSyncExternalStore` compares by identity. */
let state: KeyboardState = CLOSED;
const listeners = new Set<Listener>();
let started = false;

function publish(next: KeyboardState): void {
  if (next.open === state.open && next.height === state.height) return;
  state = next;
  for (const listener of listeners) listener(state);
}

/**
 * Start listening, and apply the iOS resize policy.
 *
 * Called once from `main.tsx`. Idempotent, and a no-op off native — in a browser
 * there is nothing to configure and no event to wait for.
 */
export function initKeyboard(): void {
  if (!isNative || started) return;
  started = true;

  if (platform === 'ios') {
    // `native` resizes the whole WebView, so `100vh` and `fixed` positioning
    // both stay correct — `body` and `ionic` resize an element instead and
    // leave viewport units pointing at the full screen. Every method on this
    // plugin except the listeners is iOS-only; Android's equivalent is the
    // window inset handling described at the top of this file.
    void Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {});
    // The iOS accessory bar is a grey strip of prev/next/Done above the keys.
    // It steals ~44pt on the screens that can least afford it and duplicates
    // navigation the forms already provide.
    void Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
  }

  // `will*` rather than `did*`: the bars should be out of the way before the
  // keyboard finishes animating in, not after it has covered them. On Android
  // the two fire within a frame of each other anyway.
  void Keyboard.addListener('keyboardWillShow', (info) => {
    publish({ open: true, height: info.keyboardHeight });
  });
  void Keyboard.addListener('keyboardWillHide', () => {
    publish(CLOSED);
  });
}

/** Subscribe to keyboard visibility. Returns the unsubscribe. */
export function subscribeKeyboard(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The last known keyboard state. Synchronous, and `CLOSED` on the web. */
export function getKeyboardState(): KeyboardState {
  return state;
}

/** React binding for the full state. */
export function useKeyboardState(): KeyboardState {
  return useSyncExternalStore(subscribeKeyboard, getKeyboardState, getKeyboardState);
}

/**
 * Whether the on-screen keyboard is covering the bottom of the screen.
 *
 * The signal every fixed bottom bar in the app should be reading. Always false
 * in a browser.
 */
export function useKeyboardOpen(): boolean {
  return useKeyboardState().open;
}

/** Test seam. Not part of the app's surface. */
export function __resetKeyboardForTests(): void {
  listeners.clear();
  started = false;
  state = CLOSED;
}

/** Test seam: drive the store without a plugin. */
export function __publishKeyboardForTests(next: KeyboardState): void {
  publish(next);
}
