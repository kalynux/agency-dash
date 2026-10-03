import { api } from './api';
import type {
  ListShipmentsParams,
  ListShipmentsResponse,
  ShipmentDetailResponse,
  ShipmentMutationResponse,
  ShipmentActionableStatus,
  ShipmentRejectionReason,
  AssignmentResponse,
  AssignAgentOptions,
  BulkAssignPayload,
  BulkAssignResponse,
  AssignmentCandidatesResponse,
  OfferCancelResponse,
  ReassignPayload,
  ReassignResponse,
} from '@/types/shipment.types';
import type {
  CreateDeliveryFeeProposalPayload,
  DeliveryFeeProposal,
  EditDeliveryFeeProposalPayload,
} from '@/types/delivery-fee-proposal.types';

interface DeliveryFeeProposalResponse {
  success: true;
  data: DeliveryFeeProposal;
  message?: string;
}

interface DeliveryFeeProposalsResponse {
  success: true;
  data: DeliveryFeeProposal[];
}

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

  /**
   * GET /agency/shipments/:id/delivery-proof/file — the agent's proof photo, as
   * bytes.
   *
   * There is **no public URL for this image and there will not be one.** The
   * `shipments/` storage tree left the static mount on 2026-08-19 precisely
   * because a delivery-proof photo is a place and a time about a real
   * customer's address, and the old URL was fetchable forever by anyone who had
   * ever seen it. Every `FileDetail` in that tree now reports `url: null` /
   * `access: 'authorized'`, so there is nothing to put in an `<img src>`.
   *
   * Authorization is the **shipment's own** — the same `findByIdAndAgency`
   * predicate `getById` uses, re-used rather than re-derived. So if you can read
   * the shipment you can read its proof, and a shipment that is not yours 404s
   * rather than 403s.
   *
   * There is deliberately **no upload or delete twin here**: the proof is the
   * *agent's* record of what they did. The agency reads it and does not author
   * it. There is also no agency-side metadata route — a `404` is the only way to
   * learn there is no proof, and it is a perfectly normal answer.
   *
   * Callers turn the blob into an object URL and must revoke it on unmount.
   * See api-doc/files/private-files.md and api-doc/MIGRATION-2026-08.md § 3.
   */
  getDeliveryProofFile(id: string): Promise<Blob> {
    return api.getBlob(`/agency/shipments/${id}/delivery-proof/file`);
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
   *
   * `force` is sent only when true, so an ordinary offer's body is unchanged.
   */
  assignAgent(id: string, agentId: string, opts: AssignAgentOptions = {}): Promise<AssignmentResponse> {
    return api.patch<AssignmentResponse>(`/agency/shipments/${id}/assign-agent`, {
      agentId,
      ...(opts.force ? { force: true } : {}),
    });
  },

  /**
   * POST /agency/shipments/assign-agent — offer one agent up to 10 shipments at
   * once. Answers `200` even when some rows fail; read `data.items`. Refused as
   * a whole (nothing offered) only for the agent — not eligible, not found, or
   * `422 AGENT_AT_CAPACITY`. See agency/assignment.md → bulk offer.
   */
  assignAgentBulk({ agentId, shipmentIds, force }: BulkAssignPayload): Promise<BulkAssignResponse> {
    return api.post<BulkAssignResponse>('/agency/shipments/assign-agent', {
      agentId,
      shipmentIds,
      ...(force ? { force: true } : {}),
    });
  },

  /**
   * POST /agency/shipments/:id/auto-assign — start an auto-assignment broadcast
   * now, even if the standing toggle is off. The nearest eligible agent is
   * offered immediately, then the next-nearest each timeout window while earlier
   * offers still stand; the first to accept wins. Two rounds, then the agency is
   * notified the shipment went unfilled.
   */
  autoAssign(id: string): Promise<AssignmentResponse> {
    return api.post<AssignmentResponse>(`/agency/shipments/${id}/auto-assign`);
  },

  /** GET /agency/shipments/:id/assignment-candidates — preview the pool, nearest first, without offering. */
  getAssignmentCandidates(id: string): Promise<AssignmentCandidatesResponse> {
    return api.get<AssignmentCandidatesResponse>(`/agency/shipments/${id}/assignment-candidates`);
  },

  /** POST /agency/shipments/:id/offer/cancel — withdraw every live offer, returning the shipment to the queue. */
  cancelOffer(id: string): Promise<OfferCancelResponse> {
    return api.post<OfferCancelResponse>(`/agency/shipments/${id}/offer/cancel`);
  },

  /** POST /agency/shipments/:id/reassign — release the current agent and offer a replacement. */
  reassign(id: string, payload: ReassignPayload): Promise<ReassignResponse> {
    return api.post<ReassignResponse>(`/agency/shipments/${id}/reassign`, payload);
  },

  // ── Delivery-fee proposals — agency/shipments.md § Delivery-fee proposals ───
  // Allowed only while the shipment is `assigned` / `handing_over`; while one is
  // pending, pickup answers 409 SHIPMENT_DELIVERY_FEE_PENDING.

  /** GET /agency/shipments/:id/delivery-fee-proposals — every proposal, newest first. */
  listDeliveryFeeProposals(id: string): Promise<DeliveryFeeProposalsResponse> {
    return api.get<DeliveryFeeProposalsResponse>(`/agency/shipments/${id}/delivery-fee-proposals`);
  },

  /** POST /agency/shipments/:id/delivery-fee-proposals — ask the vendor for a different fee. */
  proposeDeliveryFee(id: string, payload: CreateDeliveryFeeProposalPayload): Promise<DeliveryFeeProposalResponse> {
    return api.post<DeliveryFeeProposalResponse>(`/agency/shipments/${id}/delivery-fee-proposals`, payload);
  },

  /**
   * PATCH /agency/shipments/:id/delivery-fee-proposals/:proposalId — edit a
   * pending proposal, yours or your agent's (editing an agent's makes it yours).
   */
  editDeliveryFeeProposal(
    id: string,
    proposalId: string,
    payload: EditDeliveryFeeProposalPayload,
  ): Promise<DeliveryFeeProposalResponse> {
    return api.patch<DeliveryFeeProposalResponse>(
      `/agency/shipments/${id}/delivery-fee-proposals/${proposalId}`,
      payload,
    );
  },

  /** POST /agency/shipments/:id/delivery-fee-proposals/:proposalId/withdraw */
  withdrawDeliveryFeeProposal(id: string, proposalId: string): Promise<DeliveryFeeProposalResponse> {
    return api.post<DeliveryFeeProposalResponse>(
      `/agency/shipments/${id}/delivery-fee-proposals/${proposalId}/withdraw`,
    );
  },

  // There is no tracking-number endpoint. The platform stamps every shipment
  // with one at creation (`ACR-YYMMDD-HHMMSS-XXXXX`), so it is never absent and
  // never editable — read it off `trackingNumber` on any shipment payload.
};
