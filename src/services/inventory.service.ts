import { api } from './api';
import type {
  ListInventoryParams,
  ListInventoryResponse,
  InventoryDetailResponse,
} from '@/types/inventory.types';

/**
 * The vendor stock this agency physically warehouses — see
 * api-doc/agency/inventory.md and the header of `@/types/inventory.types`.
 *
 * Read-only by design. Counts are vendor-owned truth that moves through order
 * fulfilment and vendor restocks; there is deliberately no write method here.
 */

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return (
    '?' +
    entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
  );
}

export const inventoryService = {
  /** GET /agency/inventory — one line per stored variant, aggregated across locations. */
  list(params: ListInventoryParams = {}): Promise<ListInventoryResponse> {
    return api.get<ListInventoryResponse>(
      `/agency/inventory${buildQueryString(params as Record<string, unknown>)}`,
    );
  },

  /** GET /agency/inventory/:id — per-location breakdown + recent stock movements. */
  getById(id: string): Promise<InventoryDetailResponse> {
    return api.get<InventoryDetailResponse>(`/agency/inventory/${id}`);
  },
};
