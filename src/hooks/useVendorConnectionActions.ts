import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/types/api';
import { vendorConnectionsService } from '@/services/vendor-connections.service';
import type { ConnectionDto } from '@/types/vendor-connection.types';

// ─── Error mapping ────────────────────────────────────────────────────────────
// Friendly, user-facing labels for known vendor-connection error codes. Falls
// back to the backend `err.message` for any unmapped code.

const VENDOR_CONNECTION_ERROR_LABELS: Record<string, string> = {
  CONNECTION_ALREADY_EXISTS: 'You already have a connection request with this vendor.',
  CONNECTION_NOT_APPROVER: "You can't approve or reject a request you sent yourself.",
  CONNECTION_NOT_REQUESTER: "You can't withdraw a request you didn't send.",
  CONNECTION_NOT_PENDING: 'This request is no longer pending.',
  CONNECTION_INVALID_STATUS_TRANSITION: "This connection can't be changed from its current status.",
  CONNECTION_WRONG_REAPPROVAL_PARTY: "It's the vendor's turn to reapprove this connection, not yours.",
  CONNECTION_VENDOR_NOT_FOUND: 'This vendor could no longer be found.',
};

export function getVendorConnectionErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return VENDOR_CONNECTION_ERROR_LABELS[err.code] ?? err.message;
  return 'Something went wrong. Please try again.';
}

// ─── Shared mutation hook ─────────────────────────────────────────────────────

export interface UseVendorConnectionActionsOptions {
  /** Called after any successful mutation, so the caller can refetch/react (e.g. badge refresh). */
  onChanged?: (vendorId: string, dto: ConnectionDto) => void;
}

/**
 * Shared request/approve/reject/withdraw/terminate mutation logic — toast +
 * error mapping + a per-action loading key — used by both the browse tab and
 * the connections list so the flow isn't duplicated.
 */
export function useVendorConnectionActions({ onChanged }: UseVendorConnectionActionsOptions = {}) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const run = useCallback(
    async (
      key: string,
      vendorId: string,
      action: () => Promise<{ data: ConnectionDto }>,
      successMessage: string,
    ): Promise<ConnectionDto | null> => {
      setPendingKey(key);
      try {
        const { data } = await action();
        toast.success(successMessage);
        onChanged?.(vendorId, data);
        return data;
      } catch (err) {
        toast.error(getVendorConnectionErrorMessage(err));
        return null;
      } finally {
        setPendingKey(null);
      }
    },
    [onChanged],
  );

  const request = useCallback(
    (vendorId: string) =>
      run(`request:${vendorId}`, vendorId, () => vendorConnectionsService.request(vendorId), 'Connection request sent.'),
    [run],
  );

  const approve = useCallback(
    (vendorId: string, connectionId: string) =>
      run(`approve:${connectionId}`, vendorId, () => vendorConnectionsService.approve(connectionId), 'Connection approved.'),
    [run],
  );

  const reject = useCallback(
    (vendorId: string, connectionId: string, reason?: string) =>
      run(`reject:${connectionId}`, vendorId, () => vendorConnectionsService.reject(connectionId, reason), 'Request rejected.'),
    [run],
  );

  const withdraw = useCallback(
    (vendorId: string, connectionId: string) =>
      run(`withdraw:${connectionId}`, vendorId, () => vendorConnectionsService.withdraw(connectionId), 'Request withdrawn.'),
    [run],
  );

  const terminate = useCallback(
    (vendorId: string, connectionId: string, note?: string) =>
      run(`terminate:${connectionId}`, vendorId, () => vendorConnectionsService.terminate(connectionId, note), 'Connection terminated.'),
    [run],
  );

  return { pendingKey, request, approve, reject, withdraw, terminate };
}
