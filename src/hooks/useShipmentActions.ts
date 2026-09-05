import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage, getErrorCode } from '@/lib/errors';
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
  const { t } = useTranslation('shipments');
  const { pendingKey, run, isPending } = useActionRunner();

  /**
   * @param statusLabel the already-translated name of the new status, so the
   *   toast reads "Shipment marked “In Transit”." — the caller has it from the
   *   action it just ran, and only the caller knows which label was clicked.
   */
  const updateStatus = useCallback(
    (id: string, status: ShipmentActionableStatus, statusLabel: string) =>
      run(`status:${id}`, async () => (await shipmentsService.updateStatus(id, status)).data, {
        success: t('actions.statusChanged', { label: statusLabel }),
      }),
    [run, t],
  );

  /**
   * Decline an assigned shipment.
   *
   * Rejection is now guarded by a from-status compare-and-set, so it can answer
   * `409 SHIPMENT_STATUS_CONFLICT`: the shipment moved between the read that
   * validated the rejection and the write — an agent picked it up, or a second
   * rejection landed first. The remedy is to reload, never to resend, so
   * `onStale` fires for the caller to refresh its view.
   * See api-doc/agency/shipments.md → POST .../reject.
   */
  const reject = useCallback(
    (id: string, reason: ShipmentRejectionReason, note?: string, onStale?: () => void) =>
      run(`reject:${id}`, async () => (await shipmentsService.reject(id, reason, note)).data, {
        success: t('reject.success'),
        onError: (err) => {
          if (getErrorCode(err) === 'SHIPMENT_STATUS_CONFLICT') onStale?.();
        },
      }),
    [run, t],
  );

  const assignAgent = useCallback(
    (id: string, agentId: string) =>
      run(`assign:${id}`, async () => (await shipmentsService.assignAgent(id, agentId)).data, {
        success: t('assignment.offerSent'),
      }),
    [run, t],
  );

  const autoAssign = useCallback(
    (id: string) =>
      run(`auto:${id}`, async () => (await shipmentsService.autoAssign(id)).data, {
        // A broadcast, not a single offer — the nearest agent is offered now and
        // the rest follow in turn until one accepts.
        success: t('assignment.autoAssignStarted'),
      }),
    [run, t],
  );

  const cancelOffer = useCallback(
    (id: string) =>
      // Withdraws every live offer on the shipment, not just the newest — an
      // auto-assign broadcast can have several standing at once.
      run(`cancel-offer:${id}`, async () => (await shipmentsService.cancelOffer(id)).data, {
        success: t('assignment.offersWithdrawn'),
      }),
    [run, t],
  );

  const reassign = useCallback(
    (id: string, payload: ReassignPayload) =>
      run(`reassign:${id}`, async () => (await shipmentsService.reassign(id, payload)).data, {
        success: t('reassignDialog.success'),
      }),
    [run, t],
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
