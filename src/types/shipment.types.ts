// Agency Shipments — see api-doc/agency/shipments.md

export type ShipmentStatus =
  | 'pending'
  | 'assigned'
  | 'handing_over'
  | 'picked_up'
  | 'in_transit'
  | 'agent_delivered'
  | 'delivered'
  | 'failed'
  | 'returned'
  | 'rejected'
  | 'pending_agency_reassignment';

/**
 * Whether an agent is bound to the shipment. Under the acceptance workflow a
 * shipment stays `status: assigned` while `assignmentState` moves
 * unassigned → offered → accepted. Only `accepted` yields an `agentId`.
 */
export type AssignmentState = 'unassigned' | 'offered' | 'accepted';

/** Statuses the agency can advance a shipment to via PATCH .../status. */
export type ShipmentActionableStatus = 'picked_up' | 'in_transit' | 'agent_delivered' | 'failed' | 'returned';

export type ShipmentRejectionReason =
  | 'out_of_coverage_area'
  | 'capacity_exceeded'
  | 'invalid_address'
  | 'vendor_item_not_ready'
  | 'other';

export type ChangedByRole = 'system' | 'agency' | 'vendor' | 'customer' | 'admin';

/** How the parent order was paid. Drives COD-specific shipment rules — see shipments.md. */
export type ShipmentPaymentMethod = 'cash_on_delivery' | 'prepaid';

export type ShipmentCodStatus = 'pending' | 'collected' | 'cancelled';

/** Present on shipment detail once picked up, for cash_on_delivery shipments only. Never contains the customer's delivery code. */
export interface ShipmentCodInfo {
  expectedAmount: number;
  currency: string;
  status: ShipmentCodStatus;
  collectedAt: string | null;
}

export interface ShipmentVendorSummary {
  id: string;
  businessName: string;
  phone: string;
}

export interface ShipmentCustomerSummary {
  id: string;
  name: string;
  phone: string;
}

/**
 * Pickup / drop-off summary carried on a list row (added 2026-07-29). The list
 * contract names these fields but not their members, so every part is optional
 * and read defensively — see {@link describeShipmentPlace}.
 */
export interface ShipmentPlaceSummary {
  label?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  formattedAddress?: string | null;
  location?: GeoPoint | null;
}

/** Shortest useful description of a pickup/drop-off, or `null` if it says nothing. */
export function describeShipmentPlace(place?: ShipmentPlaceSummary | null): string | null {
  if (!place) return null;
  const cityState = [place.city, place.state].filter(Boolean).join(', ');
  return cityState || place.formattedAddress || place.label || place.addressLine1 || null;
}

/** One row from GET /api/agency/shipments. */
export interface ShipmentListItem {
  id: string;
  orderId: string;
  agencyId: string;
  agentId: string | null;
  status: ShipmentStatus;
  trackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
  orderNumber: string;
  vendor: ShipmentVendorSummary;
  customer: ShipmentCustomerSummary;
  itemCount: number;
  /** Where the parcel is collected. */
  pickup?: ShipmentPlaceSummary | null;
  /** The drop-off, geocoded at checkout. */
  deliveryAddress?: ShipmentPlaceSummary | null;
}

export interface ShipmentPickupAddress {
  label: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
}

export interface ShipmentPickupLocation {
  mode: 'storage_based' | 'pickup_based';
  alreadyInYourStorage: boolean;
  address: ShipmentPickupAddress;
}

export interface ShipmentItem {
  orderItemId: string;
  productId: string;
  quantity: number;
  title: string;
  sku: string;
  variantTitle: string | null;
  pickupLocation: ShipmentPickupLocation | null;
}

export interface ShipmentVendorDetail extends ShipmentVendorSummary {
  email: string;
}

export interface ShipmentDeliveryAddress {
  label: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
}

export interface ShipmentCustomerDetail extends ShipmentCustomerSummary {
  email: string;
  deliveryAddress: ShipmentDeliveryAddress;
}

export interface ShipmentAgent {
  id: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
}

export interface ShipmentStatusHistoryEntry {
  status: ShipmentStatus;
  changedAt: string;
  changedByUserId?: string | null;
  changedByRole: ChangedByRole;
}

/** Same shape as a status history entry, plus which agency it belongs to — merged across every shipment on the order. */
export interface ShipmentOrderTimelineEntry extends ShipmentStatusHistoryEntry {
  shipmentId: string;
  agencyId: string;
  agencyName: string;
}

export interface ShipmentRejectionInfo {
  reason: ShipmentRejectionReason;
  /** Free-text explanation; always present when `reason` is `other`. */
  note?: string | null;
  rejectedAt: string;
}

export interface ShipmentCustomerConfirmation {
  confirmedAt: string;
}

// ─── Handover (reassigned shipments) ───────────────────────────────────────────

export type HandoverPickupSource =
  | 'previous_agent_location'
  | 'original_pickup'
  | 'agency_business'
  | 'manual';

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface HandoverPickupAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

/** The collection point a replacement agent uses after a reassignment. */
export interface HandoverPickup {
  source: HandoverPickupSource;
  label: string;
  address: HandoverPickupAddress | null;
  location: GeoPoint | null;
  note: string | null;
  is_fallback: boolean;
}

/** Non-null only for a reassigned shipment — see agency/assignment.md → reassign. */
export interface ShipmentHandover {
  pickup: HandoverPickup;
  fromAgentId: string;
  fromStatus: ShipmentStatus;
  reassignedAt: string;
}

/** Full detail from GET /api/agency/shipments/:id. */
export interface ShipmentDetail {
  id: string;
  orderId: string;
  orderNumber: string;
  agencyId: string;
  agentId: string | null;
  status: ShipmentStatus;
  paymentMethod: ShipmentPaymentMethod;
  /** Present once picked up, cash_on_delivery shipments only. */
  cod: ShipmentCodInfo | null;
  trackingNumber: string | null;
  items: ShipmentItem[];
  vendor: ShipmentVendorDetail;
  customer: ShipmentCustomerDetail;
  agent: ShipmentAgent | null;
  /** Non-null only for a reassigned shipment. */
  handover: ShipmentHandover | null;
  statusHistory: ShipmentStatusHistoryEntry[];
  rejection: ShipmentRejectionInfo | null;
  customerConfirmation: ShipmentCustomerConfirmation | null;
  orderTimeline: ShipmentOrderTimelineEntry[];
}

/** Slim shipment shape returned by the status/reject/tracking-number mutations. */
export interface ShipmentMutationResult {
  id: string;
  orderId: string;
  agencyId: string;
  agentId: string | null;
  status: ShipmentStatus;
  trackingNumber: string | null;
  /** Present only when a COD shipment just reached `agent_delivered`. */
  requiresDeliveryCode?: boolean;
  nextAction?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Assignment (offer / acceptance workflow) — see agency/assignment.md ────────

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

export interface ShipmentOffer {
  id: string;
  status: OfferStatus;
  expiresAt?: string | null;
  pickupLocation?: HandoverPickup | null;
}

export interface AssignmentShipmentState {
  id: string;
  status: ShipmentStatus;
  assignmentState: AssignmentState;
}

/** Result of assign-agent / auto-assign. */
export interface AssignmentResult {
  offer: ShipmentOffer;
  shipment: AssignmentShipmentState;
  autoAccepted: boolean;
}

export interface AssignmentResponse {
  success: true;
  data: AssignmentResult;
  message?: string;
}

export interface AssignmentCandidateBreakdown {
  distance_km?: number;
  distance_score?: number;
  free_capacity?: number;
  capacity_score?: number;
  trust_score?: number;
  weighted?: number;
}

export interface AssignmentCandidate {
  agentId: string;
  rank: number;
  score: number;
  breakdown: AssignmentCandidateBreakdown;
}

export interface AssignmentCandidatesResponse {
  success: true;
  data: AssignmentCandidate[];
}

export interface OfferCancelResponse {
  success: true;
  data: { cancelled: number };
  message?: string;
}

/** Manual pickup-location override sent to reassign. Any subset accepted;
 * a coordinate needs both latitude and longitude. */
export interface ReassignPickupOverride {
  label?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  note?: string;
}

export interface ReassignPayload {
  /** Required once the parcel has left the agency (picked_up/in_transit/failed/returned). */
  agentId?: string;
  reason: string;
  pickupLocation?: ReassignPickupOverride;
}

export interface ReassignResult {
  reassignedFrom: string;
  previousStatus: ShipmentStatus;
  pickupLocation: HandoverPickup;
  offer: ShipmentOffer;
  shipment: AssignmentShipmentState;
  autoAccepted: boolean;
}

export interface ReassignResponse {
  success: true;
  data: ReassignResult;
  message?: string;
}

export interface AssignmentSettings {
  autoAssignEnabled: boolean;
}

export interface AssignmentSettingsResponse {
  success: true;
  data: AssignmentSettings;
  message?: string;
}

// ─── Query params & response envelopes ─────────────────────────────────────────

export interface ListShipmentsParams {
  status?: ShipmentStatus;
  /**
   * Free-text search (min 2 chars, max 100) across the customer's name and phone,
   * the product titles on the shipment, the order number and the tracking number.
   * Server-side, so it spans every page — not just the one on screen.
   */
  q?: string;
  page?: number;
  limit?: number;
}

export interface ShipmentListMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ListShipmentsResponse {
  success: true;
  data: ShipmentListItem[];
  meta: ShipmentListMeta;
}

export interface ShipmentDetailResponse {
  success: true;
  data: ShipmentDetail;
}

export interface ShipmentMutationResponse {
  success: true;
  data: ShipmentMutationResult;
  message?: string;
}
