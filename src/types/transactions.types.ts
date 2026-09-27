// ─── Agency Transactions — unified money/credit feed ─────────────────────────────
// Mirrors api-doc/agency/transactions (same shape as the vendor feed). This single
// feed merges plan purchases, credit top-ups/ledger movements and delivery-fee
// earnings into one normalized, paginated history.

import type { PaymentGateway } from './billing.types';

/** Top-level grouping for a transaction. `payout` rows are your payout requests (since 2026-09-27). */
export type TransactionCategory = 'plan' | 'credit' | 'earning' | 'payout';

export type TransactionType =
  | 'plan_purchase'
  | 'credit_topup'
  | 'credit_allowance'
  | 'credit_usage'
  | 'credit_adjustment'
  | 'earning_hold'
  | 'earning_release'
  | 'earning_reversal'
  | 'earning_reserve_hold'
  | 'earning_reserve_release'
  | 'payout';

/**
 * Source status, normalized across categories:
 * - money txns (plan/credit money): `pending` | `paid` | `failed` | `reversed`
 * - earnings: `hold` | `release` | `reversal` | `reserve_hold` | `reserve_release`
 * - payouts: `pending` | `processing` | `paid` | `rejected` | `failed`
 * - credit moves: `completed`
 */
export type TransactionStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'rejected'
  | 'reversed'
  | 'hold'
  | 'release'
  | 'reversal'
  | 'reserve_hold'
  | 'reserve_release'
  | 'completed';

/** `money` rows carry a `currency`; `credit` rows are in credit units. */
export type TransactionUnit = 'money' | 'credit';

/**
 * `in` = value into the agency; `out` = value leaving. Drives the displayed sign.
 *
 * `internal` = money moving between the agency's own balances (escrow release,
 * COD reserve move, a payout that is pending, rejected or failed). It is neither
 * gained nor lost, so it must be **left out of every total** — summing it is
 * what used to count each earning twice.
 */
export type TransactionDirection = 'in' | 'out' | 'internal';

export interface TransactionSource {
  type: string;
  id: string;
}

export interface Transaction {
  id: string;
  category: TransactionCategory;
  type: TransactionType;
  status: TransactionStatus;
  unit: TransactionUnit;
  direction: TransactionDirection;
  /** Positive magnitude in `unit` — combine with `direction` for sign. */
  amount: number;
  /** Present when `unit === 'money'`. */
  currency?: string;
  /** Credits granted (top-up) or the magnitude of a credit move. */
  credits?: number;
  description: string;
  /** Present for billing rows. */
  gateway?: PaymentGateway;
  source?: TransactionSource;
  createdAt: string;
}

export interface TransactionsQueryParams {
  page?: number;
  limit?: number;
  /** Filter to one category; omit for everything. */
  category?: TransactionCategory;
}

export interface TransactionsListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TransactionsResponse {
  success: boolean;
  data: Transaction[];
  meta: TransactionsListMeta;
}
