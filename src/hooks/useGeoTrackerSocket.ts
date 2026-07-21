import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentLiveFix, LocationBroadcast, TrackingSocketStatus } from '@/types/tracking.types';

/**
 * Auth for the geo-tracker WS mirrors the HTTP side's `credentials: 'include'`:
 * the browser automatically forwards the httpOnly `access_token` cookie on the
 * WebSocket handshake whenever the target is same-site (e.g. localhost:8080 from
 * localhost:5174 — cookies ignore port, and the cookie is SameSite=Lax). So by
 * default we connect WITHOUT a token and let the cookie authenticate us.
 *
 * The `bearer` subprotocol token is only an OVERRIDE for cases where the cookie
 * won't be sent — a genuinely cross-site geo-tracker in production. It is read
 * from `VITE_GEO_TRACKER_TOKEN` or an injected `window.joviGetAccessToken()`.
 */
declare global {
  interface Window {
    joviGetAccessToken?: () => string | null | Promise<string | null>;
  }
}

const WS_URL = (import.meta.env.VITE_GEO_TRACKER_WS_URL as string | undefined) ?? 'ws://localhost:8090/ws/track';
const ENV_TOKEN = import.meta.env.VITE_GEO_TRACKER_TOKEN as string | undefined;

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;

async function resolveToken(): Promise<string | null> {
  if (typeof window !== 'undefined' && typeof window.joviGetAccessToken === 'function') {
    try {
      return (await window.joviGetAccessToken()) ?? null;
    } catch {
      return null;
    }
  }
  return ENV_TOKEN ?? null;
}

interface Frame {
  type: string;
  payload?: unknown;
}

export interface GeoTrackerSocket {
  status: TrackingSocketStatus;
  /** Latest fix per agentId. */
  fixes: Record<string, AgentLiveFix>;
  /** Agents whose subscription the server revoked (shipment finished, etc.). */
  revoked: Set<string>;
  reconnect: () => void;
}

/**
 * Connects to geo-tracker as a viewer and subscribes to `agentIds`, exposing the
 * latest live fix per agent. Handles ack/error/permission_revoked, resubscribes
 * when `agentIds` changes, and reconnects with capped backoff.
 */
export function useGeoTrackerSocket(agentIds: string[]): GeoTrackerSocket {
  const [status, setStatus] = useState<TrackingSocketStatus>('idle');
  const [fixes, setFixes] = useState<Record<string, AgentLiveFix>>({});
  const [revoked, setRevoked] = useState<Set<string>>(new Set());

  const socketRef = useRef<WebSocket | null>(null);
  const subscribedRef = useRef<Set<string>>(new Set());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  const manualCloseRef = useRef(false);
  // Latest desired agent set, read by onopen without re-triggering connect.
  const desiredRef = useRef<string[]>(agentIds);
  desiredRef.current = agentIds;

  const send = (frame: Frame) => {
    const s = socketRef.current;
    if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify(frame));
  };

  const syncSubscriptions = useCallback(() => {
    const s = socketRef.current;
    if (!s || s.readyState !== WebSocket.OPEN) return;
    const desired = new Set(desiredRef.current);
    // subscribe new
    for (const id of desired) {
      if (!subscribedRef.current.has(id)) {
        send({ type: 'subscribe', payload: { agentId: id } });
        subscribedRef.current.add(id);
      }
    }
    // unsubscribe removed
    for (const id of [...subscribedRef.current]) {
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
    const token = await resolveToken();
    console.log({token})
    if (!mountedRef.current) return;

    setStatus('connecting');
    manualCloseRef.current = false;
    let ws: WebSocket;
    try {
      ws = token ? new WebSocket(WS_URL, ['bearer', token]) : new WebSocket(WS_URL);
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
      subscribedRef.current = new Set();
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
        if (!b?.agentId) return;
        setFixes((prev) => ({ ...prev, [b.agentId]: { ...b, receivedAt: Date.now() } }));
      } else if (frame.type === 'permission_revoked') {
        const p = frame.payload as { agentId: string };
        if (!p?.agentId) return;
        subscribedRef.current.delete(p.agentId);
        setFixes((prev) => {
          const next = { ...prev };
          delete next[p.agentId];
          return next;
        });
        setRevoked((prev) => new Set(prev).add(p.agentId));
      }
      // ack / error frames are non-fatal; nothing to do.
    };

    ws.onerror = () => {
      if (mountedRef.current) setStatus('error');
    };

    ws.onclose = () => {
      socketRef.current = null;
      subscribedRef.current = new Set();
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

  // Resubscribe when the desired agent set changes (while open).
  useEffect(() => {
    syncSubscriptions();
    // If we had no agents before and now do, (re)connect.
    if (agentIds.length > 0 && !socketRef.current && status !== 'connecting') {
      void connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentIds.join(',')]);

  return { status, fixes, revoked, reconnect };
}
