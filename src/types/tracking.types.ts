// Live tracking — jovi-mall owns the authorization policy; geo-tracker streams.
// See api-doc/tracking/live-tracking.md and geo-tracker/api-doc/tracking-websocket.md

/** GET /api/tracking/visible-agents (jovi-mall). */
export interface VisibleAgents {
  /** true only for admin (sees everyone); `agents` is then empty/irrelevant. */
  all: boolean;
  /** DeliveryAgent ids the caller may currently track. */
  agents: string[];
}

export interface VisibleAgentsResponse {
  success: true;
  data: VisibleAgents;
}

// ─── geo-tracker WebSocket frames ───────────────────────────────────────────────

export interface GeoPosition {
  latitude: number;
  longitude: number;
}

/** Server → client: `location_broadcast`. */
export interface LocationBroadcast {
  agentId: string;
  position: GeoPosition;
  headingDegrees?: number;
  speedMps?: number;
  recordedAt: string;
  etaSeconds?: number;
  distanceMeters?: number;
}

/** A live fix for one agent, held in the tracking client. */
export interface AgentLiveFix extends LocationBroadcast {
  /** Local receive time, for "last seen" freshness. */
  receivedAt: number;
}

export type TrackingSocketStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
