import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeNetworkRestored } from '@/platform/network';
import { GEO_TRACKER_WS_URL, resolveGeoTrackerToken } from '@/services/geo-tracker.service';
import {
  normalizeRevokeReason,
  revokeNeedsFreshToken,
  type AgentLiveFix,
  type GeoPosition,
  type LocationBroadcast,
  type PermissionRevoked,
  type TrackingRevokeReason,
  type TrackingSocketStatus,
} from '@/types/tracking.types';

/**
 * Auth for the geo-tracker WS mirrors the HTTP side's `credentials: 'include'`:
 * the browser automatically forwards the httpOnly `access_token` cookie on the
 * WebSocket handshake whenever the target is same-site (e.g. localhost:8090 from
 * localhost:5174 — cookies ignore port, and the cookie is SameSite=Lax). So by
 * default we connect WITHOUT a token and let the cookie authenticate us.
 *
 * The `bearer` subprotocol token is the OVERRIDE for cases where the cookie
 * won't be sent — a genuinely cross-site geo-tracker in production, and a native
 * shell, which has no cookie at all. On a device `platform/accessToken.ts` fills
 * `window.wiMallGetAccessToken` and this connects with the subprotocol instead
 * (CAPACITOR-PLAN.md → P4.6).
 */

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;
/** Max recent positions kept per agent for the map trail (older ones are dropped). */
const MAX_TRAIL = 60;

/**
 * How often to re-handshake, so the credential geo-tracker captured at connect
 * time cannot age out underneath a live subscription (CAPACITOR-PLAN.md → P4.6).
 *
 * A WebSocket authenticates **once**. geo-tracker keeps whatever it validated at
 * handshake and re-checks it on shipment lifecycle events — and when that check
 * fails on an aged-out token it drops the subscription with `permission_revoked`
 * and `reason: "shipment_completed"`. **That reason is not to be trusted**: the
 * shipment is usually fine, the token is not. From the user's side the map
 * simply stops moving.
 *
 * Access tokens live 900s, so this sits comfortably under the TTL. Reconnecting
 * is cheap — the session resumes and the subscriptions are re-sent by `onopen` —
 * which is why re-handshaking on a clock beats trying to detect the failure.
 *
 * This is not gated on the transport. The cookie build has the identical fault:
 * the browser attaches `access_token` to the handshake and never again, so a web
 * user watching one delivery for twenty minutes loses the subscription the same
 * way. It was always a bug; Phase 4 is just where it got found.
 */
const REHANDSHAKE_MS = 10 * 60 * 1000;

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
  /**
   * Agents whose subscription the server revoked, and **why**.
   *
   * ⚠ A revocation is NOT a statement that the delivery finished. Only
   * `shipment_completed` is; the other two mean the server could not confirm the
   * viewer and failed closed, and say nothing at all about the shipment. Read
   * the reason before writing any outcome into the UI — this map is keyed rather
   * than a bare `Set` precisely so that is impossible to skip.
   */
  revoked: Map<string, TrackingRevokeReason>;
  /**
   * Timestamp of the last `permission_revoked` frame, or `null`.
   *
   * Worth refetching the board on regardless of reason: on
   * `shipment_completed` the board genuinely changed, and on the other two the
   * board is the only thing that can say whether the row is still in flight.
   */
  revokedAt: number | null;
  /** The most recent `error` frame, or `null`. Advisory — never fatal. */
  lastError: GeoTrackerErrorFrame | null;
  reconnect: () => void;
}

/**
 * How this viewer's ETA target is chosen, per agent.
 *
 * The two fields are **alternatives, not a pair**, and `shipmentId` is the one
 * to prefer: the server resolves the drop-off from that shipment's own tracking
 * session, so we never hand a customer's coordinates to a second service.
 * `destination` is an override that nothing replaces for the life of the
 * subscription.
 *
 * Sending **neither** is now also fine and yields an ETA whenever the agent has
 * exactly one open session. With several deliveries in flight the server
 * declines rather than guessing — an ETA to the wrong address is worse than
 * none, because it is wrong in a way that looks right.
 *
 * See geo-tracker/tracking-websocket.md § How the destination is resolved.
 */
export interface TrackingScope {
  shipmentId?: string;
  destination?: GeoPosition;
}

/**
 * Stable key for a scope, so a re-subscribe fires only on a real change.
 *
 * Both fields participate: switching the selected shipment has to re-subscribe
 * even though the agent did not change, or the ETA keeps measuring to the
 * previous delivery.
 */
function scopeKey(scope?: TrackingScope | null): string {
  if (!scope) return '';
  const dest = scope.destination
    ? `${scope.destination.latitude},${scope.destination.longitude}`
    : '';
  return `${scope.shipmentId ?? ''}|${dest}`;
}

/**
 * Connects to geo-tracker as a viewer and subscribes to `agentIds`, exposing the
 * latest live fix per agent. Handles ack/error/permission_revoked, resubscribes
 * when `agentIds` changes, and reconnects with capped backoff.
 *
 * `scopes` opts an agent's broadcasts into live ETA/distance — see
 * {@link TrackingScope}. Whichever field is used, it lives on the **connection**
 * and is not persisted server-side, so it is re-sent on every reconnect, which
 * this hook does automatically.
 *
 * ⚠ **The ETA can arrive late, and that is normal.** The drop-off is fetched
 * from jovi-mall out of band when the tracking session opens, so a viewer who
 * subscribed before that landed starts with no `etaSeconds` and gains one
 * without reconnecting. Never treat its absence on the first few broadcasts as
 * final — and never withhold the position waiting for it.
 */
export function useGeoTrackerSocket(
  agentIds: string[],
  scopes: Record<string, TrackingScope> = {},
): GeoTrackerSocket {
  const [status, setStatus] = useState<TrackingSocketStatus>('idle');
  const [fixes, setFixes] = useState<Record<string, AgentLiveFix>>({});
  const [trails, setTrails] = useState<Record<string, GeoPosition[]>>({});
  const [revoked, setRevoked] = useState<Map<string, TrackingRevokeReason>>(new Map());
  const [revokedAt, setRevokedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<GeoTrackerErrorFrame | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  /** agentId → the destination key currently subscribed with. */
  const subscribedRef = useRef<Map<string, string>>(new Map());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  const manualCloseRef = useRef(false);
  // Latest desired agent set / ETA scopes, read by onopen without re-triggering connect.
  const desiredRef = useRef<string[]>(agentIds);
  desiredRef.current = agentIds;
  const scopesRef = useRef<Record<string, TrackingScope>>(scopes);
  scopesRef.current = scopes;
  // `reconnect` is defined below `connect` and calls it, so the message handler
  // inside `connect` cannot name it directly. A ref breaks that cycle without
  // making `connect` depend on `reconnect` — which would recreate both on every
  // render and re-run the mount effect.
  const reconnectRef = useRef<(() => void) | null>(null);

  const send = (frame: Frame) => {
    const s = socketRef.current;
    if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify(frame));
  };

  const syncSubscriptions = useCallback(() => {
    const s = socketRef.current;
    if (!s || s.readyState !== WebSocket.OPEN) return;
    const desired = new Set(desiredRef.current);
    const scopeFor = scopesRef.current;

    for (const id of desired) {
      const scope = scopeFor[id];
      const wanted = scopeKey(scope);
      const current = subscribedRef.current.get(id);
      if (current === wanted) continue;
      // A `subscribe` carrying no destination does NOT clear one already stored
      // for this (connection, agent), so any change goes through unsubscribe.
      if (current !== undefined) send({ type: 'unsubscribe', payload: { agentId: id } });
      send({
        type: 'subscribe',
        payload: {
          agentId: id,
          // Prefer `shipmentId`: the server resolves that shipment's own
          // drop-off, so a customer's coordinates never leave jovi-mall. The two
          // are alternatives — sending both would make `destination` win and
          // silently ignore the shipment — and sending neither is legal, yielding
          // an ETA whenever the agent has exactly one open session.
          ...(scope?.shipmentId
            ? { shipmentId: scope.shipmentId }
            : scope?.destination
              ? { destination: scope.destination }
              : {}),
        },
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
        const p = frame.payload as PermissionRevoked;
        if (!p?.agentId) return;
        // A closed set of three, and only `shipment_completed` is about a
        // delivery. Anything unrecognised — including an absent value — reads as
        // `authorization_expired`, which re-authorizes and tells the user
        // nothing. That fallback is what makes a fourth value safe to add.
        const reason = normalizeRevokeReason(p.reason);

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
        setRevoked((prev) => new Map(prev).set(p.agentId, reason));
        setRevokedAt(Date.now());

        // `permission_revoked` is an ANSWER, not a transport failure, so it must
        // never take the ordinary reconnect path — that would sit in backoff
        // re-asking a question the server has already answered.
        //
        // `authorization_expired` is the one exception, and it is not really an
        // exception: the socket's credential was rejected, and a WebSocket
        // authenticates exactly once, at the handshake. There is no refresh path
        // over the socket — geo-tracker forwards a bearer and cannot see
        // jovi-mall's refresh cookie — so a new handshake with a fresh token is
        // the only cure. `resolveGeoTrackerToken()` runs inside `connect()`, so
        // reconnecting is what picks the new token up.
        if (revokeNeedsFreshToken(reason)) {
          reconnectRef.current?.();
        }
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
    setRevoked(new Map());
    setLastError(null);
    // Detach the outgoing socket completely before opening the next one.
    //
    // `connect()` awaits the token before it touches any ref, so the old
    // socket's `close` event can land either side of that await. If it lands
    // AFTER, its `onclose` nulls `socketRef` — which by then holds the *new*
    // socket — and schedules a reconnect on top of the connection we just made,
    // leaving two sockets and a subscription map that describes neither.
    // Clearing the handlers makes the ordering irrelevant instead of lucky.
    const outgoing = socketRef.current;
    if (outgoing) {
      socketRef.current = null;
      outgoing.onopen = null;
      outgoing.onmessage = null;
      outgoing.onerror = null;
      outgoing.onclose = null;
      outgoing.close();
    }
    void connect();
  }, [connect]);

  // Publish it for the message handler (see `reconnectRef` above).
  reconnectRef.current = reconnect;

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
    .map((id) => `${id}:${scopeKey(scopes[id])}`)
    .join(',');
  useEffect(() => {
    syncSubscriptions();
    // If we had no agents before and now do, (re)connect.
    if (agentIds.length > 0 && !socketRef.current && status !== 'connecting') {
      void connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionKey]);

  // Reconnect the moment the device has a network again (CAPACITOR-PLAN.md →
  // P3.4). Without this the socket sits out whatever backoff it had reached
  // when the connection died — up to 30s of a live map showing stale pins on a
  // phone that came back to signal ten seconds ago. Guarded on an already-open
  // socket because the OS reports a *network* change, not a socket one: moving
  // from cellular to Wi-Fi fires this while the existing connection is fine.
  useEffect(
    () =>
      subscribeNetworkRestored(() => {
        if (!mountedRef.current || desiredRef.current.length === 0) return;
        if (socketRef.current?.readyState === WebSocket.OPEN) return;
        reconnect();
      }),
    [reconnect],
  );

  // Re-handshake on a clock, so the credential behind an open connection is
  // never older than the access-token TTL (P4.6 — see REHANDSHAKE_MS).
  //
  // Only an OPEN socket is cycled. A socket that is connecting, or sitting in
  // backoff, already has a fresh handshake coming and interrupting it would
  // restart the backoff it is halfway through.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!mountedRef.current || desiredRef.current.length === 0) return;
      if (socketRef.current?.readyState !== WebSocket.OPEN) return;
      reconnect();
    }, REHANDSHAKE_MS);
    return () => clearInterval(timer);
  }, [reconnect]);

  return { status, fixes, trails, revoked, revokedAt, lastError, reconnect };
}
