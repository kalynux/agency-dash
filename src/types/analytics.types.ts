// ─── Agency Analytics — GET /api/agency/analytics ────────────────────────────────
// Mirrors api-doc/agency/analytics.md. Every earnings figure is read from the
// entries the platform actually wrote (the same ones that fill the balance), so
// none of this is an estimate. Amounts are whole currency units (`meta.currency`).

export interface AnalyticsQuery {
  /** Local calendar day, `YYYY-MM-DD`. Inclusive. */
  from: string;
  /** Local calendar day, `YYYY-MM-DD`. Inclusive; at most 366 days after `from`. */
  to: string;
  /** IANA zone; the server defaults to `Africa/Douala`. */
  timezone?: string;
}

export interface AgencyAnalyticsEarnings {
  deliveriesCredited: number;
  /**
   * The runs' delivery fees before the agent's share (the RTO fee on a returned
   * prepaid order). `null` when a COD run has no recorded delivery fee, so the
   * COD fee cannot be separated from it — render "not separable", never 0.
   */
  deliveryFeesEarned: number | null;
  /** COD handling fees kept whole. `null` in the same case as `deliveryFeesEarned`. */
  codFees: number | null;
  agentShares: number;
  /** Credited to the agency = fees earned − agents' shares + COD fees. */
  agencyNet: number;
  /** Where `agencyNet` sits now. */
  byStatus: { held: number; released: number; reversed: number };
  reversedInPeriod: number;
  /** `agencyNet − reversedInPeriod`. */
  netEarnings: number;
}

/** Shipments that reached each outcome in the period, each counted once. */
export interface AgencyAnalyticsDeliveries {
  delivered: number;
  returned: number;
  failed: number;
}

/** Cash is a liability, not income — reported apart from earnings on purpose. */
export interface AgencyAnalyticsCod {
  collectedByAgents: number;
  depositsConfirmed: number;
  remittedToPlatform: number;
  /** What the agency owes the platform right now, regardless of the period. */
  liabilityNow: number;
}

export interface AgencyAnalyticsAgentRow {
  agentId: string;
  name: string;
  deliveriesCredited: number;
  agentShare: number;
  codCollected: number;
}

export interface AgencyAnalyticsPayouts {
  paidInPeriod: number;
  /** Every payout ever PAID to the agency, regardless of the period. */
  lifetimePaidOut: number;
}

export interface AgencyAnalytics {
  earnings: AgencyAnalyticsEarnings;
  deliveries: AgencyAnalyticsDeliveries;
  cod: AgencyAnalyticsCod;
  perAgent: AgencyAnalyticsAgentRow[];
  payouts: AgencyAnalyticsPayouts;
}

export interface AgencyAnalyticsMeta {
  from: string;
  to: string;
  timezone: string;
  computedAt: string;
  currency: string;
}

export interface AgencyAnalyticsResponse {
  success: boolean;
  data: AgencyAnalytics;
  meta: AgencyAnalyticsMeta;
}
