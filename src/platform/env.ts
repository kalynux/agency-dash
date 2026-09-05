/**
 * Platform detection — the single source of truth for "are we running inside a
 * native shell?".
 *
 * `src/platform/` is the ONLY directory allowed to import `@capacitor/*`. Every
 * other module asks this file instead of sniffing `window`, the user agent, or
 * the URL scheme, so there is exactly one place to change when the shell changes.
 *
 * Phase 2 (P2.3) replaced the Phase 1 stubs with the real runtime. On the web
 * build `Capacitor.getPlatform()` answers `'web'` and `isNative` is `false`, so
 * the browser behaviour Phase 1 shipped is untouched — the web build stays the
 * control group (ground rule 3).
 *
 * See CAPACITOR-PLAN.md → P1.1, P2.3.
 */
import { Capacitor } from '@capacitor/core';

export type Platform = 'web' | 'android' | 'ios';

/**
 * The shell we are running in.
 *
 * `getPlatform()` is typed as `string` because a custom platform can be
 * registered; we narrow to the three we actually ship and treat anything else
 * as web, which is the conservative answer — an unknown platform gets browser
 * behaviour rather than reaching for plugins that may not be installed.
 */
export const platform: Platform = (() => {
  const p = Capacitor.getPlatform();
  return p === 'android' || p === 'ios' ? p : 'web';
})();

/**
 * Running inside a native (Capacitor) shell.
 *
 * This is the flag that gates real plugins — secure storage, push, keyboard,
 * status bar. It is deliberately NOT the flag the auth transport reads; see
 * {@link useBearerAuth}.
 */
export const isNative = Capacitor.isNativePlatform();

/**
 * Dev-only escape hatch: `VITE_FORCE_MOBILE_AUTH=true` makes the app talk to
 * `/api/auth/mobile/*` with bearer tokens from a desktop browser, without any
 * native tooling installed.
 *
 * This was the entire testing strategy for Phase 1 — the bearer transport had to
 * be provable before there was a device to prove it on — and it stays useful in
 * Phase 2 as the fast iteration loop, since a browser reload beats a `cap sync`
 * plus an install. It is gated on `import.meta.env.DEV`, which Vite inlines as
 * `false` in a production build, so the constant folds to `false` and the branch
 * is dropped from the bundle. A production deploy cannot be flipped into bearer
 * mode by an env var.
 */
export const forceMobileAuth =
  import.meta.env.DEV &&
  (import.meta.env.VITE_FORCE_MOBILE_AUTH as string | undefined)?.trim() === 'true';

/**
 * Whether the bearer (mobile) auth transport is active, as opposed to the
 * cookie one.
 *
 * This — not `isNative` — is what the auth layer branches on (P1.2, P1.3, P1.5),
 * because the dev override has to move the transport WITHOUT pretending a
 * Capacitor runtime exists: modules that gate real native plugins (push,
 * keyboard, status bar, secure storage) must keep reading `isNative`, or forcing
 * mobile auth in a browser would reach for plugins that aren't there.
 */
export const useBearerAuth = isNative || forceMobileAuth;

if (forceMobileAuth) {
  // Loud on purpose: this changes the transport for every request in the app,
  // and a stale flag in .env.development.local is otherwise invisible.
  console.info('[platform] VITE_FORCE_MOBILE_AUTH=true — using bearer auth (/api/auth/mobile/*)');
}
