import type { StockState } from '@/types/inventory.types';

/**
 * Colour per stock state. The label lives in `inventory:stockState.*`, keyed by
 * the same enum — an exhaustive `Record` is what guarantees a new backend state
 * can't ship without both a colour and a translation key.
 *
 * Deliberately the same three tints the rest of the dashboard already means
 * these things by: emerald = fine, amber = needs attention soon, destructive =
 * acting now. See `SHIPMENT_STATUS_STYLE` for the same table on shipments.
 *
 * | field       | used by                                                  |
 * |-------------|----------------------------------------------------------|
 * | `className` | the full badge — text + tint + border                     |
 * | `dot`       | the status dot, where a badge on every row is all chrome   |
 * | `text`      | a bare coloured number, e.g. the count in the summary strip |
 */
export const STOCK_STATE_STYLE: Record<
  StockState,
  { dot: string; text: string; className: string }
> = {
  in_stock: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    className:
      'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800',
  },
  low: {
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    className:
      'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  },
  out_of_stock: {
    dot: 'bg-destructive',
    text: 'text-destructive',
    className: 'text-destructive bg-destructive/10 border-destructive/20',
  },
};

/** Stock states offered in the filter sheet, in severity order. */
export const STOCK_STATE_FILTER_VALUES = ['all', 'in_stock', 'low', 'out_of_stock'] as const;
