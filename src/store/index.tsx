import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  applyDocumentTheme,
  prefersDark,
  readStoredTheme,
  storeTheme,
  watchSystemTheme,
  type ResolvedTheme,
  type Theme,
} from '@/lib/theme';

/**
 * The dashboard's only client-side store.
 *
 * Everything else reads the backend through a feature store under `src/store/`
 * (shipments, agents, notifications, …) or a service in `src/services/`. The
 * mock product/order/vendor/analytics/ticket/storage stores that used to live
 * here were removed once no screen read them any more.
 */
interface UIState {
  sidebarCollapsed: boolean;
  /** The user's preference, including `system`. Bind theme *pickers* to this. */
  theme: Theme;
  /**
   * What the DOM is actually showing. Components that branch on the theme
   * (e.g. the tracking map's basemap) must read this — `theme === 'dark'`
   * is false under `system` even when the OS is dark.
   */
  resolvedTheme: ResolvedTheme;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
}

const UIStoreContext = createContext<UIState | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  // The OS preference is the one piece of genuinely external state here, so it
  // is subscribed to and mirrored into React — never derived during render,
  // where `matchMedia` would make the component impure.
  const [systemDark, setSystemDark] = useState(prefersDark);
  useEffect(() => watchSystemTheme(() => setSystemDark(prefersDark())), []);

  // Pure derivation, so no effect writes it back into state.
  const resolvedTheme: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  // The `.dark` class belongs on <html>, not on a wrapper inside the tree — the
  // body's own `text-foreground`/`bg-background` and every Radix portal live
  // outside any in-tree wrapper. See lib/theme.ts. Depending on `resolvedTheme`
  // is what re-applies the class when the OS flips while `system` is selected.
  useEffect(() => {
    applyDocumentTheme(theme);
    storeTheme(theme);
  }, [theme, resolvedTheme]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  return (
    <UIStoreContext.Provider value={{
      sidebarCollapsed,
      theme,
      resolvedTheme,
      toggleSidebar,
      setTheme,
    }}>
      {children}
    </UIStoreContext.Provider>
  );
}

export function useUIStore() {
  const context = useContext(UIStoreContext);
  if (!context) throw new Error('useUIStore must be used within StoreProvider');
  return context;
}
