/**
 * The auth transport: one interface, two implementations, one selection.
 *
 * The backend did not add a marker header — **the route namespace is the
 * switch** (api-doc/auth/FRONTEND-CHANGELOG-mobile-auth.md §1.2). A browser
 * client posts to `/auth/login` and rides httpOnly cookies; a native client
 * posts to `/auth/mobile/login` and rides an `Authorization` header. Request
 * bodies and the non-`tokens` half of every response are byte-identical, so the
 * difference really is only these four questions:
 *
 *   what headers · what credentials mode · how to refresh · which paths
 *
 * Everything above this file — `api.ts`, the services, the stores, the screens —
 * asks the strategy and never asks the platform. That is the rule that keeps
 * `if (isNative)` out of the request path (CAPACITOR-PLAN.md ground rule 2).
 *
 * See CAPACITOR-PLAN.md → P1.2.
 */
import { ApiError, type AuthTokens } from '@/types/api';
import { BASE_URL, buildApiError } from '@/services/http';
import { useBearerAuth } from '../env';
import { isUsableWireTokens, tokenStore } from './tokenStore';

/**
 * The endpoint paths that differ between transports. Everything else —
 * `/auth/forgot-password`, `/auth/reset-password`, `/me/password`, and the whole
 * business API — lives in the base namespace and works unchanged from both.
 */
export interface AuthPaths {
  login: string;
  register: string;
  addRole: string;
  authMe: (role: string) => string;
}

export interface AuthStrategy {
  /** Which transport is active. For diagnostics and tests — never branch on it in app code. */
  readonly mode: 'cookie' | 'bearer';

  /** Headers to merge into every request. Empty on cookie, `Authorization` on bearer. */
  authHeaders(): Promise<Record<string, string>>;

  /** Whether `fetch` should send cookies. */
  readonly credentials: RequestCredentials;

  /** Perform a refresh. Throws `ApiError` on failure. */
  refresh(): Promise<void>;

  /**
   * Hand over a `tokens` envelope from any response that carried one (login,
   * register, add-role, auth-me, refresh). A no-op on cookie, so callers never
   * have to ask which mode they are in.
   */
  captureTokens(tokens: AuthTokens | undefined): Promise<void>;

  /**
   * Whether it is worth asking the server who we are on launch. Cookie mode
   * cannot see its own httpOnly cookies, so the only way to know is to ask;
   * bearer mode knows for free and skips a doomed round trip (P1.11).
   */
  canAttemptSession(): Promise<boolean>;

  /**
   * Destroy the session from this side. Cookie mode has to ask the server (only
   * it can clear an httpOnly cookie); bearer mode just forgets the tokens —
   * there is no server call to make.
   *
   * Best-effort by contract: it must never throw, because the caller is already
   * on its way to the login screen and has nothing useful to do with a failure.
   */
  endSession(): Promise<void>;

  /**
   * Whether `PATCH /me/password` hands this transport its replacement credential.
   *
   * The change revokes every token minted under the old password — including
   * the pair the request itself rode on — and re-issues a pair **as cookies
   * only**; the body carries no `tokens` (api-doc/me/password.md). So a cookie
   * client stays signed in, and a bearer client is refused with
   * `AUTH_PASSWORD_CHANGED` on its next request unless it signs in again with
   * the new password. `authService.changePassword` reads this to know which.
   */
  readonly reissuedOnPasswordChange: boolean;

  readonly paths: AuthPaths;
}

// ─── Cookie (web) ─────────────────────────────────────────────────────────────

const NO_HEADERS: Record<string, string> = {};

export const cookieAuthStrategy: AuthStrategy = {
  mode: 'cookie',

  async authHeaders() {
    return NO_HEADERS;
  },

  credentials: 'include',

  async refresh() {
    // NB: the endpoint is `/auth/browser/refresh` — there is no `/auth/refresh`.
    //
    // The whole `/auth/browser/*` namespace sits behind `requireJsonContent`, a
    // CSRF mitigation: without this header the answer is `400 VALIDATION_ERROR
    // — "Bad Request: Only JSON content is accepted"` and every silent refresh
    // fails. The header is the requirement; there is no body to send.
    // See api-doc/auth/README.md (POST /auth/browser/refresh).
    const res = await fetch(`${BASE_URL}/auth/browser/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw await buildApiError(res);
  },

  async captureTokens() {
    // Cookie endpoints never return a `tokens` key — the credential arrived in
    // `Set-Cookie` and is already installed. Nothing to do, deliberately.
  },

  async canAttemptSession() {
    // httpOnly cookies are invisible to script. "Do I have a session?" is only
    // answerable by asking the server, so always try.
    return true;
  },

  async endSession() {
    try {
      await fetch(`${BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // best-effort
    }
  },

  // The replacement pair arrives in `Set-Cookie` on the password change itself.
  reissuedOnPasswordChange: true,

  paths: {
    login: '/auth/login',
    register: '/auth/register',
    addRole: '/auth/add-role',
    authMe: (role) => `/auth/auth-me/${role}`,
  },
};

// ─── Bearer (native, and the VITE_FORCE_MOBILE_AUTH dev path) ─────────────────

export const bearerAuthStrategy: AuthStrategy = {
  mode: 'bearer',

  async authHeaders() {
    const tokens = await tokenStore.get();
    // No tokens yet is normal, not an error: login and register are themselves
    // unauthenticated requests. Sending nothing lets the server answer
    // `AUTH_MISSING_TOKEN`, which the caller already knows how to handle.
    return tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : NO_HEADERS;
  },

  // Not 'same-origin': under a custom Capacitor hostname every API call is
  // cross-origin, and sending credentials would make the CORS contract stricter
  // than it needs to be for a transport that carries no cookies at all.
  credentials: 'omit',

  async refresh() {
    const current = await tokenStore.get();
    if (!current) {
      // Nothing to present. Fail with the code the server would have used, so
      // the caller's error table (P1.4) needs no special case for "we never had
      // a token" versus "the server rejected the one we had".
      throw new ApiError(401, 'AUTH_MISSING_TOKEN', 'No refresh token stored');
    }

    const res = await fetch(`${BASE_URL}/auth/mobile/refresh`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      // The REFRESH token, not the access token. Posting the access token here
      // is refused with `AUTH_REFRESH_TOKEN_INVALID` — which is what that code
      // almost always means in development (§3 of the changelog).
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    if (!res.ok) throw await buildApiError(res);

    const body = (await res.json()) as { data?: { tokens?: unknown } };
    const tokens = body.data?.tokens;
    if (!isUsableWireTokens(tokens)) {
      // A 200 without a usable pair would otherwise leave us retrying forever on
      // the old, expired access token.
      throw new ApiError(401, 'REFRESH_FAILED', 'Refresh response carried no usable tokens');
    }

    // BOTH tokens, always. Refresh re-issues the refresh token at full lifetime,
    // and that re-issue is the entire sliding-window mechanism: keep the old one
    // and the session hard-expires 30 days after login instead of 30 days after
    // last use. See the changelog §1.4.
    //
    // Note also that success is the HTTP status, never a string comparison — a
    // JWT's `iat` is in whole seconds, so a refresh in the same second as the
    // last mint returns a byte-identical token. That is correct and means
    // nothing is wrong.
    await tokenStore.set(tokens);
  },

  async captureTokens(tokens) {
    if (tokens === undefined) return;
    if (!isUsableWireTokens(tokens)) {
      // Dropped rather than thrown: the caller has a live session in hand and no
      // useful recovery, while storing this would break the NEXT request instead
      // of this one. Loud because it can only mean the envelope changed shape.
      console.error('[auth] response carried an unusable tokens envelope — not stored', tokens);
      return;
    }
    await tokenStore.set(tokens);
  },

  async canAttemptSession() {
    return (await tokenStore.get()) !== null;
  },

  async endSession() {
    // No server call: the mobile namespace sets no cookie, so discarding the
    // pair IS the logout (changelog §3.6). Nothing can throw here.
    await tokenStore.clear();
  },

  // ⚠ The replacement pair is cookies-only, which this transport ignores — so a
  // password change revokes the pair this device holds and hands nothing back.
  reissuedOnPasswordChange: false,

  paths: {
    login: '/auth/mobile/login',
    register: '/auth/mobile/register',
    addRole: '/auth/mobile/add-role',
    authMe: (role) => `/auth/mobile/auth-me/${role}`,
  },
};

/**
 * The active transport. Resolved once at module load — the platform cannot
 * change under a running app, and a stable object keeps `api.ts` free of
 * per-request selection logic.
 */
export const authStrategy: AuthStrategy = useBearerAuth ? bearerAuthStrategy : cookieAuthStrategy;
