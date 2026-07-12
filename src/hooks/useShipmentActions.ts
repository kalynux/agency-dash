import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/types/api';
import { shipmentsService } from '@/services/shipments.service';
import type {
  ShipmentActionableStatus,
  ShipmentMutationResult,
  ShipmentRejectionReason,
} from '@/types/shipment.types';

// ─── Error mapping ────────────────────────────────────────────────────────────

const SHIPMENT_ERROR_LABELS: Record<string, string> = {
  SHIPMENT_NOT_FOUND: 'This shipment could no longer be found.',
  SHIPMENT_INVALID_STATUS_TRANSITION: "This shipment can't be moved to that status from its current one.",
  SHIPMENT_REJECTION_NOT_ALLOWED: 'This shipment has already been picked up and can no longer be rejected.',
  SHIPMENT_AGENT_NOT_IN_AGENCY: "That agent doesn't belong to your agency.",
};

export function getShipmentErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return SHIPMENT_ERROR_LABELS[err.code] ?? err.message;
  return 'Something went wrong. Please try again.';
}

// ─── Shared mutation hook ─────────────────────────────────────────────────────

export interface UseShipmentActionsOptions {
  /** Called after any successful mutation, so the caller can patch its local state / refresh the nav badge. */
  onChanged?: (result: ShipmentMutationResult) => void;
}

/** Shared status/reject/assign-agent/tracking-number mutation logic — toast + error mapping + a per-action loading key. */
export function useShipmentActions({ onChanged }: UseShipmentActionsOptions = {}) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const run = useCallback(
    async (
      key: string,
      action: () => Promise<{ data: ShipmentMutationResult }>,
      successMessage: string,
    ): Promise<ShipmentMutationResult | null> => {
      setPendingKey(key);
      try {
        const { data } = await action();
        toast.success(successMessage);
        onChanged?.(data);
        return data;
      } catch (err) {
        toast.error(getShipmentErrorMessage(err));
        return null;
      } finally {
        setPendingKey(null);
      }
    },
    [onChanged],
  );

  const updateStatus = useCallback(
    (shipmentId: string, status: ShipmentActionableStatus, successMessage: string) =>
      run(`status:${shipmentId}`, () => shipmentsService.updateStatus(shipmentId, status), successMessage),
    [run],
  );

  const reject = useCallback(
    (shipmentId: string, reason: ShipmentRejectionReason) =>
      run(`reject:${shipmentId}`, () => shipmentsService.reject(shipmentId, reason), 'Shipment rejected.'),
    [run],
  );

  const assignAgent = useCallback(
    (shipmentId: string, agentId: string) =>
      run(`assign:${shipmentId}`, () => shipmentsService.assignAgent(shipmentId, agentId), 'Agent assigned.'),
    [run],
  );

  const updateTrackingNumber = useCallback(
    (shipmentId: string, trackingNumber: string) =>
      run(
        `tracking:${shipmentId}`,
        () => shipmentsService.updateTrackingNumber(shipmentId, trackingNumber),
        'Tracking number updated.',
      ),
    [run],
  );

  return { pendingKey, updateStatus, reject, assignAgent, updateTrackingNumber };
}
