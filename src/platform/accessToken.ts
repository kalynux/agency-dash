/**
 * The access token, for the one service that is not behind `api.ts`
 * (CAPACITOR-PLAN.md → P4.6).
 *
 * geo-tracker is a separate service with its own HTTP client and its own
 * WebSocket, and both already know how to ask for a token: they call
 * `window.wiMallGetAccessToken`, a seam that has existed since the tracking
 * feature landed and has returned null ever since, because on the web the
 * `access_token` cookie authenticates them and no token is needed.
 *
 * On a device there is no cookie. This module fills the seam from the same token
 * store the rest of the auth layer uses, which is all that was ever missing —
 * `geo-tracker.service.ts` puts it in an `Authorization` header and
 * `useGeoTrackerSocket` passes it as the `['bearer', token]` subprotocol.
 *
 * Installed only on the bearer transport. On the cookie transport the seam stays
 * absent, `resolveGeoTrackerToken()` keeps falling through to its
 * `VITE_GEO_TRACKER_TOKEN` escape hatch, and the web build is untouched.
 */
import { refreshSession } from './auth/refreshScheduler';
import { tokenStore } from './auth/tokenStore';
import { useBearerAuth } from './env';

/**
 * Refresh rather than hand out a token with less than this left on it.
 *
 * The cost of being wrong here is asymmetric. A token handed to `api.ts` with
 * two seconds left produces one 401 and one transparent retry. The same token
 * handed to a WebSocket handshake is captured by geo-tracker for the life of the
 * connection, and when it re-checks on the next shipment event the subscription
 * is dropped — reported, misleadingly, as `shipment_completed`.
 */
const NEAR_EXPIRY_MS = 60_000;

/**
 * A usable access token, or null when there is no session.
 *
 * Never throws: geo-tracker being unauthenticated costs the moving markers and
 * nothing else, and every caller here already treats null as "connect on the
 * cookie instead".
 */
export async function getAccessToken(): Promise<string | null> {
  if (!useBearerAuth) return null;

  const tokens = await tokenStore.get();
  if (!tokens) return null;
  if (Date.now() < tokens.accessExpiresAt - NEAR_EXPIRY_MS) return tokens.accessToken;

  try {
    // The shared single-flight lock (P2.5) — this coalesces onto whatever the
    // scheduler or a 401 already has in flight rather than racing it for the
    // refresh token.
    await refreshSession();
    return (await tokenStore.get())?.accessToken ?? null;
  } catch (err) {
    // Hand back what we have. A nearly-expired token still opens a connection
    // that works for a while, which beats no map at all, and the request path
    // owns the verdict on whether this session is actually over.
    console.warn('[tracking] could not refresh before handing out an access token', err);
    return tokens.accessToken;
  }
}

if (typeof window !== 'undefined' && useBearerAuth) {
  window.wiMallGetAccessToken = getAccessToken;
}
