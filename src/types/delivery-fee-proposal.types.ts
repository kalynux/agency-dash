/**
 * Delivery-fee proposals — a different fee for ONE shipment. Whoever pays the
 * delivery answers it: the vendor on a shop-paid parcel; on a customer-paid one
 * a decrease applies at once and an increase waits for the customer. See
 * api-doc/agency/shipments.md § Delivery-fee proposals,
 * api-doc/agency/FRONTEND-CHANGELOG-cod-limits-and-delivery-fees.md § 4 and
 * api-doc/agency/FRONTEND-CHANGELOG-customer-paid-delivery.md § 4.
 *
 * Since 2026-10-14 (ADR-A12) it also runs the other way: the payer proposes and
 * YOU answer (`origin: 'payer'`, `approver: 'agency'`). See
 * api-doc/agency/FRONTEND-CHANGELOG-payer-fee-proposals.md.
 */

/** An unknown value renders read-only, never as one of these. */
export type DeliveryFeeProposalStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export const DELIVERY_FEE_PROPOSAL_STATUSES: readonly DeliveryFeeProposalStatus[] = [
  'pending',
  'approved',
  'rejected',
  'withdrawn',
];

/**
 * The verbs the API will accept from you on this proposal — render buttons from
 * it, nothing else. `withdraw` / `edit` on your own; `approve` / `reject` on one
 * the payer sent you (never edit / withdraw there — it is theirs).
 */
export type DeliveryFeeProposalAction = 'withdraw' | 'edit' | 'approve' | 'reject';

/**
 * `system` is an automatic withdrawal (see {@link DeliveryFeeProposal.withdrawalReason})
 * or the direct application of a customer-paid decrease; `customer` answered a
 * customer-paid increase.
 */
export type DeliveryFeeProposalActorRole = 'agency' | 'agent' | 'vendor' | 'system' | 'customer';

/**
 * Who must answer. `vendor` — a shop-paid parcel; `customer` — an increase on a
 * customer-paid one; `none` — a customer-paid decrease, applied when created;
 * `agency` — you (or your agent), on a fee the payer proposed.
 * Absent on an older server, which only had `vendor`.
 */
export type DeliveryFeeProposalApprover = 'vendor' | 'customer' | 'none' | 'agency';

/**
 * `agency` — yours or your agent's; `change_agency` — raised by the platform when
 * a vendor moved the parcel to you (no verb of yours, and you are paid your price
 * whatever the answer); `combined_request` — your answer to a customer's
 * combined-price request; `payer` — the vendor or the customer (whoever pays the
 * delivery) proposed it, and you answer. Its two-per-parcel cap is counted apart
 * from yours.
 */
export type DeliveryFeeProposalOrigin = 'agency' | 'change_agency' | 'combined_request' | 'payer';

/**
 * Your side said yes to a payer's proposal. On a customer-paid online increase
 * this is set while the proposal is still `pending` — the customer must pay the
 * difference ({@link DeliveryFeeProposal.topup}) first, and pickup stays blocked.
 */
export interface DeliveryFeePayerAcceptance {
  role: 'agency' | 'agent' | (string & {});
  agentId: string | null;
  version: number;
  at: string;
}

/** The online top-up an approved customer-paid increase is waiting for. */
export interface DeliveryFeeTopup {
  amount: number;
  status: 'awaiting_payment' | 'paid' | (string & {});
  paidAt: string | null;
}

export interface DeliveryFeeProposalActor {
  role: DeliveryFeeProposalActorRole;
  userId: string | null;
  agentId: string | null;
}

export interface DeliveryFeeProposalEdit {
  editedBy: DeliveryFeeProposalActor;
  feeBefore: number;
  feeAfter: number;
  reasonBefore: string;
  reasonAfter: string;
  version: number;
  at: string;
}

/** `shipment_declined` — you declined the delivery; `agent_detached` — the proposing agent left the job. */
export type DeliveryFeeWithdrawalReason = 'shipment_declined' | 'agent_detached';

/** The agency view — the vendor's shape minus `application`. Amounts are XAF minor units. */
export interface DeliveryFeeProposal {
  id: string;
  shipmentId: string;
  orderId: string;
  agencyId: string;
  proposedBy: DeliveryFeeProposalActor;
  /** Absent on an older server → read as `vendor`. */
  approver?: DeliveryFeeProposalApprover | (string & {});
  /** Absent on an older server → read as `agency`. */
  origin?: DeliveryFeeProposalOrigin | (string & {});
  direction?: 'increase' | 'decrease' | null;
  /**
   * The customer accepted an increase. On an online order the fee only applies —
   * and pickup only unblocks — once {@link DeliveryFeeProposal.topup} is paid, so
   * the proposal stays `pending` meanwhile.
   */
  customerApproval?: { approvedAt: string; version: number } | null;
  /** Payer proposals only; absent on an older server. */
  payerAcceptance?: DeliveryFeePayerAcceptance | null;
  topup?: DeliveryFeeTopup | null;
  combinedRequestId?: string | null;
  currency: string;
  /** The fee the shipment carried when this was proposed. */
  feeBefore: number;
  proposedFee: number;
  reason: string;
  status: DeliveryFeeProposalStatus | (string & {});
  /** The server sends `{ role, userId, at }`; `agentId` is never set here. */
  respondedBy: (DeliveryFeeProposalActor & { at?: string }) | null;
  rejectionNote: string | null;
  withdrawalReason: DeliveryFeeWithdrawalReason | (string & {}) | null;
  /** Bumped on every edit; send the one you rendered with an edit. */
  version?: number;
  /** Oldest first. */
  edits?: DeliveryFeeProposalEdit[];
  lastEditedBy?: DeliveryFeeProposalActor | null;
  /** You edited it (possibly your agent's): it is yours now. */
  agencyEdited?: boolean;
  availableActions: Array<DeliveryFeeProposalAction | (string & {})>;
  createdAt: string;
  updatedAt: string;
}

/** The approved fee, once the vendor said yes. */
export interface DeliveryFeeOverride {
  amount: number;
  proposalId: string;
  approvedAt: string;
}

/** Carried by every agency shipment payload (list rows, detail, status/reject responses). */
export interface ShipmentDeliveryFeeState {
  /** While `true`, `→ picked_up` answers `409 SHIPMENT_DELIVERY_FEE_PENDING`. */
  deliveryFeeProposalPending?: boolean;
  pendingDeliveryFeeProposalId?: string | null;
  deliveryFeeOverride?: DeliveryFeeOverride | null;
}

export interface CreateDeliveryFeeProposalPayload {
  /** Integer ≥ 0, minor units, different from the current fee. */
  proposedFee: number;
  /** 3–500 characters. */
  reason: string;
}

export interface EditDeliveryFeeProposalPayload {
  proposedFee?: number;
  reason?: string;
  /** The version you rendered; a concurrent edit then answers 409 instead of being overwritten. */
  version?: number;
}

/** Answering a payer's proposal: always the `version` you displayed. */
export interface ApproveDeliveryFeeProposalPayload {
  version: number;
}

export interface RejectDeliveryFeeProposalPayload {
  version: number;
  /** Optional, ≤ {@link PAYER_FEE_DECLINE_NOTE_MAX} characters — shown to the payer. */
  note?: string;
}

export const PAYER_FEE_DECLINE_NOTE_MAX = 500;

/** GET /agency/delivery-fee-proposals — the inbox of payer proposals. */
export interface DeliveryFeeProposalInboxParams {
  /** Omit for every status. */
  status?: DeliveryFeeProposalStatus;
  page?: number;
  limit?: number;
}

export interface DeliveryFeeProposalInboxMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DeliveryFeeProposalInboxResponse {
  success: true;
  data: DeliveryFeeProposal[];
  meta: DeliveryFeeProposalInboxMeta;
}

/** Proposals per shipment that count toward the cap (withdrawn ones don't). */
export const MAX_DELIVERY_FEE_PROPOSALS = 2;

/** Statuses in which a fee change may be proposed — before pickup. */
export const DELIVERY_FEE_PROPOSAL_WINDOW = ['assigned', 'handing_over'] as const;
