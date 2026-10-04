import { api } from './api';
import type {
  ListDeliverableProductsParams,
  ListDeliverableProductsResponse,
} from '@/types/agency-network.types';

/**
 * The only keys `GET /agency/products` accepts. The endpoint is `.strict()`: any
 * other key is a `400 VALIDATION_ERROR`, so the query is built from this list
 * rather than from whatever object a caller hands in.
 */
const PRODUCT_QUERY_KEYS: readonly (keyof ListDeliverableProductsParams)[] = [
  'page',
  'limit',
  'search',
  'source',
  'status',
  'categoryId',
  'vendorId',
  'sortBy',
  'sortDir',
];

export const agencyNetworkService = {
  /**
   * GET /agency/products — physical products we're set up to deliver (override or
   * vendor default). Searched, filtered, sorted and paged server-side; each row
   * carries its `vendor`. See api-doc/agency/products.md.
   */
  listProducts(params: ListDeliverableProductsParams = {}): Promise<ListDeliverableProductsResponse> {
    const qs = new URLSearchParams();
    for (const key of PRODUCT_QUERY_KEYS) {
      const value = params[key];
      if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
    }
    const query = qs.toString();
    return api.get<ListDeliverableProductsResponse>(`/agency/products${query ? `?${query}` : ''}`);
  },
};
