// ─── Agency Transactions — display helpers ───────────────────────────────────────

import { txStatic } from '@/i18n/tx';
import type {
  Transaction,
  TransactionCategory,
  TransactionStatus,
} from '@/types/transactions.types';
import { formatMoney, formatCredits } from './billing.constants';

/**
 * Category sub-tabs shown above the feed. `payout` is omitted (placeholder/empty).
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
];

export function categoryLabel(category: TransactionCategory): string {
  const key = `billing:transactions.categoryChip.${category}`;
  const label = txStatic(key);
  return label === key ? category : label;
}

const STATUS_CLASSES: Record<TransactionStatus, string> = {
  pending: 'border-amber-500 text-amber-600 bg-amber-50',
  paid: 'border-green-500 text-green-600 bg-green-50',
  failed: 'border-red-500 text-red-600 bg-red-50',
  reversed: 'border-orange-500 text-orange-600 bg-orange-50',
  completed: 'border-slate-300 text-slate-600 bg-slate-50',
  hold: 'border-amber-500 text-amber-600 bg-amber-50',
  release: 'border-green-500 text-green-600 bg-green-50',
  reversal: 'border-orange-500 text-orange-600 bg-orange-50',
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

/** Signed amount text + colour, keyed off `unit` and `direction`. */
export function transactionAmount(t: Transaction): { text: string; className: string } {
  const sign = t.direction === 'out' ? '−' : '+';
  const text =
    t.unit === 'money'
      ? `${sign}${formatMoney(t.amount, t.currency ?? 'XAF')}`
      : `${sign}${formatCredits(t.amount)} ${txStatic('billing:transactions.creditsSuffix')}`;
  // Money leaving / credit spend reads neutral; value coming in reads green.
  const className = t.direction === 'in' ? 'text-green-600' : 'text-foreground';
  return { text, className };
}
