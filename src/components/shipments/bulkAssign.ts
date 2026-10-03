import { ApiError } from '@/types/api';
import { codLimitRefusal, coverageRefusal } from '@/components/shipments/forceAssign';
import type { BulkAssignItemError, ShipmentListItem } from '@/types/shipment.types';

/**
 * Helpers for the bulk offer (`POST /api/agency/shipments/assign-agent`). The
 * bulk call reuses the single assign's rules, so these only adapt its shapes to
 * what the single flow already understands. See api-doc/agency/assignment.md →
 * bulk offer.
 */

/**
 * Whether a list row can join a bulk offer: it sits with the agency
 * (`assigned` / `handing_over`) and no agent has accepted it. The list carries
 * no `assignmentState`, but only `accepted` yields an `agentId`, so that is the
 * same test. A row with a pending offer still passes here; the server answers
 * it per row with `SHIPMENT_ALREADY_HAS_PENDING_OFFER`.
 */
export function isBulkOfferable(shipment: Pick<ShipmentListItem, 'status' | 'agentId'>): boolean {
  return (shipment.status === 'assigned' || shipment.status === 'handing_over') && !shipment.agentId;
}

/**
 * A refused row as an `ApiError`. The row's `error` has the error envelope's
 * shape, so wrapping it lets the central code → copy mapping and the force
 * recognisers read it exactly as they read a single assign's refusal.
 */
export function bulkItemError(error: BulkAssignItemError): ApiError {
  return new ApiError(error.statusCode, error.code, error.message, error.details, undefined, error.category);
}

/** True when `force: true` waives this refusal — the region or the COD cash limit, nothing else. */
export function isForceableRefusal(err: unknown): boolean {
  return coverageRefusal(err) !== null || codLimitRefusal(err) !== null;
}

/**
 * The numbers on a whole-call `422 AGENT_AT_CAPACITY`. `requested` counts only
 * the shipments that passed the per-shipment checks, so removing
 * `requested − freeSlots` of them is always enough.
 */
export interface AtCapacityRefusal {
  freeSlots: number;
  /** `null` when an older server left it out. */
  requested: number | null;
}

export function atCapacityRefusal(err: unknown): AtCapacityRefusal | null {
  if (!(err instanceof ApiError) || err.code !== 'AGENT_AT_CAPACITY') return null;
  const d = (err.details ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
  const freeSlots = num(d.freeSlots);
  // Without `freeSlots` there is nothing to resize to; let it toast like any refusal.
  if (freeSlots === null) return null;
  return { freeSlots, requested: num(d.requested) };
}
