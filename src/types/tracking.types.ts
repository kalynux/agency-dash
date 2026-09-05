// Live tracking — two services, and the split is the point:
//
//   wi-mall   → WHAT TO DRAW: which agents you may watch and, per agent, their
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

/** GET /api/tracking/visible-agents (wi-mall). */
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

// ─── The board: GET /api/agency/tracking/board (wi-mall) ──────────────────────

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

// ─── permission_revoked ────────────────────────────────────────────────────────

/**
 * Why the server dropped a subscription. **A closed set of three, and only one
 * of them is about a delivery.**
 *
 * Until 2026-08-19 all three arrived as the single literal `shipment_completed`,
 * because the server discarded the outcome of its re-authorization check. Any
 * dashboard that read that string and showed "delivered" was capable of
 * reporting a completed delivery **because an access token aged out** — which is
 * exactly what this union exists to stop.
 *
 * All three still drop the watcher: the server fails closed on any viewer it
 * cannot confirm. Only the explanation is new, and the explanation is the whole
 * point — see {@link REVOKE_REASON_CONCLUSIVE}.
 *
 * See geo-tracker/tracking-websocket.md § permission_revoked and
 * api-doc/MIGRATION-2026-08.md § 2.
 */
export type TrackingRevokeReason =
  /**
   * jovi-mall was asked, and answered: this agency is no longer entitled to that
   * agent. The delivery ended, or the entitlement did.
   *
   * **The only value from which a delivery outcome may be reported.** Drop the
   * marker and refetch the board.
   */
  | 'shipment_completed'
  /**
   * jovi-mall **rejected the token** the socket was opened with (401/403).
   * Nothing whatsoever is known about the shipment.
   *
   * Reconnect with a fresh token and re-subscribe. Keep the row and say nothing
   * about the delivery — it is almost certainly still in flight. A 90-day capped
   * session surfaces here too, which is one cause with two symptoms.
   */
  | 'authorization_expired'
  /**
   * jovi-mall **could not be asked** — unreachable, 5xx, or the check timed out.
   * Nothing is known about the shipment *or* the entitlement.
   *
   * Retry with backoff. Report no outcome.
   */
  | 'authorization_unavailable';

/** Server → client: `permission_revoked`. */
export interface PermissionRevoked {
  agentId: string;
  /**
   * Absent on a server that predates the three-value set. {@link normalizeRevokeReason}
   * is what turns that — and any future fourth value — into the safe reading.
   */
  reason?: string;
}

/**
 * Coerce a wire `reason` into the closed set.
 *
 * **Anything unrecognised becomes `authorization_expired`**, which is the rule
 * the backend states and the rule that makes adding a fourth value safe: the
 * fallback re-authorizes and tells the user nothing, so a client that has never
 * heard of the new value cannot invent a delivery outcome from it.
 *
 * An absent `reason` is treated the same way rather than as `shipment_completed`
 * — a server old enough to omit it is a server whose `shipment_completed` meant
 * all three things.
 */
export function normalizeRevokeReason(reason: unknown): TrackingRevokeReason {
  return reason === 'shipment_completed' ||
    reason === 'authorization_expired' ||
    reason === 'authorization_unavailable'
    ? reason
    : 'authorization_expired';
}

/**
 * True when the revocation actually says something about the delivery.
 *
 * The one predicate any UI wanting to write "delivered", "finished" or "no
 * longer tracked" must pass first.
 */
export function isConclusiveRevoke(reason: TrackingRevokeReason): boolean {
  return reason === 'shipment_completed';
}

/**
 * Whether this revocation is worth re-handshaking for.
 *
 * `permission_revoked` is an **answer, not a transport failure**, so it must
 * never trigger the ordinary reconnect path. But `authorization_expired` says
 * the credential behind the socket is stale, and the only cure for that is a
 * new handshake with a fresh token — there is no refresh path over the socket,
 * because geo-tracker forwards a bearer and has no access to jovi-mall's
 * refresh cookie.
 */
export function revokeNeedsFreshToken(reason: TrackingRevokeReason): boolean {
  return reason === 'authorization_expired';
}

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
