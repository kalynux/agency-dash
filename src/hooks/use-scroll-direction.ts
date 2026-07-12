import * as React from 'react';

export type ScrollDirection = 'up' | 'down';

/**
 * Tracks the vertical scroll direction of the window with hysteresis.
 *
 * The direction only flips after *sustained* movement of at least `threshold`
 * px in one direction — single-sample jitter / momentum wobble during a scroll
 * won't toggle it. At/near the top the direction is always `'up'` so the
 * subheader is visible there.
 */
export function useScrollDirection(threshold = 10): ScrollDirection {
  const [direction, setDirection] = React.useState<ScrollDirection>('up');
  const lastY = React.useRef(0);
  const accum = React.useRef(0);
  const ticking = React.useRef(false);

  React.useEffect(() => {
    lastY.current = Math.max(0, window.scrollY);

    const update = () => {
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY.current;
      lastY.current = y;
      ticking.current = false;

      if (y <= 0) {
        accum.current = 0;
        setDirection('up');
        return;
      }

      if ((delta > 0 && accum.current < 0) || (delta < 0 && accum.current > 0)) {
        accum.current = 0;
      }
      accum.current += delta;

      if (accum.current > threshold) {
        accum.current = 0;
        setDirection('down');
      } else if (accum.current < -threshold) {
        accum.current = 0;
        setDirection('up');
      }
    };

    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return direction;
}
