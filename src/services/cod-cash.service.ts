import { api } from './api';
import type {
  CodSummaryResponse,
  CodDepositResponse,
  ListCodDepositsResponse,
  ListDepositsParams,
  CodRemittanceResponse,
  ListCodRemittancesResponse,
  ListRemittancesParams,
  CodDiscrepancyResponse,
  ListCodDiscrepanciesResponse,
  ListDiscrepanciesParams,
  CodDiscrepancyType,
} from '@/types/cod-cash.types';

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const codCashService = {
  /** GET /agency/cod/summary — the agency's cash position. */
  getSummary(): Promise<CodSummaryResponse> {
    return api.get<CodSummaryResponse>('/agency/cod/summary');
  },

  /** POST /agency/cod/deposits — record cash physically received from an agent. */
  recordDeposit(agentId: string, amount: number, note?: string): Promise<CodDepositResponse> {
    return api.post<CodDepositResponse>('/agency/cod/deposits', { agentId, amount, note });
  },

  /** GET /agency/cod/deposits — deposit history + the declarations inbox (`status=declared`). */
  listDeposits(params: ListDepositsParams = {}): Promise<ListCodDepositsResponse> {
    return api.get<ListCodDepositsResponse>(
      `/agency/cod/deposits${buildQueryString(params as Record<string, unknown>)}`,
    );
  },

  /** POST /agency/cod/deposits/:id/confirm — confirm a hand-over an agent declared (money moves). */
  confirmDeposit(id: string): Promise<CodDepositResponse> {
    return api.post<CodDepositResponse>(`/agency/cod/deposits/${id}/confirm`);
  },

  /** POST /agency/cod/deposits/:id/reject — reject a declared hand-over (no money moves). */
  rejectDeposit(id: string, reason: string): Promise<CodDepositResponse> {
    return api.post<CodDepositResponse>(`/agency/cod/deposits/${id}/reject`, { reason });
  },

  /** POST /agency/cod/remittances — declare a cash transfer to the platform. */
  declareRemittance(amount: number, reference: string, note?: string): Promise<CodRemittanceResponse> {
    return api.post<CodRemittanceResponse>('/agency/cod/remittances', { amount, reference, note });
  },

  /** GET /agency/cod/remittances — remittance history. */
  listRemittances(params: ListRemittancesParams = {}): Promise<ListCodRemittancesResponse> {
    return api.get<ListCodRemittancesResponse>(
      `/agency/cod/remittances${buildQueryString(params as Record<string, unknown>)}`,
    );
  },

  /** POST /agency/cod/discrepancies — flag an agent cash problem. */
  raiseDiscrepancy(
    agentId: string,
    type: CodDiscrepancyType,
    amount?: number,
    note?: string,
  ): Promise<CodDiscrepancyResponse> {
    return api.post<CodDiscrepancyResponse>('/agency/cod/discrepancies', { agentId, type, amount, note });
  },

  /** GET /agency/cod/discrepancies — this agency's discrepancy flags. */
  listDiscrepancies(params: ListDiscrepanciesParams = {}): Promise<ListCodDiscrepanciesResponse> {
    return api.get<ListCodDiscrepanciesResponse>(
      `/agency/cod/discrepancies${buildQueryString(params as Record<string, unknown>)}`,
    );
  },
};
