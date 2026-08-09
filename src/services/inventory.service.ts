import { api } from './api';
import type {
  ListInventoryParams,
  ListInventoryResponse,
  InventoryDetailResponse,
  SummaryInventoryParams,
  InventorySummaryResponse,
  MoveDepotPayload,
  MoveDepotResponse,
  SuspendProductPayload,
  SuspendProductResponse,
} from '@/types/inventory.types';

/**
 * Which SKUs this agency warehouses, at which depot — see
 * api-doc/agency/inventory.md and the header of `@/types/inventory.types`.
 *
 * You still do not CREATE rows: the roster is derived from the catalog and
 * refreshed (debounced) when the list is read, so rapid paging costs nothing.
 * What you can do is act on a product you warehouse — re-point it at another
 * depot, take it off the storefront, put it back. Those three are keyed on
 * `productId`, which only the DETAIL response carries.
 */

/**
 * Only the documented parameters may go out — the endpoint rejects an unknown
 * one with `400 VALIDATION_ERROR` rather than ignoring it, so a stray key fails
 * the whole request.
 */
function buildQueryString(params: ListInventoryParams | SummaryInventoryParams): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return (
    '?' +
    entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
  );
}

export const inventoryService = {
  /** GET /agency/inventory — one row per stored SKU per depot. */
  list(params: ListInventoryParams = {}): Promise<ListInventoryResponse> {
    return api.get<ListInventoryResponse>(`/agency/inventory${buildQueryString(params)}`);
  },

  /**
   * GET /agency/inventory/:id — one shelf, plus the depot's live address.
   *
   * `id` is the stock-level ROW id from the list, not a variant id: the same
   * variant at two depots is two rows. Another agency's row 404s
   * (`INVENTORY_STOCK_LEVEL_NOT_FOUND`) rather than 403s.
   */
  getById(id: string): Promise<InventoryDetailResponse> {
    return api.get<InventoryDetailResponse>(`/agency/inventory/${id}`);
  },

  /**
   * GET /agency/inventory/summary — the screen header.
   *
   * Totals the whole FILTERED set, not the visible page, which is why it is a
   * separate call: folding it into the list would make every page load pay for a
   * full-collection aggregation it usually does not need.
   *
   * Takes only the list's filters. Pass it through `toSummaryParams` — `page`,
   * `limit` and the sort keys are `400 VALIDATION_ERROR` here.
   */
  summary(params: SummaryInventoryParams = {}): Promise<InventorySummaryResponse> {
    return api.get<InventorySummaryResponse>(`/agency/inventory/summary${buildQueryString(params)}`);
  },

  /**
   * PATCH /agency/inventory/products/:productId/depot — re-point a stored product.
   *
   * Keyed on the PRODUCT, not the row: the depot lives on
   * `product.delivery.pickup_location`, so the move is per product by
   * construction. `affectedRows` reports how many rows moved, one per active
   * variant.
   *
   * Applies immediately, with no vendor confirmation — which of OUR buildings
   * holds the goods is our record to state. But warn first: the depot address
   * resolves live on every read, so this **redirects collection for shipments
   * already in flight**.
   *
   * The payload goes in the BODY precisely so `locationId: null` survives — it is
   * a real answer ("track my primary depot"), and the query-string builder above
   * would drop it.
   */
  moveDepot(productId: string, payload: MoveDepotPayload): Promise<MoveDepotResponse> {
    return api.patch<MoveDepotResponse>(`/agency/inventory/products/${productId}/depot`, payload);
  },

  /**
   * POST /agency/inventory/products/:productId/suspend — take it off the storefront.
   *
   * Our one lever over a product we warehouse. Nothing here is automatic: the
   * platform does not track storage payment and never suspends on our behalf. Only
   * an `active` product can be suspended (`canSuspend`).
   */
  suspendProduct(productId: string, payload: SuspendProductPayload = {}): Promise<SuspendProductResponse> {
    return api.post<SuspendProductResponse>(`/agency/inventory/products/${productId}/suspend`, payload);
  },

  /**
   * POST /agency/inventory/products/:productId/unsuspend — put it back on sale.
   *
   * Re-runs the product's activation gate rather than trusting it: a product can go
   * stale while off sale (the vendor's connection lapses, a variant is archived or
   * flipped to unlimited stock). On failure this throws `ApiError` with
   * `422 INVENTORY_PRODUCT_UNSUSPEND_BLOCKED` and `details.blockers` — render that
   * list; the product stays suspended.
   */
  unsuspendProduct(productId: string): Promise<SuspendProductResponse> {
    return api.post<SuspendProductResponse>(`/agency/inventory/products/${productId}/unsuspend`);
  },
};
