/**
 * Combined delivery-price requests (ADR-A11 D-8): a customer asks you for ONE
 * lower price on two or more of their parcels from one checkout that you carry
 * (customer-paid, not picked up yet). You answer by lowering fees — each lower
 * fee applies at once — or by declining. Fees can only go down here.
 * See api-doc/agency/shipments.md § Combined delivery-price requests.
 */

/** An unknown value renders read-only. */
export type CombinedDeliveryRequestStatus = 'open' | 'answered' | 'declined' | 'cancelled';

export const COMBINED_DELIVERY_REQUEST_STATUSES: readonly CombinedDeliveryRequestStatus[] = [
  'open',
  'answered',
  'declined',
  'cancelled',
];

export interface CombinedDeliveryRequestParcel {
  shipmentId: string;
  orderId: string;
  /** The parcel's fee when the customer asked, minor units. */
  feeAtRequest: number;
}

/** One fee your answer actually applied. */
export interface CombinedDeliveryAnsweredFee {
  shipmentId: string;
  feeBefore: number;
  feeAfter: number;
  proposalId: string;
}

export interface CombinedDeliveryRequest {
  id: string;
  cartId: string;
  agencyId: string;
  currency: string;
  status: CombinedDeliveryRequestStatus | (string & {});
  /** The customer's message, if any. */
  note: string | null;
  shipments: CombinedDeliveryRequestParcel[];
  answer: {
    fees: CombinedDeliveryAnsweredFee[];
    /** Σ (before − after), computed by the server. */
    saving: number;
    note: string | null;
    answeredAt: string;
  } | null;
  declineNote: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface CombinedDeliveryRequestListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CombinedDeliveryRequestListResponse {
  success: true;
  data: CombinedDeliveryRequest[];
  meta: CombinedDeliveryRequestListMeta;
}

export interface CombinedDeliveryRequestListParams {
  status?: CombinedDeliveryRequestStatus;
  page?: number;
  /** 1–100, server default 20. */
  limit?: number;
}

/** Either lower fees… */
export interface CombinedDeliveryRespondFees {
  /** Each LOWER than the parcel's current fee; integers in minor units; 1–20 entries. */
  fees: Array<{ shipmentId: string; proposedFee: number }>;
  /** Up to 500 characters, shown to the customer. */
  note?: string | null;
}

/** …or decline. */
export interface CombinedDeliveryRespondDecline {
  decline: true;
  note?: string | null;
}

export type CombinedDeliveryRespondPayload = CombinedDeliveryRespondFees | CombinedDeliveryRespondDecline;

export interface CombinedDeliveryRespondResult {
  request: CombinedDeliveryRequest;
  /** A parcel picked up meanwhile is reported here, never silently skipped. */
  failed: Array<{ shipmentId: string; code: string }>;
}

export interface CombinedDeliveryRespondResponse {
  success: true;
  data: CombinedDeliveryRespondResult;
  message?: string;
}

export const COMBINED_NOTE_MAX = 500;
