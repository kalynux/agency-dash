import { api } from './api';
import type {
  ListShipmentsParams,
  ListShipmentsResponse,
  ShipmentDetailResponse,
  ShipmentMutationResponse,
  ShipmentActionableStatus,
  ShipmentRejectionReason,
} from '@/types/shipment.types';

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return (
    '?' +
    entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
  );
}

export const shipmentsService = {
  /** GET /agency/shipments — shipments assigned to this agency, newest first. */
  list(params: ListShipmentsParams = {}): Promise<ListShipmentsResponse> {
    return api.get<ListShipmentsResponse>(
      `/agency/shipments${buildQueryString(params as Record<string, unknown>)}`,
    );
  },

  /** GET /agency/shipments/:id — full detail for one of the agency's own shipments. */
  getById(id: string): Promise<ShipmentDetailResponse> {
    return api.get<ShipmentDetailResponse>(`/agency/shipments/${id}`);
  },

  /** PATCH /agency/shipments/:id/status — advance to the next agency-triggerable status. */
  updateStatus(id: string, status: ShipmentActionableStatus): Promise<ShipmentMutationResponse> {
    return api.patch<ShipmentMutationResponse>(`/agency/shipments/${id}/status`, { status });
  },

  /** POST /agency/shipments/:id/reject — decline an assigned shipment before pickup. */
  reject(id: string, reason: ShipmentRejectionReason): Promise<ShipmentMutationResponse> {
    return api.post<ShipmentMutationResponse>(`/agency/shipments/${id}/reject`, { reason });
  },

  /** PATCH /agency/shipments/:id/assign-agent — assign one of this agency's own agents. */
  assignAgent(id: string, agentId: string): Promise<ShipmentMutationResponse> {
    return api.patch<ShipmentMutationResponse>(`/agency/shipments/${id}/assign-agent`, { agentId });
  },

  /** PATCH /agency/shipments/:id/tracking-number — record or replace the carrier tracking number. */
  updateTrackingNumber(id: string, trackingNumber: string): Promise<ShipmentMutationResponse> {
    return api.patch<ShipmentMutationResponse>(`/agency/shipments/${id}/tracking-number`, { trackingNumber });
  },
};
