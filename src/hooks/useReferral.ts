import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { referralService } from '@/services/referral.service';
import { formatCurrency } from '@/lib/format';
import { getApiErrorMessage } from '@/lib/errors';
import type { ReferralOverview, ReferralPayout } from '@/types/referral.types';

/**
 * The referral page's overview, and the two things it can do. A refusal reloads
 * the overview as well as saying why: each 409 here means the page was out of date
 * (the program closed, an administrator acted), so the next screen must not offer
 * the same button again.
 */
export function useReferral() {
  const { t } = useTranslation('account');
  const [overview, setOverview] = useState<ReferralOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await referralService.getOverview();
      setOverview(data);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const apply = useCallback(async (motivation: string): Promise<void> => {
    setIsApplying(true);
    try {
      await referralService.apply(motivation);
      toast.success(t('referrals.apply.sent'));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsApplying(false);
    }
    await refetch();
  }, [refetch, t]);

  const withdraw = useCallback(async (): Promise<ReferralPayout | null> => {
    setIsWithdrawing(true);
    let payout: ReferralPayout | null = null;
    try {
      const { data } = await referralService.requestPayout();
      payout = data;
      toast.success(
        t('referrals.withdraw.requested', { amount: formatCurrency(data.amount, data.currency) }),
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsWithdrawing(false);
    }
    await refetch();
    return payout;
  }, [refetch, t]);

  return { overview, isLoading, loadError, isApplying, isWithdrawing, apply, withdraw, refetch };
}
