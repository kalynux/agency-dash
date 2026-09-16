import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { earningsService } from '@/services/earnings.service';
import { formatCurrency } from '@/lib/format';
import { getApiErrorMessage, getErrorCode } from '@/lib/errors';
import { ApiError } from '@/types/api';
import {
  EARNINGS_PAYOUT_UNVERIFIED_CAP_REACHED,
  readPayoutCapRefusal,
  type EarningsBalance,
  type EarningsPayoutRequest,
  type PayoutCapRefusal,
} from '@/types/earnings.types';

// ─── Shared earnings hook ─────────────────────────────────────────────────────

export function useEarnings() {
  const { t } = useTranslation('account');
  const [balance, setBalance] = useState<EarningsBalance | null>(null);
  const [latestPayout, setLatestPayout] = useState<EarningsPayoutRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  /**
   * The unverified-account allowance refusing a request.
   *
   * Kept as STATE rather than toasted away, because ⛔ retrying cannot help on
   * either reason: the remedies are verification or waiting for `resetsAt`, and
   * a message that disappears after four seconds leaves the agency pressing a
   * button that will refuse them identically every time. The card renders this
   * in place of the withdraw control.
   *
   * Cleared by {@link refetch}, so it can never outlive the allowance it
   * describes — the card re-derives the block from each fresh balance.
   */
  const [capRefusal, setCapRefusal] = useState<PayoutCapRefusal | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    // A refusal describes the allowance as it stood; re-reading it is the point
    // at which that description stops being ours to keep. The card re-derives
    // the block from the balance that comes back, so a window that has rolled
    // (or an approval that has landed) clears it here rather than lingering.
    setCapRefusal(null);
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
    setCapRefusal(null);
    try {
      const { data } = await earningsService.requestPayout();
      toast.success(
        t('earnings.requested', { amount: formatCurrency(data.amount, data.currency) }),
      );
      await refetch();
      return data;
    } catch (err) {
      // The allowance refusal is the one payout error that is not a passing
      // mishap — it describes a ceiling that will still be there on the next
      // press. Pin it to the card, and skip the toast: the card's copy names the
      // cap, the window and the two remedies, which a toast has no room for.
      if (getErrorCode(err) === EARNINGS_PAYOUT_UNVERIFIED_CAP_REACHED) {
        const refusal = readPayoutCapRefusal(
          err instanceof ApiError ? err.details : undefined,
        );
        if (refusal) {
          // Re-read BEFORE pinning: the allowance may have moved under us
          // (another device spent it, or the window rolled) and the tiles have
          // to agree with the refusal. `refetch` clears any pinned refusal, so
          // this order is load-bearing — pinning first would wipe it.
          await refetch();
          setCapRefusal(refusal);
          return null;
        }
        // Shape we weren't promised: fall through to the catalogued message for
        // the code, which still says the true thing without naming amounts.
      }
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
    capRefusal,
    requestPayout,
    refetch,
  };
}
