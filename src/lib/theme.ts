/**
 * Theme foundation — the single seam that puts the app into dark mode.
 *
 * Tailwind is configured with `darkMode: ["class"]`, so `.dark` must sit on an
 * ancestor of *everything* that reads a theme token. Two things make <html> the
 * only correct host:
 *
 *  1. `body` carries `bg-background text-foreground` (see index.css). Those
 *     resolve against whatever variables are in scope **at the body**, so a
 *     `.dark` further down the tree leaves the body — and every element that
 *     inherits its colour instead of setting one — painting light-mode
 *     near-black text onto the dark shell.
 *  2. Radix portals (dialog, select, dropdown, popover, tooltip, toast) mount
 *     into `document.body`, outside any in-tree wrapper. Only a class on <html>
 *     reaches them.
 *
 * `system` follows the OS and keeps following it while it stays selected, so
 * the listener below is registered for as long as the app is mounted.
 */

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'agency-dash:theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** The user's last choice, or `system` on first run. Safe before hydration. */
export function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : 'system';
  } catch {
    // Private mode / blocked storage — fall back to the OS preference.
    return 'system';
  }
}

export function storeTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Persistence is best-effort; the in-memory theme still applies.
  }
}

export function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches;
}

/** Collapse the tri-state preference to the two states the DOM can be in. */
export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme;
}

/**
 * Toggle `.dark` on <html> and keep `color-scheme` in step so native widgets —
 * scrollbars, `<select>` popups, date pickers, form autofill — follow the app
 * instead of staying stubbornly light.
 */
export function applyDocumentTheme(theme: Theme): ResolvedTheme {
  const resolved = resolveTheme(theme);
  if (typeof document !== 'undefined') {
    const el = document.documentElement;
    el.classList.toggle('dark', resolved === 'dark');
    el.style.colorScheme = resolved;
  }
  return resolved;
}

/**
 * Re-apply on OS preference changes. No-ops unless `system` is active; returns
 * an unsubscribe for effect cleanup.
 */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
