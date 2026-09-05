import * as React from 'react';

/**
 * Horizontal swipe-to-navigate, for phones.
 *
 * Returns touch handlers to spread onto the element that owns the gesture. It
 * reports a swipe only when the movement is unambiguously a deliberate
 * horizontal flick, because everything else a finger does on these screens —
 * scrolling a list, panning a map, dragging a table sideways, pinching, and
 * above all the system's own back gesture — starts out looking the same.
 *
 * ### The system back gesture comes first
 *
 * Android's gesture navigation (and iOS's interactive pop) claims drags that
 * begin at either edge of the screen. Most of the time the OS swallows those
 * before the WebView sees them, but the boundary is device-specific and
 * user-configurable, and a page that acts on the ones that do leak through
 * turns "go back" into "change tab" — on the gesture people use most.
 *
 * So a touch that STARTS within {@link EDGE_INSET_PX} of either edge is not a
 * swipe here, at all. That inset is deliberately wider than Android's largest
 * configurable back-gesture zone (40dp): the cost of ignoring a gesture that
 * began at the very edge is that the user repeats it an inch inward, and the
 * cost of not ignoring it is that back stops working.
 */

/**
 * Dead zone at each edge, in CSS pixels. Wider than Android's maximum
 * back-gesture inset — see the note above.
 */
const EDGE_INSET_PX = 44;

/** Minimum horizontal travel before a drag counts as a swipe. */
const MIN_DISTANCE_PX = 60;

/**
 * How straight the swipe has to be: vertical travel may be at most this
 * fraction of the horizontal. A list being scrolled with a slight sideways
 * wobble must never register.
 */
const MAX_OFF_AXIS_RATIO = 0.6;

/**
 * Longest a swipe may take. Past this the finger was doing something else —
 * dragging a slider, holding a row, deciding — and a navigation would be a
 * surprise rather than the thing it was asked for.
 */
const MAX_DURATION_MS = 700;

/** Marks a subtree that owns its own horizontal gestures (a map, a carousel). */
const OPT_OUT_ATTRIBUTE = 'data-no-swipe';

/**
 * Whether a touch began in the strip either edge reserves for the system's back
 * gesture. Pure and exported for the tests — it is the one rule here that, if it
 * ever regressed, would break navigating back rather than merely failing to
 * navigate forward.
 */
export function isEdgeStart(clientX: number, viewportWidth: number): boolean {
  return clientX <= EDGE_INSET_PX || clientX >= viewportWidth - EDGE_INSET_PX;
}

/**
 * Which way a completed drag counts as a swipe, or `null` when it was not one.
 *
 * `rtl` mirrors the answer, because the gesture follows the text: in Arabic a
 * page turns the other way. Pure, and the whole of the geometry — everything
 * else the hook does is DOM.
 */
export function swipeDirection(
  { dx, dy, durationMs }: { dx: number; dy: number; durationMs: number },
  rtl = false,
): 'next' | 'previous' | null {
  if (durationMs > MAX_DURATION_MS) return null;
  if (Math.abs(dx) < MIN_DISTANCE_PX) return null;
  if (Math.abs(dy) > Math.abs(dx) * MAX_OFF_AXIS_RATIO) return null;
  const forward = rtl ? dx > 0 : dx < 0;
  return forward ? 'next' : 'previous';
}

export interface SwipeNavigationOptions {
  /**
   * A swipe toward the START of the reading direction — right-to-left in
   * English — which means "forward", the same way a page turns.
   *
   * Return `true` if it was acted on. Anything else lets the gesture bubble to
   * an outer handler, which is how a tabbed page hands a swipe past its last
   * tab up to the surrounding section navigation instead of eating it.
   */
  onNext?: () => boolean | void;
  /** The mirror of {@link onNext} — a swipe back toward where you came from. */
  onPrevious?: () => boolean | void;
  /** Off by default-ish: pass `false` to leave the gesture inert (desktop). */
  enabled?: boolean;
}

/**
 * Whether the gesture began somewhere that is already using horizontal drags.
 *
 * Walks from the touched node to the handler's element looking for two things:
 * an explicit {@link OPT_OUT_ATTRIBUTE}, and any box that is scrolled
 * horizontally and still has room to move in the direction being dragged. The
 * second is what keeps a wide table draggable — the app's listings scroll
 * sideways, and stealing that to change tab would make the right-hand columns
 * unreachable.
 */
function claimedByContent(target: EventTarget | null, container: Element, dx: number): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== container.parentElement) {
    if (node.hasAttribute?.(OPT_OUT_ATTRIBUTE)) return true;

    const scrollable = node.scrollWidth - node.clientWidth > 1;
    if (scrollable) {
      const maxScroll = node.scrollWidth - node.clientWidth;
      // `dx < 0` is a leftward drag, which scrolls content toward its end.
      const roomLeft = dx < 0 ? node.scrollLeft < maxScroll - 1 : node.scrollLeft > 1;
      if (roomLeft) return true;
    }
    node = node.parentElement;
  }
  return false;
}

/** `true` when the document is laid out right-to-left, which mirrors next/previous. */
function isRtl(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
}

export function useSwipeNavigation({
  onNext,
  onPrevious,
  enabled = true,
}: SwipeNavigationOptions) {
  // A ref, not state: nothing here should re-render a page mid-drag.
  const start = React.useRef<{ x: number; y: number; at: number } | null>(null);

  const onTouchStart = React.useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      if (!enabled) return;
      // More than one finger is a pinch or a two-finger scroll, never this.
      if (event.touches.length !== 1) {
        start.current = null;
        return;
      }
      const touch = event.touches[0];
      if (isEdgeStart(touch.clientX, window.innerWidth)) {
        // The system's gesture. Leave it alone — see the note at the top.
        start.current = null;
        return;
      }
      start.current = { x: touch.clientX, y: touch.clientY, at: Date.now() };
    },
    [enabled],
  );

  const onTouchMove = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
    // A second finger arriving mid-drag cancels it, rather than letting the
    // first finger's displacement be read as a flick when the gesture ends.
    if (event.touches.length !== 1) start.current = null;
  }, []);

  const onTouchEnd = React.useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      const origin = start.current;
      start.current = null;
      if (!enabled || !origin) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;

      const direction = swipeDirection(
        { dx, dy, durationMs: Date.now() - origin.at },
        isRtl(),
      );
      if (!direction) return;
      if (claimedByContent(event.target, event.currentTarget, dx)) return;

      const handled = direction === 'next' ? onNext?.() : onPrevious?.();

      // Only a handled swipe is consumed. An unhandled one bubbles, so an outer
      // handler gets its turn — see `onNext`.
      if (handled === true) event.stopPropagation();
    },
    [enabled, onNext, onPrevious],
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}
