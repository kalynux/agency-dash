// geo-tracker's HTTP side — the reads that complement the live socket:
// the durable GPS trail (an agent's previous path) and road routing between the
// two shipment pins. See geo-tracker/api-doc/{gps-persistence,tracking-sessions,routing}.md
//
// Auth mirrors the socket's, and for the same reason: geo-tracker accepts the
// httpOnly `access_token` cookie the browser sends automatically on a same-site
// request (its CORS allows credentials), so on the web we send no token at all.
// The bearer is the override — for a genuinely cross-site geo-tracker, and for
// a native shell, which has no cookie to send at all (P4.6). There the token
// comes from `window.wiMallGetAccessToken`, which `platform/accessToken.ts`
// fills from the same store the rest of the auth layer uses.

import { useBearerAuth } from '@/platform/env';
import { ApiError, ERROR_CATEGORIES, type ErrorCategory } from '@/types/api';
import type {
  GeoPosition,
  RouteResult,
  TrackingCheckpoint,
  TrackingContext,
  TrackingEligibility,
} from '@/types/tracking.types';

declare global {
  interface Window {
    wiMallGetAccessToken?: () => string | null | Promise<string | null>;
  }
}

export const GEO_TRACKER_WS_URL =
  (import.meta.env.VITE_GEO_TRACKER_WS_URL as string | undefined) ?? 'ws://localhost:8090/ws/track';

const ENV_TOKEN = import.meta.env.VITE_GEO_TRACKER_TOKEN as string | undefined;

/**
 * geo-tracker's HTTP origin. Defaults to the WS URL's origin (they are the same
 * service on the same host), so a deploy that already points the socket
 * somewhere needs no second variable — `VITE_GEO_TRACKER_URL` overrides it when
 * the two are genuinely split.
 */
export const GEO_TRACKER_HTTP_URL = resolveHttpBase();

function resolveHttpBase(): string {
  const explicit = (import.meta.env.VITE_GEO_TRACKER_URL as string | undefined)?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  try {
    const ws = new URL(GEO_TRACKER_WS_URL);
    return `${ws.protocol === 'wss:' ? 'https:' : 'http:'}//${ws.host}`;
  } catch {
    return 'http://localhost:8090';
  }
}

/**
 * The bearer token for geo-tracker, when one is needed. `null` is the normal,
 * healthy answer in a same-site deploy — the cookie authenticates instead.
 */
export async function resolveGeoTrackerToken(): Promise<string | null> {
  if (typeof window !== 'undefined' && typeof window.wiMallGetAccessToken === 'function') {
    try {
      return (await window.wiMallGetAccessToken()) ?? null;
    } catch {
      return null;
    }
  }
  return ENV_TOKEN ?? null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await resolveGeoTrackerToken();
  let res: Response;
  try {
    res = await fetch(`${GEO_TRACKER_HTTP_URL}${path}`, {
      ...init,
      // Mirrors `authStrategy.credentials` for the main API (P4.6). On a device
      // there is no cookie to send and the bearer header above is the whole
      // credential, so `'include'` would only ask the WebView to attach cookies
      // cross-origin — which a native origin cannot do anyway, and which makes
      // geo-tracker's CORS answer stricter than it needs to be for no benefit.
      credentials: useBearerAuth ? 'omit' : 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    // geo-tracker being down costs the moving markers and nothing else — callers
    // degrade rather than fail the screen.
    throw new ApiError(0, 'GEO_TRACKER_UNREACHABLE', err instanceof Error ? err.message : 'Request failed');
  }

  if (!res.ok) {
    throw await geoTrackerError(res);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * geo-tracker now answers the same envelope as the main API — `{ success,
 * requestId, error: { code, message, statusCode, category } }` — where it used
 * to answer plain text via Go's `http.Error`. The text branch below is kept
 * because a proxy or a panic can still produce a non-JSON body, and because
 * `404` there means "not authorized OR no such agent" either way.
 *
 * `X-Request-ID` is set on every response; on a masked 5xx it is the only handle
 * anyone has. See geo-tracker/api-doc/errors/README.md.
 */
async function geoTrackerError(res: Response): Promise<ApiError> {
  const raw = await res.text().catch(() => '');
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // not JSON — fall through to the text branch
  }

  const error = (body.error ?? {}) as Record<string, unknown>;
  const requestId =
    (body.requestId as string) ?? res.headers.get('X-Request-ID') ?? undefined;
  const rawCategory = error.category;
  const category = (ERROR_CATEGORIES as readonly string[]).includes(rawCategory as string)
    ? (rawCategory as ErrorCategory)
    : undefined;

  return new ApiError(
    res.status,
    // Only synthesise a code when the service gave none — a real one resolves to
    // catalogued copy, `GEO_TRACKER_502` never can.
    (error.code as string) ?? `GEO_TRACKER_${res.status}`,
    (error.message as string) || raw.trim() || `Request failed with status ${res.status}`,
    error.details,
    requestId,
    category,
  );
}

export interface CheckpointQuery {
  /** Cap the result. Default 100, max 1000 server-side. */
  limit?: number;
  /** Scope to one delivery's whole trail — continuous across every reconnect. */
  shipment?: string;
  /** The same scope by the other key. */
  session?: string;
}

export const geoTrackerService = {
  /**
   * GET /tracking/sessions/:agentId/checkpoints — the agent's persisted GPS
   * trail, **newest first**. Callers that draw a path want it oldest→newest;
   * {@link toPath} does that conversion.
   *
   * These are temporary (retention-cleaned once the shipment ends) and
   * downsampled, so a trail is a shape, not every fix. An agent with no delivery
   * leaves no trail at all — an empty array is a normal answer.
   *
   * `404` means "not authorized to see this agent", deliberately
   * indistinguishable from "no such agent".
   *
   * ⚠ **On the WEB build this can answer `502` intermittently, and there is
   * nothing this app can do about it.** geo-tracker's HTTP middleware happily
   * authenticates us from the httpOnly `access_token` cookie — but this route
   * then forwards a token to jovi-mall to resolve which agents we may see, and
   * it reads that token **only from the `Authorization` header**
   * (`session/delivery/http/handler.go` → `bearerToken`, which does not look at
   * the cookie). Cookie-only, the forwarded token is empty, jovi-mall answers
   * `401`, and we get a `502` — not a `401`, not a `404`.
   *
   * It is intermittent rather than constant because the resolved permission set
   * is cached in Redis **keyed by user id, not by token** (`PERMISSION_CACHE_TTL`,
   * default 5 minutes). Our WebSocket handshake warms that entry, and
   * `useGeoTrackerSocket` re-handshakes every 10 minutes — so the cache is warm
   * for the first 5 minutes of each cycle and cold for the rest. The same call
   * works and then stops working with nothing changed.
   *
   * A browser cannot read an httpOnly cookie, so we cannot send the header the
   * doc asks for; the native build already does (`resolveGeoTrackerToken`). The
   * caller therefore degrades — `LiveTracking` drops the drawn path and keeps
   * the live markers. Open question with the backend: can `bearerToken` fall
   * back to the cookie the middleware beside it already reads?
   * See api-doc/geo-tracker/tracking-sessions.md § Authentication.
   */
  getCheckpoints(agentId: string, query: CheckpointQuery = {}): Promise<TrackingCheckpoint[]> {
    const params = new URLSearchParams();
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    if (query.shipment) params.set('shipment', query.shipment);
    if (query.session) params.set('session', query.session);
    const qs = params.toString();
    return request<TrackingCheckpoint[]>(
      `/tracking/sessions/${encodeURIComponent(agentId)}/checkpoints${qs ? `?${qs}` : ''}`,
    );
  },

  /**
   * GET /tracking/sessions/:agentId — the agent's tracking context: their
   * device, their connection, and one entry per delivery in flight.
   *
   * ROUTE-MAP.md calls this "the only way to tell a frozen marker's cause", and
   * that is the only thing this dashboard uses it for. The board says who to
   * draw and the socket says where they are; when the socket says nothing, this
   * is what turns "awaiting a position" into a sentence an operator can act on.
   *
   * ⚠ It carries a `position`, and this app deliberately ignores it. The board
   * omits positions for a reason — a last-known fix drawn on a live map is a
   * plausible-looking marker that stopped moving. Nothing here changes that:
   * positions come only from the socket.
   *
   * **Degrades exactly like {@link getCheckpoints}, and for the identical
   * reason** — see its note on the cookie-only `502`. This route runs the same
   * `bearerToken` path, so on the web build it is unreliable in the same
   * intermittent way, and a failure must cost the *explanation* and nothing
   * else. {@link useStallDiagnosis} catches, calls
   * {@link warnGeoTrackerDegraded}, and the card says it could not find out
   * rather than blanking.
   */
  getSession(agentId: string): Promise<TrackingContext> {
    return request<TrackingContext>(`/tracking/sessions/${encodeURIComponent(agentId)}`);
  },

  /**
   * GET /tracking/sessions/:agentId/eligibility — whether the agent's device
   * configuration currently permits tracking, with **every** failing rule
   * listed rather than just the first.
   *
   * Deliberately fetched alongside {@link getSession} rather than instead of it:
   * this answers "is the device configured to allow tracking", and its `eligible:
   * true` includes the device that has never said anything at all. Only the
   * context's `device.lastSeenAt` separates that silence from a healthy phone.
   *
   * Same `502` caveat and the same degradation as {@link getSession}.
   */
  getEligibility(agentId: string): Promise<TrackingEligibility> {
    return request<TrackingEligibility>(
      `/tracking/sessions/${encodeURIComponent(agentId)}/eligibility`,
    );
  },

  /**
   * POST /routing/route — the road line between the two shipment pins. Optional
   * by design: without it a straight line between the pins is a reasonable
   * fallback, which is exactly what the map draws when this fails.
   */
  getRoute(origin: GeoPosition, destination: GeoPosition): Promise<RouteResult> {
    return request<RouteResult>('/routing/route', {
      method: 'POST',
      body: JSON.stringify({ origin, destination }),
    });
  },
};

/**
 * Report a geo-tracker read that failed and was degraded around.
 *
 * Every caller of this service swallows its errors on purpose — a missing trail
 * or road line must not take the map down. The cost of that is a screen whose
 * *degraded* state and whose *healthy* state look almost identical: a dashed
 * corridor is what you get both when routing is unavailable and when nobody ever
 * asked for it. So the swallow is never silent — one line naming the code and
 * the requestId turns "why is the line dashed" into a lookup in geo-tracker's
 * log rather than a bisect through two services.
 */
export function warnGeoTrackerDegraded(what: string, cause: unknown): void {
  const detail =
    cause instanceof ApiError
      ? { status: cause.status, code: cause.code, message: cause.message, requestId: cause.requestId }
      : cause;
  console.warn(`[geo-tracker] ${what} unavailable — degrading`, detail);
}

/** Checkpoints (newest first) → a drawable path (oldest→newest). */
export function toPath(checkpoints: TrackingCheckpoint[]): GeoPosition[] {
  return checkpoints
    .slice()
    .reverse()
    .map((c) => ({ latitude: c.lat, longitude: c.lng }));
}
