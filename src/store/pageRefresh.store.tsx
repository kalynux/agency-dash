import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * The reload icon beside every page title, and how a page fills it.
 *
 * WHY A REGISTRY AND NOT A PROP. The header belongs to the page, but the request
 * a reload re-runs usually belongs to something below it — a tab (Agents, Cash,
 * Vendors), or several independent cards on one screen (Payout's earnings card
 * *and* its payout form). Threading a callback up from each of them would mean
 * lifting every tab's loading state into its page. Instead, whatever owns a
 * request calls `usePageRefresh(load, isLoading)`, and the header asks the
 * registry whether anything on screen can be reloaded.
 *
 * One tap re-runs every registered source; the icon spins while any of them is
 * in flight. A screen that registers nothing — a settings form, where a reload
 * would silently throw away an edit — simply gets no icon.
 */

interface Source {
  run: () => void;
  busy: boolean;
}

interface Registry {
  set: (id: string, source: Source) => void;
  remove: (id: string) => void;
}

export interface PageRefreshState {
  refresh: () => void;
  busy: boolean;
}

const RegistryContext = createContext<Registry | null>(null);
const StateContext = createContext<PageRefreshState | null>(null);

/**
 * Mounted once around the dashboard's routes. Two contexts on purpose: the
 * registry is stable, so a source registering does not re-run every other
 * source's effect; only the header reads the (changing) state.
 */
export function PageRefreshProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<ReadonlyMap<string, Source>>(() => new Map());

  const registry = useMemo<Registry>(
    () => ({
      set: (id, source) =>
        setSources((prev) => {
          const next = new Map(prev);
          next.set(id, source);
          return next;
        }),
      remove: (id) =>
        setSources((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Map(prev);
          next.delete(id);
          return next;
        }),
    }),
    [],
  );

  const refresh = useCallback(() => {
    for (const source of sources.values()) source.run();
  }, [sources]);

  const state = useMemo<PageRefreshState | null>(() => {
    if (sources.size === 0) return null;
    let busy = false;
    for (const source of sources.values()) busy ||= source.busy;
    return { refresh, busy };
  }, [sources, refresh]);

  return (
    <RegistryContext.Provider value={registry}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </RegistryContext.Provider>
  );
}

/**
 * Offer `load` to the page header's reload icon for as long as the caller is
 * mounted. Pass a falsy `load` to opt out conditionally (e.g. while a form has
 * unsaved edits). `load` is read from a ref, so it need not be memoised.
 */
export function usePageRefresh(
  load: (() => unknown) | null | undefined | false,
  busy = false,
): void {
  const registry = useContext(RegistryContext);
  const id = useId();
  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  });
  const enabled = Boolean(load);

  useEffect(() => {
    if (!registry || !enabled) return;
    registry.set(id, {
      run: () => {
        const fn = loadRef.current;
        if (fn) void fn();
      },
      busy,
    });
    return () => registry.remove(id);
  }, [registry, id, enabled, busy]);
}

/** What the header renders from: `null` when nothing on screen can reload. */
export function usePageRefreshState(): PageRefreshState | null {
  return useContext(StateContext);
}
