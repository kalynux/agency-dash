import { useCallback, useEffect, useRef, useState } from 'react';
import { GEO_TRACKER_WS_URL, resolveGeoTrackerToken } from '@/services/geo-tracker.service';
import type { AgentLiveFix, GeoPosition, LocationBroadcast, TrackingSocketStatus } from '@/types/tracking.types';

/**
 * Auth for the geo-tracker WS mirrors the HTTP side's `credentials: 'include'`:
 * the browser automatically forwards the httpOnly `access_token` cookie on the
 * WebSocket handshake whenever the target is same-site (e.g. localhost:8090 from
 * localhost:5174 — cookies ignore port, and the cookie is SameSite=Lax). So by
 * default we connect WITHOUT a token and let the cookie authenticate us.
 *
 * The `bearer` subprotocol token is only an OVERRIDE for cases where the cookie
 * won't be sent — a genuinely cross-site geo-tracker in production.
 */

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;
/** Max recent positions kept per agent for the map trail (older ones are dropped). */
const MAX_TRAIL = 60;

interface Frame {
  type: string;
  payload?: unknown;
}

/**
 * Error frames carry a machine `code` as well as a message. They stay non-fatal
 * — the connection is never closed for one — and they are best-effort: the
 * outbound buffer drops when full and frames are throttled to roughly one per
 * five seconds, so never require one to arrive.
 * See geo-tracker/api-doc/errors/README.md.
 */
export interface GeoTrackerErrorFrame {
  code?: string;
  message?: string;
}

/**
 * A subscribe this viewer is not allowed to make. The board decides who is
 * watchable, so this means our board is stale rather than that we should stop.
 */
const NOT_AUTHORIZED = 'TRACKING_NOT_AUTHORIZED';

export interface GeoTrackerSocket {
  status: TrackingSocketStatus;
  /** Latest fix per agentId. */
  fixes: Record<string, AgentLiveFix>;
  /** Recent positions per agentId (oldest→newest), for drawing a movement trail. */
  trails: Record<string, GeoPosition[]>;
  /** Agents whose subscription the server revoked (shipment finished, etc.). */
  revoked: Set<string>;
  /**
   * Timestamp of the last `permission_revoked` frame, or `null`. A revocation
   * means the *board* changed (a shipment finished, or a reassignment released
   * the agent), so it is the one signal worth refetching it on.
   */
  revokedAt: number | null;
  /** The most recent `error` frame, or `null`. Advisory — never fatal. */
  lastError: GeoTrackerErrorFrame | null;
  reconnect: () => void;
}

/** Stable key for a destination, so a re-subscribe fires only on a real change. */
function destKey(dest?: GeoPosition | null): string {
  return dest ? `${dest.latitude},${dest.longitude}` : '';
}

/**
 * Connects to geo-tracker as a viewer and subscribes to `agentIds`, exposing the
 * latest live fix per agent. Handles ack/error/permission_revoked, resubscribes
 * when `agentIds` changes, and reconnects with capped backoff.
 *
 * `destinations` opts an agent's broadcasts into live ETA/distance: supply the
 * selected shipment's drop-off and every `location_broadcast` for that agent is
 * enriched with `etaSeconds`/`distanceMeters`. The destination is per
 * (connection, agent) and is not persisted server-side, so it is re-sent on
 * every reconnect — which this hook does automatically.
 */
export function useGeoTrackerSocket(
  agentIds: string[],
  destinations: Record<string, GeoPosition> = {},
): GeoTrackerSocket {
  const [status, setStatus] = useState<TrackingSocketStatus>('idle');
  const [fixes, setFixes] = useState<Record<string, AgentLiveFix>>({});
  const [trails, setTrails] = useState<Record<string, GeoPosition[]>>({});
  const [revoked, setRevoked] = useState<Set<string>>(new Set());
  const [revokedAt, setRevokedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<GeoTrackerErrorFrame | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  /** agentId → the destination key currently subscribed with. */
  const subscribedRef = useRef<Map<string, string>>(new Map());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  const manualCloseRef = useRef(false);
  // Latest desired agent set / destinations, read by onopen without re-triggering connect.
  const desiredRef = useRef<string[]>(agentIds);
  desiredRef.current = agentIds;
  const destinationsRef = useRef<Record<string, GeoPosition>>(destinations);
  destinationsRef.current = destinations;

  const send = (frame: Frame) => {
    const s = socketRef.current;
    if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify(frame));
  };

  const syncSubscriptions = useCallback(() => {
    const s = socketRef.current;
    if (!s || s.readyState !== WebSocket.OPEN) return;
    const desired = new Set(desiredRef.current);
    const dests = destinationsRef.current;

    for (const id of desired) {
      const wanted = destKey(dests[id]);
      const current = subscribedRef.current.get(id);
      if (current === wanted) continue;
      // A `subscribe` carrying no destination does NOT clear one already stored
      // for this (connection, agent), so any change goes through unsubscribe.
      if (current !== undefined) send({ type: 'unsubscribe', payload: { agentId: id } });
      send({
        type: 'subscribe',
        payload: { agentId: id, ...(dests[id] ? { destination: dests[id] } : {}) },
      });
      subscribedRef.current.set(id, wanted);
    }

    for (const id of [...subscribedRef.current.keys()]) {
      if (!desired.has(id)) {
        send({ type: 'unsubscribe', payload: { agentId: id } });
        subscribedRef.current.delete(id);
      }
    }
  }, []);

  const scheduleReconnect = useCallback((connect: () => void) => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** attemptRef.current, RECONNECT_MAX_MS);
    attemptRef.current += 1;
    reconnectTimer.current = setTimeout(() => {
      if (mountedRef.current) connect();
    }, delay);
  }, []);

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;
    if (desiredRef.current.length === 0) {
      setStatus('idle');
      return;
    }
    // Prefer an explicit token (works cross-origin); otherwise connect on the
    // cookie the browser forwards automatically (same-site), like fetch's
    // credentials: 'include'.
    const token = await resolveGeoTrackerToken();
    if (!mountedRef.current) return;

    setStatus('connecting');
    manualCloseRef.current = false;
    let ws: WebSocket;
    try {
      ws = token ? new WebSocket(GEO_TRACKER_WS_URL, ['bearer', token]) : new WebSocket(GEO_TRACKER_WS_URL);
    } catch {
      setStatus('error');
      scheduleReconnect(() => void connect());
      return;
    }
    socketRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      attemptRef.current = 0;
      setStatus('open');
      // A fresh connection holds no subscriptions and no destinations.
      subscribedRef.current = new Map();
      syncSubscriptions();
    };

    ws.onmessage = (event) => {
      let frame: Frame;
      try {
        frame = JSON.parse(event.data as string) as Frame;
      } catch {
        return;
      }
      if (frame.type === 'location_broadcast') {
        const b = frame.payload as LocationBroadcast;
        if (!b?.agentId || !b.position) return;
        setFixes((prev) => ({ ...prev, [b.agentId]: { ...b, receivedAt: Date.now() } }));
        setTrails((prev) => {
          const path = prev[b.agentId] ?? [];
          const last = path[path.length - 1];
          // Skip a duplicate of the last point so a stationary agent doesn't bloat the trail.
          if (last && last.latitude === b.position.latitude && last.longitude === b.position.longitude) {
            return prev;
          }
          const next = [...path, b.position];
          if (next.length > MAX_TRAIL) next.splice(0, next.length - MAX_TRAIL);
          return { ...prev, [b.agentId]: next };
        });
      } else if (frame.type === 'permission_revoked') {
        const p = frame.payload as { agentId: string };
        if (!p?.agentId) return;
        subscribedRef.current.delete(p.agentId);
        setFixes((prev) => {
          const next = { ...prev };
          delete next[p.agentId];
          return next;
        });
        setTrails((prev) => {
          if (!(p.agentId in prev)) return prev;
          const next = { ...prev };
          delete next[p.agentId];
          return next;
        });
        setRevoked((prev) => new Set(prev).add(p.agentId));
        setRevokedAt(Date.now());
      } else if (frame.type === 'error') {
        const e = (frame.payload ?? {}) as GeoTrackerErrorFrame & { agentId?: string };
        setLastError({ code: e.code, message: e.message });
        // A refused subscribe would otherwise sit in `subscribedRef` forever,
        // looking subscribed — so drop it and let `syncSubscriptions` re-issue
        // it once the board says the agent is watchable again. The rest of the
        // catalog is the publishing agent's problem, not a viewer's.
        if (e.code === NOT_AUTHORIZED && e.agentId) {
          subscribedRef.current.delete(e.agentId);
        }
      }
      // ack frames are non-fatal; nothing to do.
    };

    ws.onerror = () => {
      if (mountedRef.current) setStatus('error');
    };

    ws.onclose = () => {
      socketRef.current = null;
      subscribedRef.current = new Map();
      if (!mountedRef.current || manualCloseRef.current) {
        setStatus('closed');
        return;
      }
      setStatus('closed');
      scheduleReconnect(() => void connect());
    };
  }, [scheduleReconnect, syncSubscriptions]);

  const reconnect = useCallback(() => {
    attemptRef.current = 0;
    setRevoked(new Set());
    setLastError(null);
    if (socketRef.current) {
      manualCloseRef.current = true;
      socketRef.current.close();
    }
    void connect();
  }, [connect]);

  // Connect on mount / when we first have agents.
  useEffect(() => {
    mountedRef.current = true;
    void connect();
    return () => {
      mountedRef.current = false;
      manualCloseRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resubscribe when the desired agent set — or a selected shipment's
  // destination — changes (while open).
  const subscriptionKey = agentIds
    .map((id) => `${id}:${destKey(destinations[id])}`)
    .join(',');
  useEffect(() => {
    syncSubscriptions();
    // If we had no agents before and now do, (re)connect.
    if (agentIds.length > 0 && !socketRef.current && status !== 'connecting') {
      void connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionKey]);

  return { status, fixes, trails, revoked, revokedAt, lastError, reconnect };
}
