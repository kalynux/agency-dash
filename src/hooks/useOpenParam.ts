// ─── `?open=<id>` — the deep-link record convention ───────────────────────────
//
// Every notification deep link that names a record resolves to a list screen
// plus `?open=<id>` (see `resolveDeepLink` in lib/notification-display.ts). The
// id lives in the URL rather than in component state so a pasted link, an
// emailed button and an in-app click all take exactly the same path — and so a
// deep link is shareable and survives a refresh.
//
// Extracted from the stock-request inbox, which established the convention, so
// the four screens the 2026-09-08 deep-link contract added behave identically.

import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface OpenParam {
  /** The deep-linked record id, or `null` when nothing is being opened. */
  openId: string | null;
  /** Point the URL at a record. Use this instead of local selection state. */
  open: (id: string) => void;
  /** Clear it, so a refresh does not reopen a sheet the user deliberately closed. */
  close: () => void;
}

export function useOpenParam(): OpenParam {
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get('open');

  // Both build a FRESH `URLSearchParams` rather than mutating the one
  // `useSearchParams` handed back — that object is shared across renders, so
  // mutating it edits state in place and a later read can see a change React
  // was never told about.
  const open = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams);
      params.set('open', id);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const close = useCallback(() => {
    if (!searchParams.has('open')) return;
    const params = new URLSearchParams(searchParams);
    params.delete('open');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  return { openId, open, close };
}

/**
 * The `?open=` treatment for a screen that has **no detail sheet** — the vendor
 * connections list and the COD deposit list, which are flat rows with inline
 * actions.
 *
 * Landing on the right tab is most of the fix (it used to be the Overview), but
 * "your agent declared a hand-over" pointed at a page of twenty hand-overs still
 * leaves the reader hunting. So scroll the named row into view and mark it.
 *
 * Give each row `id={rowDomId(prefix, record.id)}` and
 * `className={cn(..., highlighted === record.id && HIGHLIGHT_CLASS)}`.
 *
 * Silently does nothing when the row is not on the current page — a deep link
 * to something filtered out or on page 3 is a real case, and scrolling to
 * nothing is better than an error about it.
 */
export function useHighlightRow(prefix: string, openId: string | null): string | null {
  useEffect(() => {
    if (!openId) return;
    // After paint, so the row exists: these lists render asynchronously and the
    // element is not in the document on the tick the param arrives.
    const timer = setTimeout(() => {
      document
        .getElementById(rowDomId(prefix, openId))
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 150);
    return () => clearTimeout(timer);
  }, [prefix, openId]);

  return openId;
}

export function rowDomId(prefix: string, id: string): string {
  return `${prefix}-${id}`;
}

/** Ring applied to a deep-linked row. Matches the focus ring already in use. */
export const HIGHLIGHT_CLASS = 'ring-2 ring-primary ring-offset-2 ring-offset-background';
