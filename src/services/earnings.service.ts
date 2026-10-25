import { api } from './api';
import type {
  AgencyDamageClaim,
  EarningsAdjustment,
  EarningsBalanceResponse,
  EarningsListResponse,
  EarningsPayoutRequestResponse,
  EarningsPayoutStatusResponse,
} from '@/types/earnings.types';

export const earningsService = {
  /** GET /agency/earnings — this agency's pending (held) vs available (withdrawable) delivery-fee balance. */
  getBalance(): Promise<EarningsBalanceResponse> {
    return api.get<EarningsBalanceResponse>('/agency/earnings');
  },
  /** POST /agency/earnings/payout — request a payout of the entire current available balance. */
  requestPayout(): Promise<EarningsPayoutRequestResponse> {
    return api.post<EarningsPayoutRequestResponse>('/agency/earnings/payout');
  },
  /** GET /agency/earnings/payout — this agency's latest payout request, or null if none was ever made. */
  getLatestPayout(): Promise<EarningsPayoutStatusResponse> {
    return api.get<EarningsPayoutStatusResponse>('/agency/earnings/payout');
  },
  /** GET /agency/earnings/adjustments — money taken back, debts repaid or forgiven, each with its reason. `limit` ≤ 100. */
  listAdjustments(page: number, limit: number): Promise<EarningsListResponse<EarningsAdjustment>> {
    return api.get<EarningsListResponse<EarningsAdjustment>>(
      `/agency/earnings/adjustments?page=${page}&limit=${limit}`,
    );
  },
  /** GET /agency/earnings/claims — damage claims charged to this agency. `limit` ≤ 100. */
  listClaims(page: number, limit: number): Promise<EarningsListResponse<AgencyDamageClaim>> {
    return api.get<EarningsListResponse<AgencyDamageClaim>>(
      `/agency/earnings/claims?page=${page}&limit=${limit}`,
    );
  },
};
