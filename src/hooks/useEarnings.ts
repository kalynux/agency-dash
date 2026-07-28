import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/types/api';
import { earningsService } from '@/services/earnings.service';
import type { EarningsBalance, EarningsPayoutRequest } from '@/types/earnings.types';

// ─── Error mapping ────────────────────────────────────────────────────────────

const PAYOUT_ERROR_LABELS: Record<string, string> = {
  EARNINGS_PAYOUT_ALREADY_PENDING: 'You already have a pending payout request.',
  EARNINGS_PAYOUT_METHOD_MISSING: 'Add a payout method below before requesting a withdrawal.',
  EARNINGS_PAYOUT_NO_AVAILABLE_BALANCE: 'There is no available balance to withdraw yet.',
  EARNINGS_PAYOUT_BELOW_MINIMUM: 'Your available balance is below the 10,000 XAF minimum payout.',
};

function getPayoutErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return PAYOUT_ERROR_LABELS[err.code] ?? err.message;
  return 'Something went wrong. Please try again.';
}

// ─── Shared earnings hook ─────────────────────────────────────────────────────

export function useEarnings() {
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
      setLoadError(err instanceof ApiError ? err.message : 'Could not load your earnings.');
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
      toast.success(`Payout of ${data.amount.toLocaleString()} ${data.currency} requested — track it under Tickets.`);
      await refetch();
      return data;
    } catch (err) {
      toast.error(getPayoutErrorMessage(err));
      return null;
    } finally {
      setIsRequesting(false);
    }
  }, [refetch]);

  return { balance, latestPayout, isLoading, loadError, isRequesting, requestPayout, refetch };
}
