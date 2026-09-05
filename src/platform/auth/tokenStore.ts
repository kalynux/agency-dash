/**
 * Where the bearer (mobile) transport keeps its token pair.
 *
 * The interface is the point: Phase 1 shipped two throwaway implementations so
 * the bearer path could be exercised in a browser, and Phase 2 (P2.4) dropped in
 * a Keychain / Keystore-backed one without touching a single caller.
 *
 * On the cookie transport there is nothing to store — the browser holds httpOnly
 * cookies we cannot read and do not need to — so the web store is a no-op rather
 * than a special case at every call site.
 *
 * The shape, the receipt-time stamp and the guards live in `./tokens`; this file
 * re-exports them so every existing import site still resolves here.
 *
 * See CAPACITOR-PLAN.md → P1.5, P2.4.
 */
import type { AuthTokens } from '@/types/api';
import { forceMobileAuth, isNative } from '../env';
import { secureTokenStore } from './secureTokenStore';
import { isUsableTokens, stampExpiry, type StoredTokens, type TokenStore } from './tokens';

export {
  isUsableTokens,
  isUsableWireTokens,
  stampExpiry,
  type StoredTokens,
  type TokenStore,
} from './tokens';

/**
 * Cookie transport: there are no tokens to hold. Every method is a no-op so the
 * auth code path is identical in both modes — the alternative is an `if` in
 * every place a response might carry tokens.
 */
export const noopTokenStore: TokenStore = {
  get: async () => null,
  set: async () => {},
  clear: async () => {},
};

// ─── Dev store (VITE_FORCE_MOBILE_AUTH) ───────────────────────────────────────

const DEV_STORAGE_KEY = 'wi-agency:dev-tokens';

let cached: StoredTokens | null = null;
let hydrated = false;

/**
 * Read-through cache over `sessionStorage`, for the dev force-mobile path only.
 *
 * In memory because the hot path — an `Authorization` header on every request —
 * must not await storage. Mirrored to `sessionStorage` because without it every
 * page reload and every HMR full-refresh signs you out, which makes the fastest
 * testing route we have miserable to actually use.
 *
 * This is **not** the native store and must never become it: `sessionStorage` is
 * plaintext, and a 30-day refresh token in plaintext is a standing session for
 * anyone who finds it. It is reachable only when `VITE_FORCE_MOBILE_AUTH=true`,
 * which itself is gated on `import.meta.env.DEV` and folds away in a production
 * build. On device, `secureTokenStore` is selected instead.
 */
export const devTokenStore: TokenStore = {
  async get() {
    if (!hydrated) {
      hydrated = true;
      cached = null;
      try {
        const raw = sessionStorage.getItem(DEV_STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        // Validated, not cast: JSON.parse throws on malformed text but accepts
        // any well-formed shape, so the `as StoredTokens` that would go here is
        // a lie the request path pays for. See isUsableTokens.
        if (isUsableTokens(parsed)) cached = parsed;
      } catch {
        // Unreadable storage (private mode) or malformed text — start clean.
      }
    }
    return cached;
  },

  async set(tokens: AuthTokens) {
    cached = stampExpiry(tokens);
    hydrated = true;
    try {
      sessionStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(cached));
    } catch {
      // Memory-only is still a working session for the rest of this tab's life.
    }
  },

  async clear() {
    cached = null;
    hydrated = true;
    try {
      sessionStorage.removeItem(DEV_STORAGE_KEY);
    } catch {
      // nothing to do
    }
  },
};

/**
 * The store the app actually uses.
 *
 * Note the order: `isNative` wins over `forceMobileAuth`. The dev flag exists to
 * move the *transport* in a browser, and on a device the transport is already
 * bearer — so a stale flag must never be able to downgrade a real install from
 * the Keystore to `sessionStorage`.
 */
export const tokenStore: TokenStore = isNative
  ? secureTokenStore
  : forceMobileAuth
    ? devTokenStore
    : noopTokenStore;
