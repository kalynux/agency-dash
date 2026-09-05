// Agency — COD Cash Management — see api-doc/agency/cod-cash-management.md

export interface CodSummaryAgent {
  id: string;
  name: string;
  cashHeld: number;
}

export interface CodSummary {
  liability: { balance: number; currency: string };
  agents: CodSummaryAgent[];
  unsettledCollections: { count: number; amount: number };
}

export type CodDepositStatus = 'declared' | 'confirmed' | 'rejected';
/** Who the cash was declared as handed to — `agency` (yours to answer) or `platform` (admin's). */
export type CodDepositRecipient = 'agency' | 'platform';

export interface CodDeposit {
  id: string;
  agentId: string;
  amount: number;
  currency: string;
  note: string | null;
  /** Present when you recorded it at the desk; null on an unconfirmed declaration. */
  recordedAt: string | null;
  // ── Present on GET /cod/deposits list rows (absent on the record response) ──
  status?: CodDepositStatus;
  recipient?: CodDepositRecipient;
  /** When the agent declared it; null when you recorded it yourself. */
  declaredAt?: string | null;
  /** The agent's transfer reference, for direct-to-platform payments. */
  reference?: string | null;
  resolvedAt?: string | null;
  rejectionReason?: string | null;
}

export type CodRemittanceStatus = 'declared' | 'confirmed' | 'rejected';

export interface CodRemittance {
  id: string;
  agencyId: string;
  amount: number;
  currency: string;
  reference: string;
  note: string | null;
  status: CodRemittanceStatus;
  declaredAt: string;
  resolvedAt: string | null;
  rejectionReason: string | null;
}

export type CodDiscrepancyType = 'cash_shortfall' | 'other';
export type CodDiscrepancyStatus = 'open' | 'resolved' | 'written_off';

export interface CodDiscrepancy {
  id: string;
  agentId: string;
  agencyId: string;
  type: CodDiscrepancyType;
  amount: number | null;
  currency: string;
  status: CodDiscrepancyStatus;
  raisedBy: string;
  note: string | null;
  resolutionNote: string | null;
  openedAt: string;
  resolvedAt: string | null;
}

// ─── Query params & response envelopes ─────────────────────────────────────────

export interface CodListMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ListDepositsParams {
  agentId?: string;
  status?: CodDepositStatus;
  page?: number;
  limit?: number;
}

export interface ListRemittancesParams {
  status?: CodRemittanceStatus;
  page?: number;
  limit?: number;
}

export interface ListDiscrepanciesParams {
  status?: CodDiscrepancyStatus;
  agentId?: string;
  page?: number;
  limit?: number;
}

export interface CodSummaryResponse {
  success: true;
  data: CodSummary;
}

export interface CodDepositResponse {
  success: true;
  data: CodDeposit;
  message?: string;
}

export interface ListCodDepositsResponse {
  success: true;
  data: CodDeposit[];
  meta: CodListMeta;
}

export interface CodRemittanceResponse {
  success: true;
  data: CodRemittance;
  message?: string;
}

export interface ListCodRemittancesResponse {
  success: true;
  data: CodRemittance[];
  meta: CodListMeta;
}

export interface CodDiscrepancyResponse {
  success: true;
  data: CodDiscrepancy;
  message?: string;
}

export interface ListCodDiscrepanciesResponse {
  success: true;
  data: CodDiscrepancy[];
  meta: CodListMeta;
}
