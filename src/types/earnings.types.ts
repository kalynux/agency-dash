// Agency Earnings — see api-doc/agency/earnings.md

export interface EarningsBalance {
  /** Held — hold window not yet elapsed, or COD cash not yet settled. Minor units. */
  pending: number;
  /** Withdrawable — hold window elapsed and (for COD) cash settled. Minor units. */
  available: number;
  /** COD rolling reserve — a slice of released COD earnings parked for 30 days. Minor units. */
  reserve: number;
  /** Earmarked for a pending payout request. Minor units. */
  requested: number;
  currency: string;
}

export interface EarningsBalanceResponse {
  success: true;
  data: EarningsBalance;
}

// ─── Payout requests ──────────────────────────────────────────────────────────

export type EarningsPayoutStatus = 'pending' | 'paid' | 'rejected';

export interface EarningsPayoutRequest {
  id: string;
  amount: number;
  currency: string;
  status: EarningsPayoutStatus;
  /** `manual` (you requested it) or `auto_threshold` (platform opened it at the balance cap). */
  origin?: 'manual' | 'auto_threshold';
  /** The linked PAYOUT_REQUEST support ticket — open it under Tickets for the full history. */
  ticketId: string;
  rejectionReason: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** POST /agency/earnings/payout */
export interface EarningsPayoutRequestResponse {
  success: true;
  data: EarningsPayoutRequest;
  message?: string;
}

/** GET /agency/earnings/payout — null if no payout was ever requested. */
export interface EarningsPayoutStatusResponse {
  success: true;
  data: EarningsPayoutRequest | null;
}
