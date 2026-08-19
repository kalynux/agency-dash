// geo-tracker's HTTP side — the reads that complement the live socket:
// the durable GPS trail (an agent's previous path) and road routing between the
// two shipment pins. See geo-tracker/api-doc/{gps-persistence,tracking-sessions,routing}.md
//
// Auth mirrors the socket's, and for the same reason: geo-tracker accepts the
// httpOnly `access_token` cookie the browser sends automatically on a same-site
// request (its CORS allows credentials), so by default we send no token at all.
// The bearer is only an OVERRIDE for a genuinely cross-site geo-tracker.

import { ApiError, ERROR_CATEGORIES, type ErrorCategory } from '@/types/api';
import type { GeoPosition, RouteResult, TrackingCheckpoint } from '@/types/tracking.types';

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
      credentials: 'include',
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

/** Checkpoints (newest first) → a drawable path (oldest→newest). */
export function toPath(checkpoints: TrackingCheckpoint[]): GeoPosition[] {
  return checkpoints
    .slice()
    .reverse()
    .map((c) => ({ latitude: c.lat, longitude: c.lng }));
}
