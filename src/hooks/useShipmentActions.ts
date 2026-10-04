import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getApiErrorMessage, getErrorCode } from '@/lib/errors';
import { useActionRunner, type RunOptions } from '@/hooks/useActionRunner';
import { shipmentsService } from '@/services/shipments.service';
import {
  codLimitRefusal,
  coverageRefusal,
  type CodLimitRefusal,
  type CoverageRefusal,
} from '@/components/shipments/forceAssign';
import { atCapacityRefusal, type AtCapacityRefusal } from '@/components/shipments/bulkAssign';
import type {
  AssignAgentOptions,
  BulkAssignPayload,
  ShipmentActionableStatus,
  ShipmentRejectionReason,
  ReassignPayload,
} from '@/types/shipment.types';
import type {
  CreateDeliveryFeeProposalPayload,
  EditDeliveryFeeProposalPayload,
} from '@/types/delivery-fee-proposal.types';

/** Fee-proposal refusals whose cure is to reload, never to resend. */
const STALE_FEE_PROPOSAL_CODES = new Set([
  'DELIVERY_FEE_PROPOSAL_WINDOW_CLOSED',
  'DELIVERY_FEE_PROPOSAL_ALREADY_PENDING',
  'DELIVERY_FEE_PROPOSAL_LIMIT_REACHED',
  'DELIVERY_FEE_PROPOSAL_VERSION_MISMATCH',
  'DELIVERY_FEE_PROPOSAL_NOT_PENDING',
  'DELIVERY_FEE_PROPOSAL_NOT_YOURS',
  'DELIVERY_FEE_PROPOSAL_NOT_FOUND',
  // Customer-paid (ADR-A11): the customer already accepted and is paying, or the
  // edit crossed below the current fee — either way the view is out of date.
  'DELIVERY_FEE_TOPUP_IN_PROGRESS',
  'DELIVERY_FEE_PROPOSAL_DIRECTION_CHANGED',
]);

// All shipment/COD/assignment codes live in the central registry (@/lib/errors).
export function getShipmentErrorMessage(err: unknown): string {
  return getApiErrorMessage(err);
}

/** The two refusals `force: true` waives, each routed to its own prompt. */
export interface ForceableRefusalHandlers {
  onCoverageRefused?: (refusal: CoverageRefusal) => void;
  onCodLimitRefused?: (refusal: CodLimitRefusal) => void;
}

/** Route a forceable refusal to the caller instead of a toast — only when the caller handles that one. */
function forceableHandling({ onCoverageRefused, onCodLimitRefused }: ForceableRefusalHandlers): RunOptions {
  if (!onCoverageRefused && !onCodLimitRefused) return {};
  return {
    silentError: (err) =>
      (!!onCoverageRefused && coverageRefusal(err) !== null) ||
      (!!onCodLimitRefused && codLimitRefusal(err) !== null),
    onError: (err) => {
      const coverage = coverageRefusal(err);
      if (coverage) onCoverageRefused?.(coverage);
      const cod = codLimitRefusal(err);
      if (cod) onCodLimitRefused?.(cod);
    },
  };
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
    (id: string, status: ShipmentActionableStatus, statusLabel: string, onStale?: () => void) =>
      run(`status:${id}`, async () => (await shipmentsService.updateStatus(id, status)).data, {
        success: t('actions.statusChanged', { label: statusLabel }),
        // `409 SHIPMENT_DELIVERY_FEE_PENDING`: a fee change (possibly an agent's,
        // made after this view loaded) blocks pickup. Reload so the button greys out.
        onError: (err) => {
          if (getErrorCode(err) === 'SHIPMENT_DELIVERY_FEE_PENDING') onStale?.();
        },
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

  /**
   * Offer to a named agent. When `onCoverageRefused` / `onCodLimitRefused` is
   * given, a `CONTRACT_COVERAGE_REGION_NOT_COVERED` / `COD_AGENT_EXPOSURE_EXCEEDED`
   * refusal goes to it instead of a toast, so the caller can explain it and
   * offer "Send anyway" (a resend with `force: true`). Every other refusal still
   * toasts — none of them is forceable.
   */
  const assignAgent = useCallback(
    (id: string, agentId: string, opts: AssignAgentOptions & ForceableRefusalHandlers = {}) =>
      run(
        `assign:${id}`,
        async () => (await shipmentsService.assignAgent(id, agentId, { force: opts.force })).data,
        {
          success: t('assignment.offerSent'),
          ...forceableHandling(opts),
        },
      ),
    [run, t],
  );

  /**
   * Offer one agent several shipments at once. Resolves to the per-row result
   * (a `200` even when rows fail) or `null` when the whole call was refused.
   * `422 AGENT_AT_CAPACITY` goes to `onAtCapacity` instead of a toast so the
   * caller can let the user resize; every other whole-call refusal toasts, the
   * same as the single assign.
   */
  const assignAgentBulk = useCallback(
    (payload: BulkAssignPayload, handlers: { onAtCapacity?: (refusal: AtCapacityRefusal) => void } = {}) =>
      run('assign-bulk', async () => (await shipmentsService.assignAgentBulk(payload)).data, {
        silentError: (err) => !!handlers.onAtCapacity && atCapacityRefusal(err) !== null,
        onError: (err) => {
          const capacity = atCapacityRefusal(err);
          if (capacity) handlers.onAtCapacity?.(capacity);
        },
      }),
    [run],
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

  /** Same forceable-refusal contract as {@link assignAgent}; only a named `agentId` can be refused for either. */
  const reassign = useCallback(
    (id: string, payload: ReassignPayload, handlers: ForceableRefusalHandlers = {}) =>
      run(`reassign:${id}`, async () => (await shipmentsService.reassign(id, payload)).data, {
        success: t('reassignDialog.success'),
        ...forceableHandling(handlers),
      }),
    [run, t],
  );

  /**
   * Delivery-fee proposals. Every refusal that means "what you saw is out of
   * date" (already pending, answered, edited meanwhile, window closed, gone)
   * also fires `onStale`, so the caller reloads instead of letting the user
   * retry against a stale view. See api-doc/agency/shipments.md § Delivery-fee proposals.
   */
  const staleOnFeeConflict = (onStale?: () => void): RunOptions => ({
    onError: (err) => {
      const code = getErrorCode(err);
      if (code && STALE_FEE_PROPOSAL_CODES.has(code)) onStale?.();
    },
  });

  /**
   * The toast names what actually happened, read off the proposal the server
   * returned: a customer-paid decrease is already applied (`approver: 'none'`),
   * a customer-paid increase went to the customer, anything else to the vendor.
   */
  const proposeDeliveryFee = useCallback(
    async (id: string, payload: CreateDeliveryFeeProposalPayload, onStale?: () => void) => {
      const proposal = await run(
        `fee:${id}`,
        async () => (await shipmentsService.proposeDeliveryFee(id, payload)).data,
        staleOnFeeConflict(onStale),
      );
      if (proposal) {
        toast.success(
          proposal.approver === 'none' && proposal.status === 'approved'
            ? t('deliveryFee.appliedNow')
            : proposal.approver === 'customer'
              ? t('deliveryFee.proposedToCustomer')
              : t('deliveryFee.proposed'),
        );
      }
      return proposal;
    },
    [run, t],
  );

  const editDeliveryFee = useCallback(
    (id: string, proposalId: string, payload: EditDeliveryFeeProposalPayload, onStale?: () => void) =>
      run(
        `fee:${id}`,
        async () => (await shipmentsService.editDeliveryFeeProposal(id, proposalId, payload)).data,
        { success: t('deliveryFee.edited'), ...staleOnFeeConflict(onStale) },
      ),
    [run, t],
  );

  const withdrawDeliveryFee = useCallback(
    (id: string, proposalId: string, onStale?: () => void) =>
      run(
        `fee-withdraw:${proposalId}`,
        async () => (await shipmentsService.withdrawDeliveryFeeProposal(id, proposalId)).data,
        { success: t('deliveryFee.withdrawn'), ...staleOnFeeConflict(onStale) },
      ),
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
    assignAgentBulk,
    autoAssign,
    cancelOffer,
    reassign,
    proposeDeliveryFee,
    editDeliveryFee,
    withdrawDeliveryFee,
  };
}
