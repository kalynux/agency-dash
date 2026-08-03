import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { vendorConnectionsService } from '@/services/vendor-connections.service';
import type { ConnectionDto } from '@/types/vendor-connection.types';

// ─── Error mapping ────────────────────────────────────────────────────────────
// Screen-specific phrasing layered over the central registry (@/lib/errors).
// Values are translation keys, not copy — `getApiErrorMessage` resolves them.

const VENDOR_CONNECTION_ERROR_OVERRIDES: Record<string, string> = {
  CONNECTION_ALREADY_EXISTS: 'vendors:errors.alreadyExists',
  CONNECTION_NOT_APPROVER: 'vendors:errors.notApprover',
  CONNECTION_NOT_REQUESTER: 'vendors:errors.notRequester',
  CONNECTION_WRONG_REAPPROVAL_PARTY: 'vendors:errors.wrongReapprovalParty',
};

export function getVendorConnectionErrorMessage(err: unknown): string {
  return getApiErrorMessage(err, VENDOR_CONNECTION_ERROR_OVERRIDES);
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
  const { t } = useTranslation('vendors');
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
      run(`request:${vendorId}`, vendorId, () => vendorConnectionsService.request(vendorId), t('toasts.requested')),
    [run, t],
  );

  const approve = useCallback(
    (vendorId: string, connectionId: string) =>
      run(`approve:${connectionId}`, vendorId, () => vendorConnectionsService.approve(connectionId), t('toasts.approved')),
    [run, t],
  );

  const reject = useCallback(
    (vendorId: string, connectionId: string, reason?: string) =>
      run(`reject:${connectionId}`, vendorId, () => vendorConnectionsService.reject(connectionId, reason), t('toasts.rejected')),
    [run, t],
  );

  const withdraw = useCallback(
    (vendorId: string, connectionId: string) =>
      run(`withdraw:${connectionId}`, vendorId, () => vendorConnectionsService.withdraw(connectionId), t('toasts.withdrawn')),
    [run, t],
  );

  const terminate = useCallback(
    (vendorId: string, connectionId: string, note?: string) =>
      run(`terminate:${connectionId}`, vendorId, () => vendorConnectionsService.terminate(connectionId, note), t('toasts.terminated')),
    [run, t],
  );

  return { pendingKey, request, approve, reject, withdraw, terminate };
}
