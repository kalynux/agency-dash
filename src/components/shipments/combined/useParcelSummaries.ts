import { useEffect, useState } from 'react';
import { shipmentsService } from '@/services/shipments.service';
import { describeAddress, type ShipmentStatus } from '@/types/shipment.types';

/**
 * What a combined-price request needs to say about each parcel so the agency can
 * recognise it. The request itself only carries ids (`shipmentId`, `orderId`),
 * so this reads each parcel's detail — the same endpoint the shipment sheet
 * uses. Every figure is the server's.
 */
export interface ParcelSummary {
  orderNumber: string;
  customerName: string | null;
  /** "Douala → Yaoundé", from the parcel's own pickup and drop-off. */
  from: string | null;
  to: string | null;
  status: ShipmentStatus;
  /** The fee the parcel carries now — an approved change if any, else the quoted gross fee. `null` when unknown. */
  currentFee: number | null;
}

/** Per session: a parcel's identity does not change while a request is open. */
const cache = new Map<string, ParcelSummary | null>();

async function fetchSummary(id: string): Promise<ParcelSummary | null> {
  if (cache.has(id)) return cache.get(id) ?? null;
  try {
    const { data } = await shipmentsService.getById(id);
    const firstPickup = data.items.find((i) => i.pickupLocation)?.pickupLocation ?? null;
    const summary: ParcelSummary = {
      orderNumber: data.orderNumber,
      customerName: data.customer?.name ?? null,
      from: describeAddress(firstPickup?.address ?? null),
      to: describeAddress(data.customer?.deliveryAddress ?? null),
      status: data.status,
      currentFee: data.deliveryFeeOverride?.amount ?? data.agencyEarning?.deliveryFee ?? null,
    };
    cache.set(id, summary);
    return summary;
  } catch {
    // A parcel we can't read still gets a row ("Parcel 2"); don't cache the
    // failure, so the next open tries again.
    return null;
  }
}

/**
 * Summaries for `ids`, fetched only while `enabled` — so a list of answered and
 * cancelled requests costs nothing, and an open one is read once.
 * `refreshKey` bypasses the cache for the current fee after an answer.
 */
export function useParcelSummaries(ids: string[], enabled: boolean, refreshKey = 0) {
  const [summaries, setSummaries] = useState<Record<string, ParcelSummary | null>>({});
  const key = ids.join(',');

  useEffect(() => {
    if (!enabled || ids.length === 0) return;
    let cancelled = false;
    if (refreshKey > 0) ids.forEach((id) => cache.delete(id));
    void Promise.all(ids.map(async (id) => [id, await fetchSummary(id)] as const)).then((rows) => {
      if (!cancelled) setSummaries(Object.fromEntries(rows));
    });
    return () => {
      cancelled = true;
    };
    // `key` stands for `ids`: a new array with the same ids must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, refreshKey]);

  return { summaries };
}
