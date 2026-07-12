import type { TransactionCategory, TransactionStatus } from '@/types';

export const TRANSACTION_CATEGORY_TABS: { value: TransactionCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'earning', label: 'Earnings' },
  { value: 'payout', label: 'Payouts' },
  { value: 'credit', label: 'Credits' },
  { value: 'plan', label: 'Plan' },
];

export function categoryLabel(category: TransactionCategory): string {
  switch (category) {
    case 'earning': return 'Earning';
    case 'payout': return 'Payout';
    case 'credit': return 'Credit';
    case 'plan': return 'Plan Fee';
    default: return category;
  }
}

export const transactionStatusMeta: Record<TransactionStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-yellow-500 text-yellow-600 bg-yellow-50' },
  paid: { label: 'Paid', className: 'border-green-500 text-green-600 bg-green-50' },
  completed: { label: 'Completed', className: 'border-green-500 text-green-600 bg-green-50' },
  failed: { label: 'Failed', className: 'border-red-500 text-red-600 bg-red-50' },
  reversed: { label: 'Reversed', className: 'border-gray-500 text-gray-600 bg-gray-50' },
};

export function transactionAmount(amount: number, currency: string, direction: 'in' | 'out'): string {
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  return direction === 'in' ? `+${formatted}` : `-${formatted}`;
}
