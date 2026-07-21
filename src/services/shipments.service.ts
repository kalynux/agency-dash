import { api } from './api';
import type {
  ListShipmentsParams,
  ListShipmentsResponse,
  ShipmentDetailResponse,
  ShipmentMutationResponse,
  ShipmentActionableStatus,
  ShipmentRejectionReason,
  AssignmentResponse,
  AssignmentCandidatesResponse,
  OfferCancelResponse,
  ReassignPayload,
  ReassignResponse,
  AssignmentSettingsResponse,
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

  /**
   * POST /agency/shipments/:id/reject — decline an assigned shipment before pickup.
   * `note` is required by the API when `reason` is `other` (max 200 chars).
   */
  reject(id: string, reason: ShipmentRejectionReason, note?: string): Promise<ShipmentMutationResponse> {
    return api.post<ShipmentMutationResponse>(`/agency/shipments/${id}/reject`, {
      reason,
      ...(note ? { note } : {}),
    });
  },

  /**
   * PATCH /agency/shipments/:id/assign-agent — offer this shipment to one of the
   * agency's agents. Under the acceptance workflow this creates a pending offer
   * (unless the agent has auto-accept on); the shipment gains an agent only on
   * acceptance. See agency/assignment.md.
   */
  assignAgent(id: string, agentId: string): Promise<AssignmentResponse> {
    return api.patch<AssignmentResponse>(`/agency/shipments/${id}/assign-agent`, { agentId });
  },

  /** POST /agency/shipments/:id/auto-assign — rank eligible agents and offer the top one now. */
  autoAssign(id: string): Promise<AssignmentResponse> {
    return api.post<AssignmentResponse>(`/agency/shipments/${id}/auto-assign`);
  },

  /** GET /agency/shipments/:id/assignment-candidates — preview the ranked agent pool without offering. */
  getAssignmentCandidates(id: string): Promise<AssignmentCandidatesResponse> {
    return api.get<AssignmentCandidatesResponse>(`/agency/shipments/${id}/assignment-candidates`);
  },

  /** POST /agency/shipments/:id/offer/cancel — withdraw the shipment's live offer. */
  cancelOffer(id: string): Promise<OfferCancelResponse> {
    return api.post<OfferCancelResponse>(`/agency/shipments/${id}/offer/cancel`);
  },

  /** POST /agency/shipments/:id/reassign — release the current agent and offer a replacement. */
  reassign(id: string, payload: ReassignPayload): Promise<ReassignResponse> {
    return api.post<ReassignResponse>(`/agency/shipments/${id}/reassign`, payload);
  },

  /** PATCH /agency/shipments/:id/tracking-number — record or replace the carrier tracking number. */
  updateTrackingNumber(id: string, trackingNumber: string): Promise<ShipmentMutationResponse> {
    return api.patch<ShipmentMutationResponse>(`/agency/shipments/${id}/tracking-number`, { trackingNumber });
  },

  /** PATCH /agency/assignment-settings — toggle standing auto-assignment participation. */
  updateAssignmentSettings(autoAssignEnabled: boolean): Promise<AssignmentSettingsResponse> {
    return api.patch<AssignmentSettingsResponse>('/agency/assignment-settings', { autoAssignEnabled });
  },
};
