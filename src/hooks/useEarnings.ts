import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { earningsService } from '@/services/earnings.service';
import { formatCurrency } from '@/lib/format';
import { getApiErrorMessage } from '@/lib/errors';
import type {
  EarningsBalance,
  EarningsListMeta,
  EarningsListResponse,
  EarningsPayoutRequest,
} from '@/types/earnings.types';

// ─── Shared earnings hook ─────────────────────────────────────────────────────

export function useEarnings() {
  const { t } = useTranslation('account');
  const [balance, setBalance] = useState<EarningsBalance | null>(null);
  const [latestPayout, setLatestPayout] = useState<EarningsPayoutRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [{ data: balanceData }, { data: payoutData }] = await Promise.all([
        earningsService.getBalance(),
        earningsService.getLatestPayout(),
      ]);
      setBalance(balanceData);
      setLatestPayout(payoutData);
    } catch (err) {
      // Resolved through the shared `errors` catalog — the payout codes
      // (EARNINGS_PAYOUT_*) all live there, so there is no local table to keep
      // in step with the backend any more.
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const requestPayout = useCallback(async () => {
    setIsRequesting(true);
    try {
      const { data } = await earningsService.requestPayout();
      toast.success(
        t('earnings.requested', { amount: formatCurrency(data.amount, data.currency) }),
      );
      await refetch();
      return data;
    } catch (err) {
      toast.error(getApiErrorMessage(err));
      return null;
    } finally {
      setIsRequesting(false);
    }
  }, [refetch, t]);

  return {
    balance,
    latestPayout,
    isLoading,
    loadError,
    isRequesting,
    requestPayout,
    refetch,
  };
}

// ─── Paged earnings lists (adjustments, damage claims) ────────────────────────

/**
 * One page of an earnings list, with the page number held here. `fetchPage`
 * must be stable (a service method, not an inline arrow).
 */
export function usePagedEarningsList<T>(
  fetchPage: (page: number, limit: number) => Promise<EarningsListResponse<T>>,
  limit = 10,
) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<T[]>([]);
  const [meta, setMeta] = useState<EarningsListMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetchPage(page, limit);
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, page, limit]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { rows, meta, page, setPage, isLoading, loadError, refetch };
}
