// Role closure (ADR-A10, 2026-10-04) — an administrator ASKS to close this
// agency account; nothing happens until the owner confirms it here, signed in
// as the agency. See api-doc/me/role-closure.md (the contract) and
// api-doc/agency/FRONTEND-CHANGELOG-role-closure.md (this app's tasks).
//
// ⚠ Copy says **close**, never "delete" (ADR-A02 D-2). The role is anonymised
// and retained, not erased.

export type RoleClosureRequestStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'expired';

/**
 * The codes an AGENCY can receive (api-doc/agency/FRONTEND-CHANGELOG-role-closure.md
 * § Blocker codes). The vocabulary is closed backend-side, but a code added
 * later must still render — hence the open string tail and a generic fallback
 * in the screen.
 */
export type AgencyClosureBlockerCode =
  | 'shipments_unterminated'
  | 'cod_collections_pending'
  | 'cod_cash_held'
  | 'cod_remittances_declared'
  | 'cod_discrepancies_open'
  | 'payout_request_held'
  | 'earnings_balance'
  | 'earnings_allocations_held'
  | 'agency_stock_held'
  | 'storage_invoices_open'
  | 'stock_requests_pending';

export interface RoleClosureBlocker {
  code: AgencyClosureBlockerCode | (string & {});
  /** How many records hold the account open. */
  count: number;
  /** Money blockers only (`cod_cash_held`, `earnings_balance`): the amount at stake. */
  amount?: number;
  /** `earnings_balance` only. */
  currency?: string;
}

export type RoleClosureWarningCode = 'prepaid_plan_forfeited' | 'credit_balance_forfeited';

/** What confirming LOSES. Shown before the button; never blocks. */
export interface RoleClosureWarning {
  code: RoleClosureWarningCode | (string & {});
  /** `prepaid_plan_forfeited`: the plan's code. */
  planCode: string | null;
  /** `prepaid_plan_forfeited`: when the paid term would have ended. */
  expiresAt: string | null;
  /** `credit_balance_forfeited`: the credits lost. */
  amount: number | null;
}

export interface RoleClosureOutcome {
  closedAt: string;
  /**
   * `false` — only the agency role closed; the person keeps their other roles
   * and goes to sign-in. `true` — it was their last role, so the whole account
   * is closed and there is nothing to sign in to.
   */
  accountClosed: boolean;
  /** Agent contracts and vendor connections ended with the agency. */
  endedRelationships: number;
}

export interface RoleClosureRequest {
  id: string;
  role: string;
  /** Effective, not stored: a pending row past `expiresAt` reads `expired`. */
  status: RoleClosureRequestStatus;
  /** The administrator's own words — shown verbatim, never translated. */
  reason: string;
  requestedAt: string;
  expiresAt: string;
  warnings: RoleClosureWarning[];
  /** Evaluated live. `null` once the request is no longer pending. */
  blockers: RoleClosureBlocker[] | null;
  /** Blockers empty AND still pending. The only thing that enables Confirm. */
  canConfirm: boolean;
  outcome: RoleClosureOutcome | null;
}

/** `data: null` is the ordinary "nothing is waiting" answer, not an error. */
export interface ClosureRequestResponse {
  success: true;
  data: RoleClosureRequest | null;
}

export interface ClosureRequestMutationResponse {
  success: true;
  data: RoleClosureRequest;
}

/** The exact phrase the API requires on confirm (the body is `.strict()`). */
export const CLOSURE_CONFIRM_PHRASE = 'CLOSE MY ACCOUNT';

/** `note` on decline: optional, ≤ 500 characters. */
export const CLOSURE_DECLINE_NOTE_MAX = 500;
