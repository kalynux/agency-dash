// Shared shipment action config — the dynamic status transitions and rejection
// reasons the agency can trigger. Kept framework-free so both the list-row
// actions menu and the detail view render the same options for a given status.
// See api-doc/agency/shipments.md → status lifecycle.
//
// Labels are translation keys, not copy: these tables are module-scope data
// evaluated once at import, so a translated string here would freeze in the
// language that was active at boot. Consumers resolve with `tx(t, labelKey)`.

import { CircleCheck, PackageCheck, RotateCcw, Truck, XCircle, type LucideIcon } from 'lucide-react';
import type {
  ShipmentActionableStatus,
  ShipmentRejectionReason,
  ShipmentStatus,
} from '@/types/shipment.types';

export interface ShipmentNextAction {
  status: ShipmentActionableStatus;
  /** `shipments:actions.*` key. */
  labelKey: string;
  icon: LucideIcon;
  variant?: 'default' | 'destructive';
}

/**
 * Valid next status(es) the agency can advance a shipment to, keyed by its
 * current status. Mirrors the lifecycle table in shipments.md — only
 * agency-triggerable transitions are listed.
 */
export const NEXT_ACTIONS: Partial<Record<ShipmentStatus, ShipmentNextAction[]>> = {
  assigned: [{ status: 'picked_up', labelKey: 'shipments:actions.markPickedUp', icon: PackageCheck }],
  // A picked-up parcel that was reassigned off its agent. The transition table
  // is identical for both actors, so the replacement agent can record this
  // pickup from their own app — but the agency can too, and could not before.
  // `returned` is the other way out: the handover was abandoned.
  // See api-doc/agency/shipments.md → status lifecycle.
  handing_over: [
    {
      status: 'picked_up',
      labelKey: 'shipments:actions.markPickedUpAfterHandover',
      icon: PackageCheck,
    },
    { status: 'returned', labelKey: 'shipments:actions.markReturned', icon: RotateCcw, variant: 'destructive' },
  ],
  picked_up: [{ status: 'in_transit', labelKey: 'shipments:actions.markInTransit', icon: Truck }],
  in_transit: [
    { status: 'agent_delivered', labelKey: 'shipments:actions.markDelivered', icon: CircleCheck },
    { status: 'failed', labelKey: 'shipments:actions.markFailed', icon: XCircle, variant: 'destructive' },
  ],
  // A claim of arrival is not proof of one — the customer may be out, refuse the
  // parcel, or (COD) refuse to pay, so agent_delivered may still fall to failed.
  agent_delivered: [
    { status: 'failed', labelKey: 'shipments:actions.markFailed', icon: XCircle, variant: 'destructive' },
  ],
  failed: [
    { status: 'in_transit', labelKey: 'shipments:actions.retryDelivery', icon: Truck },
    { status: 'returned', labelKey: 'shipments:actions.markReturned', icon: RotateCcw, variant: 'destructive' },
  ],
};

/** Terminal statuses — nothing left to advance. */
export const TERMINAL_STATUSES: ShipmentStatus[] = ['delivered', 'returned', 'rejected'];

/**
 * The rejection reasons an AGENCY may send (POST .../reject). `other` requires
 * a note. The array fixes the display order; the copy lives in
 * `shipments:reject.reasons`.
 *
 * `platform_intervention` is deliberately absent: it exists in the API's enum as
 * the administrator's reason for a platform cancellation, and an agency has no
 * reason to send it. It is still a valid value to *render* on a rejection
 * record we read back — see `ShipmentRejectionReason`.
 */
export const REJECTION_REASONS: ShipmentRejectionReason[] = [
  'out_of_coverage_area',
  'capacity_exceeded',
  'invalid_address',
  'vendor_item_not_ready',
  'other',
];

/** Max length of a rejection note, per the API. */
export const REJECTION_NOTE_MAX = 200;

export function getNextActions(status: ShipmentStatus): ShipmentNextAction[] {
  return NEXT_ACTIONS[status] ?? [];
}

/** Rejection is only allowed while the shipment is still `assigned` (pre-pickup). */
export function canRejectStatus(status: ShipmentStatus): boolean {
  return status === 'assigned';
}

export function isTerminalStatus(status: ShipmentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * The statuses at which a delivery-proof photo can exist.
 *
 * An agent records the proof when they report the delivery, so nothing before
 * `agent_delivered` can have one and asking would spend a request to be told
 * `404`. `failed` and `returned` are included because an agent can photograph a
 * doorstep, a refusal or a returned parcel too, and `delivered` because the
 * proof outlives the confirmation that followed it.
 */
const PROOF_BEARING_STATUSES: ShipmentStatus[] = [
  'agent_delivered',
  'delivered',
  'failed',
  'returned',
];

export function canHaveDeliveryProof(status: ShipmentStatus): boolean {
  return PROOF_BEARING_STATUSES.includes(status);
}

/**
 * Only a `delivered` shipment is reviewable, for every author role.
 *
 * `agent_delivered` is not enough: the agent claiming arrival is not the
 * delivery completing, and the eligibility endpoint refuses it. Checking here
 * saves a round trip on every other shipment. See api-doc/reviews.md § 2.
 */
export function canReviewDelivery(status: ShipmentStatus): boolean {
  return status === 'delivered';
}
