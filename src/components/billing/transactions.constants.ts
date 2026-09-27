// ─── Agency Transactions — display helpers ───────────────────────────────────────

import { txStatic } from '@/i18n/tx';
import type {
  Transaction,
  TransactionCategory,
  TransactionStatus,
} from '@/types/transactions.types';
import { formatMoney, formatCredits } from './billing.constants';

/**
 * Category sub-tabs shown above the feed. `payout` returns your payout requests
 * (it answered empty before 2026-09-27).
 *
 * Labels are keys, not copy: this is module-scope data evaluated once at import,
 * so a translated string here would freeze in whatever language was active at
 * boot. `TransactionsTab` resolves them at render.
 */
export const TRANSACTION_CATEGORY_TABS: {
  value: TransactionCategory | 'all';
  labelKey: string;
}[] = [
  { value: 'all', labelKey: 'billing:transactions.categoryTabs.all' },
  { value: 'plan', labelKey: 'billing:transactions.categoryTabs.plan' },
  { value: 'credit', labelKey: 'billing:transactions.categoryTabs.credit' },
  { value: 'earning', labelKey: 'billing:transactions.categoryTabs.earning' },
  { value: 'payout', labelKey: 'billing:transactions.categoryTabs.payout' },
];

export function categoryLabel(category: TransactionCategory): string {
  const key = `billing:transactions.categoryChip.${category}`;
  const label = txStatic(key);
  return label === key ? category : label;
}

const STATUS_CLASSES: Record<TransactionStatus, string> = {
  pending: 'border-amber-500 text-amber-600 bg-amber-50',
  processing: 'border-sky-500 text-sky-600 bg-sky-50',
  paid: 'border-green-500 text-green-600 bg-green-50',
  failed: 'border-red-500 text-red-600 bg-red-50',
  rejected: 'border-red-500 text-red-600 bg-red-50',
  reversed: 'border-orange-500 text-orange-600 bg-orange-50',
  completed: 'border-slate-300 text-slate-600 bg-slate-50',
  hold: 'border-amber-500 text-amber-600 bg-amber-50',
  release: 'border-slate-300 text-slate-600 bg-slate-50',
  reversal: 'border-orange-500 text-orange-600 bg-orange-50',
  reserve_hold: 'border-slate-300 text-slate-600 bg-slate-50',
  reserve_release: 'border-slate-300 text-slate-600 bg-slate-50',
};

export function transactionStatusMeta(status: TransactionStatus): { label: string; class: string } {
  const cls = STATUS_CLASSES[status];
  if (!cls) return { label: status, class: 'border-border text-muted-foreground' };
  return { label: txStatic(`billing:transactions.status.${status}`), class: cls };
}

/** True for chargeback/refund unwinds — surfaced with an explanatory note. */
export function isReversalTransaction(t: Transaction): boolean {
  return t.status === 'reversed' || t.status === 'reversal' || t.type === 'earning_reversal';
}

/**
 * Money moving between the agency's own balances — an escrow release, a COD
 * reserve move, a payout that is pending, rejected or failed. Neither gained nor
 * lost, so it is rendered muted and never summed.
 */
export function isInternalTransaction(t: Transaction): boolean {
  return t.direction === 'internal';
}

/** Signed amount text + colour, keyed off `unit` and `direction`. */
export function transactionAmount(t: Transaction): { text: string; className: string } {
  // An internal move has no sign: printing "+" would read as income.
  const sign = t.direction === 'out' ? '−' : t.direction === 'in' ? '+' : '';
  const text =
    t.unit === 'money'
      ? `${sign}${formatMoney(t.amount, t.currency ?? 'XAF')}`
      : `${sign}${formatCredits(t.amount)} ${txStatic('billing:transactions.creditsSuffix')}`;
  // Money leaving / credit spend reads neutral; value coming in reads green;
  // an internal move is muted.
  const className =
    t.direction === 'in'
      ? 'text-green-600'
      : t.direction === 'out'
        ? 'text-foreground'
        : 'text-muted-foreground';
  return { text, className };
}
