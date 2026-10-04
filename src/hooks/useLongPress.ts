import * as React from 'react';

/** How long a finger must rest before it counts as a hold (Android's own is ~400–500ms). */
const HOLD_MS = 450;

/** Travel that turns a hold into a scroll — past this the finger is moving the list. */
const MOVE_TOLERANCE_PX = 10;

/**
 * Press-and-hold on touch, for phones. Returns handlers to spread onto the
 * element and a `consumeClick` guard for that element's own `onClick`.
 *
 * Touch only (`pointerType === 'touch'`): a mouse already has the checkbox and
 * a right-click, and a long mouse press is far more often a slow click.
 *
 * A hold ends in a `click` once the finger lifts, which would also run the
 * row's tap action (opening the detail sheet) right after selecting it, so the
 * click that follows a hold is swallowed: call `consumeClick()` first thing in
 * `onClick` and bail when it returns true.
 *
 * The browser's own long-press reactions — the text-selection handles and the
 * context menu / callout — are suppressed on the element, otherwise they pop
 * up at the same moment the row gets selected.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = React.useRef<number | null>(null);
  const origin = React.useRef<{ x: number; y: number } | null>(null);
  const fired = React.useRef(false);
  const callback = React.useRef(onLongPress);
  React.useEffect(() => {
    callback.current = onLongPress;
  }, [onLongPress]);

  const cancel = React.useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  React.useEffect(() => cancel, [cancel]);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch' || !e.isPrimary) return;
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        fired.current = true;
        try {
          navigator.vibrate?.(12);
        } catch {
          // Not allowed (no user activation yet, or a WebView without the permission).
        }
        callback.current();
      }, HOLD_MS);
    },
    [],
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      const start = origin.current;
      if (!start) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE_PX) cancel();
    },
    [cancel],
  );

  const consumeClick = React.useCallback(() => {
    if (!fired.current) return false;
    fired.current = false;
    return true;
  }, []);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu: (e: React.MouseEvent) => {
        // Android raises `contextmenu` on a long touch; a mouse right-click keeps its menu.
        if (fired.current || timer.current !== null) e.preventDefault();
      },
    },
    consumeClick,
  };
}
