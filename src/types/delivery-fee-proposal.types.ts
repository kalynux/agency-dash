/**
 * Delivery-fee proposals — a different fee for ONE shipment, which the vendor
 * approves or rejects. See api-doc/agency/shipments.md § Delivery-fee proposals
 * and api-doc/agency/FRONTEND-CHANGELOG-cod-limits-and-delivery-fees.md § 4.
 */

/** An unknown value renders read-only, never as one of these. */
export type DeliveryFeeProposalStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

/** The verbs the API will accept from you on this proposal — render buttons from it, nothing else. */
export type DeliveryFeeProposalAction = 'withdraw' | 'edit';

/** `system` is an automatic withdrawal (see {@link DeliveryFeeProposal.withdrawalReason}). */
export type DeliveryFeeProposalActorRole = 'agency' | 'agent' | 'vendor' | 'system';

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
  currency: string;
  /** The fee the shipment carried when this was proposed. */
  feeBefore: number;
  proposedFee: number;
  reason: string;
  status: DeliveryFeeProposalStatus | (string & {});
  respondedBy: DeliveryFeeProposalActor | null;
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

/** Proposals per shipment that count toward the cap (withdrawn ones don't). */
export const MAX_DELIVERY_FEE_PROPOSALS = 2;

/** Statuses in which a fee change may be proposed — before pickup. */
export const DELIVERY_FEE_PROPOSAL_WINDOW = ['assigned', 'handing_over'] as const;
