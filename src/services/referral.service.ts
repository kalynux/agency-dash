import { api } from './api';
import type { EarningsListResponse } from '@/types/earnings.types';
import type {
  ReferralApplyResponse,
  ReferralListResponse,
  ReferralOverviewResponse,
  ReferralPayout,
  ReferralPayoutResponse,
  ReferralReward,
  ReferredAccount,
} from '@/types/referral.types';

/**
 * One page of a list, in the shape the earnings lists' hook and pager read, so the
 * referral page uses those rather than a second copy of them.
 */
async function listPage<T>(path: string, page: number, limit: number): Promise<EarningsListResponse<T>> {
  const res = await api.get<ReferralListResponse<T>>(`${path}?page=${page}&limit=${limit}`);
  const { totalPages, ...meta } = res.meta;
  return { ...res, meta: { ...meta, pages: totalPages } };
}

/**
 * `/me/referral` resolves the partner from the session, so nothing agency-specific
 * is sent. See api-doc/me/referrals.md. `PUT /me/referral/payout-method` is absent
 * on purpose: an agency's destination is edited on Account → Payout.
 */
export const referralService = {
  /** GET /me/referral — everything the page needs to decide what to show. */
  getOverview(): Promise<ReferralOverviewResponse> {
    return api.get<ReferralOverviewResponse>('/me/referral');
  },
  /** POST /me/referral/application — accepting the Partner Terms is what an application is. */
  apply(motivation: string): Promise<ReferralApplyResponse> {
    return api.post<ReferralApplyResponse>('/me/referral/application', {
      termsAccepted: true,
      motivation: motivation || undefined,
    });
  },
  /** POST /me/referral/payout — withdraw the whole available balance. */
  requestPayout(): Promise<ReferralPayoutResponse> {
    return api.post<ReferralPayoutResponse>('/me/referral/payout');
  },
  /** GET /me/referral/referred — the accounts this partner referred, newest first. */
  listReferred(page: number, limit: number): Promise<EarningsListResponse<ReferredAccount>> {
    return listPage<ReferredAccount>('/me/referral/referred', page, limit);
  },
  /** GET /me/referral/rewards — newest first. */
  listRewards(page: number, limit: number): Promise<EarningsListResponse<ReferralReward>> {
    return listPage<ReferralReward>('/me/referral/rewards', page, limit);
  },
  /** GET /me/referral/payouts */
  listPayouts(page: number, limit: number): Promise<EarningsListResponse<ReferralPayout>> {
    return listPage<ReferralPayout>('/me/referral/payouts', page, limit);
  },
};
