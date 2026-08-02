import { useCallback } from 'react';
import { getApiErrorMessage } from '@/lib/errors';
import { useActionRunner } from '@/hooks/useActionRunner';
import { shipmentsService } from '@/services/shipments.service';
import type {
  ShipmentActionableStatus,
  ShipmentRejectionReason,
  ReassignPayload,
} from '@/types/shipment.types';

// All shipment/COD/assignment codes live in the central registry (@/lib/errors).
export function getShipmentErrorMessage(err: unknown): string {
  return getApiErrorMessage(err);
}

/**
 * Shared shipment mutation logic — status transitions, rejection, the
 * offer/acceptance assignment flow (assign / auto-assign / cancel / reassign)
 * and tracking numbers. Each call toasts, maps errors centrally, and exposes a
 * per-action loading key; every action resolves to its typed result or `null`.
 */
export function useShipmentActions() {
  const { pendingKey, run, isPending } = useActionRunner();

  const updateStatus = useCallback(
    (id: string, status: ShipmentActionableStatus, successMessage: string) =>
      run(`status:${id}`, async () => (await shipmentsService.updateStatus(id, status)).data, {
        success: successMessage,
      }),
    [run],
  );

  const reject = useCallback(
    (id: string, reason: ShipmentRejectionReason, note?: string) =>
      run(`reject:${id}`, async () => (await shipmentsService.reject(id, reason, note)).data, {
        success: 'Shipment rejected.',
      }),
    [run],
  );

  const assignAgent = useCallback(
    (id: string, agentId: string) =>
      run(`assign:${id}`, async () => (await shipmentsService.assignAgent(id, agentId)).data, {
        success: 'Offer sent to the agent.',
      }),
    [run],
  );

  const autoAssign = useCallback(
    (id: string) =>
      run(`auto:${id}`, async () => (await shipmentsService.autoAssign(id)).data, {
        // A broadcast, not a single offer — the nearest agent is offered now and
        // the rest follow in turn until one accepts.
        success: 'Searching — offered to the nearest agent first.',
      }),
    [run],
  );

  const cancelOffer = useCallback(
    (id: string) =>
      // Withdraws every live offer on the shipment, not just the newest — an
      // auto-assign broadcast can have several standing at once.
      run(`cancel-offer:${id}`, async () => (await shipmentsService.cancelOffer(id)).data, {
        success: 'Offers withdrawn — the shipment is back in your queue.',
      }),
    [run],
  );

  const reassign = useCallback(
    (id: string, payload: ReassignPayload) =>
      run(`reassign:${id}`, async () => (await shipmentsService.reassign(id, payload)).data, {
        success: 'Shipment released and offered to the replacement.',
      }),
    [run],
  );

  // No tracking-number action: the number is generated at shipment creation and
  // is read-only on every endpoint.

  return {
    pendingKey,
    isPending,
    updateStatus,
    reject,
    assignAgent,
    autoAssign,
    cancelOffer,
    reassign,
  };
}
