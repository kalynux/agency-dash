// ─── Agency Transactions — display helpers ───────────────────────────────────────

import type {
  Transaction,
  TransactionCategory,
  TransactionStatus,
} from '@/types/transactions.types';
import { formatMoney, formatCredits } from './billing.constants';

/** Category sub-tabs shown above the feed. `payout` is omitted (placeholder/empty). */
export const TRANSACTION_CATEGORY_TABS: { value: TransactionCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'plan', label: 'Plans' },
  { value: 'credit', label: 'Credits' },
  { value: 'earning', label: 'Earnings' },
];

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  plan: 'Plan',
  credit: 'Credit',
  earning: 'Earning',
  payout: 'Payout',
};

export function categoryLabel(category: TransactionCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

const STATUS_META: Record<TransactionStatus, { label: string; class: string }> = {
  pending:   { label: 'Pending',   class: 'border-amber-500 text-amber-600 bg-amber-50' },
  paid:      { label: 'Paid',      class: 'border-green-500 text-green-600 bg-green-50' },
  failed:    { label: 'Failed',    class: 'border-red-500 text-red-600 bg-red-50' },
  reversed:  { label: 'Reversed',  class: 'border-orange-500 text-orange-600 bg-orange-50' },
  completed: { label: 'Completed', class: 'border-slate-300 text-slate-600 bg-slate-50' },
  hold:      { label: 'On hold',   class: 'border-amber-500 text-amber-600 bg-amber-50' },
  release:   { label: 'Released',  class: 'border-green-500 text-green-600 bg-green-50' },
  reversal:  { label: 'Reversed',  class: 'border-orange-500 text-orange-600 bg-orange-50' },
};

export function transactionStatusMeta(status: TransactionStatus): { label: string; class: string } {
  return STATUS_META[status] ?? { label: status, class: 'border-border text-muted-foreground' };
}

/** True for chargeback/refund unwinds — surfaced with an explanatory note. */
export function isReversalTransaction(t: Transaction): boolean {
  return t.status === 'reversed' || t.status === 'reversal' || t.type === 'earning_reversal';
}

/** Signed amount text + colour, keyed off `unit` and `direction`. */
export function transactionAmount(t: Transaction): { text: string; className: string } {
  const sign = t.direction === 'out' ? '−' : '+';
  const text =
    t.unit === 'money'
      ? `${sign}${formatMoney(t.amount, t.currency ?? 'XAF')}`
      : `${sign}${formatCredits(t.amount)} cr`;
  // Money leaving / credit spend reads neutral; value coming in reads green.
  const className = t.direction === 'in' ? 'text-green-600' : 'text-foreground';
  return { text, className };
}
