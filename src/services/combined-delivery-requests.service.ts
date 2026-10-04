import { api } from './api';
import type {
  CombinedDeliveryRequestListParams,
  CombinedDeliveryRequestListResponse,
  CombinedDeliveryRespondPayload,
  CombinedDeliveryRespondResponse,
} from '@/types/combined-delivery-request.types';

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

/** api-doc/agency/shipments.md § Combined delivery-price requests. */
export const combinedDeliveryRequestsService = {
  /** GET /agency/combined-delivery-requests — requests addressed to this agency, newest first. */
  list(params: CombinedDeliveryRequestListParams = {}): Promise<CombinedDeliveryRequestListResponse> {
    return api.get<CombinedDeliveryRequestListResponse>(
      `/agency/combined-delivery-requests${buildQueryString(params as Record<string, unknown>)}`,
    );
  },

  /**
   * POST /agency/combined-delivery-requests/:requestId/respond — lower fees
   * (each applies at once) or decline. A `200` can still carry `failed` parcels.
   */
  respond(requestId: string, payload: CombinedDeliveryRespondPayload): Promise<CombinedDeliveryRespondResponse> {
    return api.post<CombinedDeliveryRespondResponse>(
      `/agency/combined-delivery-requests/${requestId}/respond`,
      payload,
    );
  },
};
