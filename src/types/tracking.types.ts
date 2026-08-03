// Live tracking — two services, and the split is the point:
//
//   jovi-mall   → WHAT TO DRAW: which agents you may watch and, per agent, their
//                 active shipments with a start and an end pin.
//                 (api-doc/agency/live-tracking.md, api-doc/tracking/live-tracking.md)
//   geo-tracker → WHAT MOVES: the live position over a WebSocket, the durable
//                 GPS trail, and road routing between two points.
//                 (geo-tracker/api-doc/{tracking-websocket,gps-persistence,routing}.md)
//
// The board NEVER carries a position: the agent's mirrored last-known position is
// stale by construction, and drawing it would put a plausible-looking marker on a
// map that stopped moving. Positions come only from the socket.

import type { AddressDetail, ShipmentPickupSummary, ShipmentStatus } from '@/types/shipment.types';
import type { FileRef } from '@/types/file.types';

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

// ─── The board: GET /api/agency/tracking/board (jovi-mall) ──────────────────────

/**
 * One trackable delivery. `origin` is the **start** pin (where the parcel is
 * collected — vendor address, agency HQ, or a handover point after a
 * reassignment); `destination` is the **end** pin (the drop-off geocoded at
 * checkout and snapshotted onto the order, deliberately not the customer's
 * current saved address).
 */
export interface TrackingBoardShipment {
  shipmentId: string;
  trackingNumber: string | null;
  orderNumber: string | null;
  status: ShipmentStatus;
  itemCount: number;
  /** Start pin. `count > 1` means further collection points exist (see shipment detail). */
  origin: ShipmentPickupSummary | null;
  /** End pin. */
  destination: AddressDetail | null;
  /**
   * Both ends have coordinates, so the delivery can be drawn. `false` is NOT an
   * error — legacy orders and never-geocoded vendor addresses genuinely have no
   * coordinates. Show the address as text, skip the pins.
   */
  mappable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrackingBoardAgent {
  /** Use verbatim as the `agentId` in geo-tracker's `subscribe` frame. */
  agentId: string;
  name: string;
  avatar: FileRef | null;
  phone: string | null;
  vehicleType: string | null;
  /** Newest first. An agent running several deliveries has several entries. */
  shipments: TrackingBoardShipment[];
}

export interface TrackingBoardMeta {
  agentCount: number;
  shipmentCount: number;
  /** The agency has more trackable shipments than the server cap and the board was cut. */
  truncated: boolean;
}

export interface TrackingBoard {
  agents: TrackingBoardAgent[];
  meta: TrackingBoardMeta;
}

export interface TrackingBoardResponse {
  success: true;
  data: TrackingBoard;
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
  /** Only when a `destination` was supplied at subscribe AND routing answered. */
  etaSeconds?: number;
  distanceMeters?: number;
}

/** A live fix for one agent, held in the tracking client. */
export interface AgentLiveFix extends LocationBroadcast {
  /** Local receive time, for "last seen" freshness. */
  receivedAt: number;
}

export type TrackingSocketStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

// ─── geo-tracker HTTP reads ─────────────────────────────────────────────────────

/**
 * One point of the durable GPS trail — a *downsampled* history (periodic +
 * significant-movement), not one row per fix. Scoped to a shipment it is that
 * delivery's whole path, continuous across every reconnect.
 */
export interface TrackingCheckpoint {
  sessionId: string;
  agentId: string;
  shipmentId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  kind: 'interval' | 'movement';
  recordedAt: string;
}

/** POST /routing/route — the road line between two points. */
export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  /** Decoded route line; may be empty if the provider returned none. */
  geometry: GeoPosition[];
}
