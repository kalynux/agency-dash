// Agency Shipments — see api-doc/agency/shipments.md

export type ShipmentStatus =
  | 'pending'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'agent_delivered'
  | 'delivered'
  | 'failed'
  | 'returned'
  | 'rejected'
  | 'pending_agency_reassignment';

/** Statuses the agency can advance a shipment to via PATCH .../status. */
export type ShipmentActionableStatus = 'picked_up' | 'in_transit' | 'agent_delivered' | 'failed' | 'returned';

export type ShipmentRejectionReason =
  | 'out_of_coverage_area'
  | 'capacity_exceeded'
  | 'invalid_address'
  | 'vendor_item_not_ready'
  | 'other';

export type ChangedByRole = 'system' | 'agency' | 'vendor' | 'customer' | 'admin';

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
  rejectedAt: string;
}

export interface ShipmentCustomerConfirmation {
  confirmedAt: string;
}

/** Full detail from GET /api/agency/shipments/:id. */
export interface ShipmentDetail {
  id: string;
  orderId: string;
  orderNumber: string;
  agencyId: string;
  agentId: string | null;
  status: ShipmentStatus;
  trackingNumber: string | null;
  items: ShipmentItem[];
  vendor: ShipmentVendorDetail;
  customer: ShipmentCustomerDetail;
  agent: ShipmentAgent | null;
  statusHistory: ShipmentStatusHistoryEntry[];
  rejection: ShipmentRejectionInfo | null;
  customerConfirmation: ShipmentCustomerConfirmation | null;
  orderTimeline: ShipmentOrderTimelineEntry[];
}

/** Slim shipment shape returned by the mutation endpoints (status/reject/assign-agent/tracking-number). */
export interface ShipmentMutationResult {
  id: string;
  orderId: string;
  agencyId: string;
  agentId: string | null;
  status: ShipmentStatus;
  trackingNumber: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Query params & response envelopes ─────────────────────────────────────────

export interface ListShipmentsParams {
  status?: ShipmentStatus;
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
