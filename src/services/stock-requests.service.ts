import { api } from './api';
import type {
  ListStockRequestsParams,
  ListStockRequestsResponse,
  StockRequestResponse,
  CreateStockRequestPayload,
  RejectStockRequestPayload,
} from '@/types/stock-request.types';

/**
 * Changing the recorded stock of a SKU we warehouse — see
 * api-doc/agency/stock-requests.md and the header of `@/types/stock-request.types`.
 *
 * Every change needs both signatures. One side proposes, the other approves, and
 * the number moves in the same transaction that records the approval.
 *
 * Another party's request returns **404, never 403** — whether a given request id
 * exists is not information we are owed.
 */

/** Unknown query parameters are rejected with `400 VALIDATION_ERROR`, not ignored. */
function buildQueryString(params: ListStockRequestsParams): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return (
    '?' +
    entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
  );
}

export const stockRequestsService = {
  /**
   * POST /agency/stock-requests — propose an absolute quantity.
   *
   * `quantity` is the target, never a delta, and `0` is valid. A second request
   * while one is pending is `409 STOCK_REQUEST_ALREADY_PENDING` with
   * `details.hint` telling the user whether to withdraw theirs or answer the
   * vendor's.
   */
  create(payload: CreateStockRequestPayload): Promise<StockRequestResponse> {
    return api.post<StockRequestResponse>('/agency/stock-requests', payload);
  },

  /**
   * GET /agency/stock-requests — the inbox.
   *
   * No `status` filter returns EVERY status, terminal rows included. That is
   * deliberate, so a SKU's negotiation history is fetchable.
   */
  list(params: ListStockRequestsParams = {}): Promise<ListStockRequestsResponse> {
    return api.get<ListStockRequestsResponse>(`/agency/stock-requests${buildQueryString(params)}`);
  },

  /** GET /agency/stock-requests/:id — one request, with `currentQuantity` resolved live. */
  getById(id: string): Promise<StockRequestResponse> {
    return api.get<StockRequestResponse>(`/agency/stock-requests/${id}`);
  },

  /**
   * POST /agency/stock-requests/:id/approve — applies the change.
   *
   * `variant.stock` is written, an audit row is recorded and the request flips to
   * `approved`, all in one transaction. Only legal when `availableActions`
   * contains `approve`; the endpoint 403s otherwise.
   */
  approve(id: string): Promise<StockRequestResponse> {
    return api.post<StockRequestResponse>(`/agency/stock-requests/${id}/approve`);
  },

  /** POST /agency/stock-requests/:id/reject — nothing is written to the SKU. */
  reject(id: string, payload: RejectStockRequestPayload = {}): Promise<StockRequestResponse> {
    return api.post<StockRequestResponse>(`/agency/stock-requests/${id}/reject`, payload);
  },

  /**
   * POST /agency/stock-requests/:id/withdraw — retract one WE raised.
   *
   * Deliberately produces no notification: retracting something the vendor had not
   * acted on is not news worth pushing.
   */
  withdraw(id: string): Promise<StockRequestResponse> {
    return api.post<StockRequestResponse>(`/agency/stock-requests/${id}/withdraw`);
  },

  /**
   * How many requests are waiting on us, for the nav badge.
   *
   * `direction=awaiting_me` is "pending, and the vendor raised it" in one query;
   * `limit=1` because only `meta.total` is read. This is the cheapest correct
   * count — counting client-side would need every page.
   */
  async countAwaitingMe(): Promise<number> {
    const res = await stockRequestsService.list({ direction: 'awaiting_me', limit: 1 });
    return res.meta?.total ?? 0;
  },
};
