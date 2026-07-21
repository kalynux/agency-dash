// Shared shipment action config — the dynamic status transitions and rejection
// reasons the agency can trigger. Kept framework-free so both the list-row
// actions menu and the detail view render the same options for a given status.
// See api-doc/agency/shipments.md → status lifecycle.

import { CircleCheck, PackageCheck, RotateCcw, Truck, XCircle, type LucideIcon } from 'lucide-react';
import type {
  ShipmentActionableStatus,
  ShipmentRejectionReason,
  ShipmentStatus,
} from '@/types/shipment.types';

export interface ShipmentNextAction {
  status: ShipmentActionableStatus;
  label: string;
  icon: LucideIcon;
  variant?: 'default' | 'destructive';
}

/**
 * Valid next status(es) the agency can advance a shipment to, keyed by its
 * current status. Mirrors the lifecycle table in shipments.md — only
 * agency-triggerable transitions are listed.
 */
export const NEXT_ACTIONS: Partial<Record<ShipmentStatus, ShipmentNextAction[]>> = {
  assigned: [{ status: 'picked_up', label: 'Mark Picked Up', icon: PackageCheck }],
  picked_up: [{ status: 'in_transit', label: 'Mark In Transit', icon: Truck }],
  in_transit: [
    { status: 'agent_delivered', label: 'Mark Delivered', icon: CircleCheck },
    { status: 'failed', label: 'Mark Failed', icon: XCircle, variant: 'destructive' },
  ],
  // A claim of arrival is not proof of one — the customer may be out, refuse the
  // parcel, or (COD) refuse to pay, so agent_delivered may still fall to failed.
  agent_delivered: [{ status: 'failed', label: 'Mark Failed', icon: XCircle, variant: 'destructive' }],
  failed: [
    { status: 'in_transit', label: 'Retry Delivery', icon: Truck },
    { status: 'returned', label: 'Mark Returned', icon: RotateCcw, variant: 'destructive' },
  ],
};

/** Terminal statuses — nothing left to advance. */
export const TERMINAL_STATUSES: ShipmentStatus[] = ['delivered', 'returned', 'rejected'];

/** Fixed rejection reason set (POST .../reject). `other` requires a note. */
export const REJECTION_REASONS: { value: ShipmentRejectionReason; label: string }[] = [
  { value: 'out_of_coverage_area', label: 'Out of coverage area' },
  { value: 'capacity_exceeded', label: 'Capacity exceeded' },
  { value: 'invalid_address', label: 'Invalid address' },
  { value: 'vendor_item_not_ready', label: 'Vendor item not ready' },
  { value: 'other', label: 'Other' },
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
