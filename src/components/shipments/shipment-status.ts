import type { ShipmentStatus } from '@/types/shipment.types';

/**
 * Colour per shipment status. The label lives in `shipments:status.*`, keyed by
 * the same enum — an exhaustive `Record` here is what guarantees a new backend
 * status can't ship without both a colour and a translation key.
 *
 * Its own module so surfaces that need only part of it read the same map the
 * badge does instead of duplicating it and drifting:
 *
 * | field       | used by                                                     |
 * |-------------|-------------------------------------------------------------|
 * | `className` | the full badge — text + tint + border                        |
 * | `dot`       | the status dot, where a badge on every row is all chrome     |
 * | `text`      | a bare coloured label, next to that dot                      |
 */
export const SHIPMENT_STATUS_STYLE: Record<
  ShipmentStatus,
  { dot: string; text: string; className: string }
> = {
  pending: {
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
    className: 'text-muted-foreground bg-muted border-border',
  },
  assigned: {
    dot: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    className: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800',
  },
  handing_over: {
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  },
  picked_up: {
    dot: 'bg-indigo-500',
    text: 'text-indigo-600 dark:text-indigo-400',
    className: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-950 dark:border-indigo-800',
  },
  in_transit: {
    dot: 'bg-purple-500',
    text: 'text-purple-600 dark:text-purple-400',
    className: 'text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950 dark:border-purple-800',
  },
  agent_delivered: {
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  },
  delivered: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    className: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800',
  },
  failed: {
    dot: 'bg-destructive',
    text: 'text-destructive',
    className: 'text-destructive bg-destructive/10 border-destructive/20',
  },
  returned: {
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
    className: 'text-muted-foreground bg-muted border-border',
  },
  rejected: {
    dot: 'bg-destructive',
    text: 'text-destructive',
    className: 'text-destructive bg-destructive/10 border-destructive/20',
  },
  pending_agency_reassignment: {
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  },
};
