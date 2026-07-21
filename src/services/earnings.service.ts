import { api } from './api';
import type {
  EarningsBalanceResponse,
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
};
