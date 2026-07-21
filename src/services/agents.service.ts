import { api } from './api';
import type {
  ListAgentsResponse,
  ListAgentInvitesResponse,
  AgentInviteResponse,
  AgentMembershipResponse,
  MembershipMutationResponse,
  RemoveMembershipResponse,
  CodLimitResponse,
  EligibleAgentsResponse,
  AgentEligibilityResponse,
  AgentHistoryResponse,
  AgentInviteStatus,
  MembershipStatus,
  UpdateEmploymentPayload,
} from '@/types/agent.types';

export const agentsService = {
  // ── Invites ────────────────────────────────────────────────────────────────
  /** GET /agency/agents/invites — this agency's invite history. */
  listInvites(status?: AgentInviteStatus): Promise<ListAgentInvitesResponse> {
    return api.get<ListAgentInvitesResponse>(
      `/agency/agents/invites${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    );
  },
  /** POST /agency/agents/invites — invite a delivery agent by email. */
  invite(email: string): Promise<AgentInviteResponse> {
    return api.post<AgentInviteResponse>('/agency/agents/invites', { email });
  },
  /** DELETE /agency/agents/invites/:id — revoke a still-pending invite. */
  revokeInvite(id: string): Promise<AgentInviteResponse> {
    return api.delete<AgentInviteResponse>(`/agency/agents/invites/${id}`);
  },

  // ── Roster (membership model) ────────────────────────────────────────────────
  /** GET /agency/agents — the roster (membership + agent + cash held). */
  listRoster(status?: MembershipStatus): Promise<ListAgentsResponse> {
    return api.get<ListAgentsResponse>(
      `/agency/agents${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    );
  },
  /** GET /agency/agents/:membershipId — full membership + agent profile. */
  getMembership(membershipId: string): Promise<AgentMembershipResponse> {
    return api.get<AgentMembershipResponse>(`/agency/agents/${membershipId}`);
  },
  /** POST /agency/agents/:membershipId/approve — approve a pending join request. */
  approve(membershipId: string): Promise<MembershipMutationResponse> {
    return api.post<MembershipMutationResponse>(`/agency/agents/${membershipId}/approve`);
  },
  /** POST /agency/agents/:membershipId/decline — decline a pending join request. */
  decline(membershipId: string, reason?: string): Promise<MembershipMutationResponse> {
    return api.post<MembershipMutationResponse>(
      `/agency/agents/${membershipId}/decline`,
      reason ? { reason } : undefined,
    );
  },
  /** POST /agency/agents/:membershipId/suspend — suspend an approved agent (reason required). */
  suspend(membershipId: string, reason: string): Promise<MembershipMutationResponse> {
    return api.post<MembershipMutationResponse>(`/agency/agents/${membershipId}/suspend`, { reason });
  },
  /** POST /agency/agents/:membershipId/reinstate — reinstate a suspended agent. */
  reinstate(membershipId: string): Promise<MembershipMutationResponse> {
    return api.post<MembershipMutationResponse>(`/agency/agents/${membershipId}/reinstate`);
  },
  /** DELETE /agency/agents/:membershipId — propose termination (raises a status request). */
  remove(membershipId: string, reason?: string): Promise<RemoveMembershipResponse> {
    return api.delete<RemoveMembershipResponse>(
      `/agency/agents/${membershipId}`,
      reason ? { reason } : undefined,
    );
  },
  /** PATCH /agency/agents/:membershipId/employment — update employment terms. */
  updateEmployment(membershipId: string, payload: UpdateEmploymentPayload): Promise<AgentMembershipResponse> {
    return api.patch<AgentMembershipResponse>(`/agency/agents/${membershipId}/employment`, payload);
  },
  /** PATCH /agency/agents/:membershipId/cod-limit — set this contract's COD threshold slice. */
  updateCodLimit(membershipId: string, threshold: number): Promise<CodLimitResponse> {
    return api.patch<CodLimitResponse>(`/agency/agents/${membershipId}/cod-limit`, { threshold });
  },

  // ── Eligibility & history ────────────────────────────────────────────────────
  /** GET /agency/agents/eligible — agents dispatchable right now. */
  listEligible(): Promise<EligibleAgentsResponse> {
    return api.get<EligibleAgentsResponse>('/agency/agents/eligible');
  },
  /** GET /agency/agents/:agentId/eligibility — why an agent can/can't be assigned now. */
  getEligibility(agentId: string): Promise<AgentEligibilityResponse> {
    return api.get<AgentEligibilityResponse>(`/agency/agents/${agentId}/eligibility`);
  },
  /** GET /agency/agents/:agentId/history — one agent's membership trail with this agency. */
  agentHistory(agentId: string): Promise<AgentHistoryResponse> {
    return api.get<AgentHistoryResponse>(`/agency/agents/${agentId}/history`);
  },
  /** GET /agency/agents/history — the whole roster's trail, newest first. */
  rosterHistory(): Promise<AgentHistoryResponse> {
    return api.get<AgentHistoryResponse>('/agency/agents/history');
  },
};
