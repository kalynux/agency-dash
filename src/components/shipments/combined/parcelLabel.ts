import type { AnyTFunction } from '@/i18n/tx';
import type { ParcelSummary } from './useParcelSummaries';

/**
 * How a parcel of a combined-price request is named: "Order #1042 · Awa N.",
 * or "Parcel 2" while (or when) its detail can't be read.
 */
export function parcelLabel(t: AnyTFunction, summary: ParcelSummary | null, index: number): string {
  if (!summary) return t('shipments:combined.parcel', { n: index + 1 });
  const order = t('shipments:combined.order', { number: summary.orderNumber });
  return summary.customerName ? `${order} · ${summary.customerName}` : order;
}
