import { useEffect, useLayoutEffect, useRef } from 'react';
import { onAppResume } from '@/platform/shell/appState';

/** Coming back twice within this window re-uses the first refresh. */
const MIN_INTERVAL_MS = 10_000;

/**
 * Re-run `refresh` each time the user comes back to the screen — the tab becomes
 * visible, the window regains focus, or (packaged app) the app returns to the
 * foreground.
 *
 * For lists that change with **no notification to announce it**: a ticket this
 * agency is added to simply appears, so the only way to see it is to look again.
 *
 * `visibilitychange` and `focus` usually fire together, so calls are throttled;
 * `refresh` is read from a ref and need not be memoised. It should not flash a
 * loading state — the user did not ask for anything.
 */
export function useRefreshOnFocus(refresh: () => unknown, enabled = true): void {
  const refreshRef = useRef(refresh);
  useLayoutEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();

    const run = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - last < MIN_INTERVAL_MS) return;
      last = now;
      void refreshRef.current();
    };

    document.addEventListener('visibilitychange', run);
    window.addEventListener('focus', run);
    const offResume = onAppResume(run);
    return () => {
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('focus', run);
      offResume();
    };
  }, [enabled]);
}
