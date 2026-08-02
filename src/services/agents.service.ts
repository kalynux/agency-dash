import { api } from './api';
import type {
  ListAgentsResponse,
  AgentBrowseQueryParams,
  AgentBrowseResponse,
  AgentMembershipResponse,
  MembershipMutationResponse,
  RemoveMembershipResponse,
  CodLimitResponse,
  EligibleAgentsResponse,
  AgentEligibilityResponse,
  AgentHistoryResponse,
  ListRosterParams,
  UpdateEmploymentPayload,
  UpdateTermsPayload,
  ContractSettlementsResponse,
  ContractStatusRequestsResponse,
  ContractStatusRequestResponse,
  ContractStatusRequestDecision,
} from '@/types/agent.types';

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '' && v !== false,
  );
  if (entries.length === 0) return '';
  return (
    '?' +
    entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
  );
}

export const agentsService = {
  // ── Directory ──────────────────────────────────────────────────────────────
  /**
   * GET /agency/agents/browse — the platform-wide agent directory.
   *
   * Only agents who could actually accept are listed (active, KYC verified, not
   * banned, onboarding complete), so a listed agent is always a requestable one.
   * Agents you already contract with stay in the list; read `contract` to tell.
   */
  browse(params: AgentBrowseQueryParams = {}): Promise<AgentBrowseResponse> {
    return api.get<AgentBrowseResponse>(
      `/agency/agents/browse${buildQueryString(params as Record<string, unknown>)}`,
    );
  },
  /** POST /agency/agents/requests — ask a specific agent to contract. Lands `pending`; the AGENT accepts. */
  requestAgent(agentId: string): Promise<MembershipMutationResponse> {
    return api.post<MembershipMutationResponse>('/agency/agents/requests', { agentId });
  },
  /**
   * POST /agency/agents/:membershipId/withdraw — pull back a request **you** raised.
   * Refusing an agent's application is `reject`; the server enforces which
   * applies from `initiatedBy`, so offering the wrong one is a 403.
   */
  withdraw(membershipId: string, reason?: string): Promise<MembershipMutationResponse> {
    return api.post<MembershipMutationResponse>(
      `/agency/agents/${membershipId}/withdraw`,
      reason ? { reason } : undefined,
    );
  },

  // ── Roster (membership model) ────────────────────────────────────────────────
  /**
   * GET /agency/agents — the roster (membership + agent + cash held).
   *
   * Returns **every** status unless you name one, terminal rows included, and is
   * paginated at 20 a page by default. Read `meta.totalPages`: a roster that has
   * accumulated history will not fit on one page, and the missing rows would be
   * live agents.
   */
  listRoster(params: ListRosterParams = {}): Promise<ListAgentsResponse> {
    return api.get<ListAgentsResponse>(
      `/agency/agents${buildQueryString(params as Record<string, unknown>)}`,
    );
  },
  /** GET /agency/agents/:membershipId — full membership + agent profile. */
  getMembership(membershipId: string): Promise<AgentMembershipResponse> {
    return api.get<AgentMembershipResponse>(`/agency/agents/${membershipId}`);
  },
  /** POST /agency/agents/:membershipId/approve — approve a join request the AGENT raised. */
  approve(membershipId: string): Promise<MembershipMutationResponse> {
    return api.post<MembershipMutationResponse>(`/agency/agents/${membershipId}/approve`);
  },
  /** POST /agency/agents/:membershipId/reject — refuse a join request the AGENT raised. */
  reject(membershipId: string, reason?: string): Promise<MembershipMutationResponse> {
    return api.post<MembershipMutationResponse>(
      `/agency/agents/${membershipId}/reject`,
      reason ? { reason } : undefined,
    );
  },
  /** POST /agency/agents/:membershipId/suspend — suspend an approved agent (reason required). */
  suspend(membershipId: string, reason: string): Promise<MembershipMutationResponse> {
    return api.post<MembershipMutationResponse>(`/agency/agents/${membershipId}/suspend`, { reason });
  },
  /**
   * POST /agency/agents/:membershipId/pause — the softer sibling of suspend.
   * Same effect (no new assignments, in-flight work untouched), different
   * meaning: a mutual break rather than a sanction. Only an active contract can
   * be paused; `reinstate` returns from either state.
   */
  pause(membershipId: string, reason?: string): Promise<MembershipMutationResponse> {
    return api.post<MembershipMutationResponse>(
      `/agency/agents/${membershipId}/pause`,
      reason ? { reason } : undefined,
    );
  },
  /** POST /agency/agents/:membershipId/reinstate — reinstate a suspended agent. */
  reinstate(membershipId: string): Promise<MembershipMutationResponse> {
    return api.post<MembershipMutationResponse>(`/agency/agents/${membershipId}/reinstate`);
  },
  /**
   * POST /agency/agents/:membershipId/terminate — **propose** ending the contract.
   *
   * It does not perform it: ending a contract needs the agent's consent, so this
   * raises a `ContractStatusRequest` and the contract stays live meanwhile —
   * `membership` is null while it is pending, which on this first call it always
   * is. `DELETE /agency/agents/:membershipId` is the same handler under its
   * original spelling; this POST form is the canonical one.
   */
  terminate(membershipId: string, reason?: string): Promise<RemoveMembershipResponse> {
    return api.post<RemoveMembershipResponse>(
      `/agency/agents/${membershipId}/terminate`,
      reason ? { reason } : undefined,
    );
  },
  /**
   * PATCH /agency/agents/:membershipId/employment — update employment terms.
   * A thin alias for the `employment` group of `/terms`, kept because it predates
   * it; new code should prefer {@link updateTerms}.
   */
  updateEmployment(membershipId: string, payload: UpdateEmploymentPayload): Promise<AgentMembershipResponse> {
    return api.patch<AgentMembershipResponse>(`/agency/agents/${membershipId}/employment`, payload);
  },
  /**
   * PATCH /agency/agents/:membershipId/terms — the negotiated contract: fee split,
   * remittance cadence, coverage, per-shipment value ceiling. Groups are merged
   * field-by-field, so send only what changed.
   */
  updateTerms(membershipId: string, payload: UpdateTermsPayload): Promise<AgentMembershipResponse> {
    return api.patch<AgentMembershipResponse>(`/agency/agents/${membershipId}/terms`, payload);
  },
  /** PATCH /agency/agents/:membershipId/cod-limit — set this contract's COD threshold slice. */
  updateCodLimit(membershipId: string, threshold: number): Promise<CodLimitResponse> {
    return api.patch<CodLimitResponse>(`/agency/agents/${membershipId}/cod-limit`, { threshold });
  },
  /** GET /agency/agents/:membershipId/settlements — this contract's cash history + what is outstanding. */
  getSettlements(membershipId: string, page = 1, limit = 20): Promise<ContractSettlementsResponse> {
    return api.get<ContractSettlementsResponse>(
      `/agency/agents/${membershipId}/settlements?page=${page}&limit=${limit}`,
    );
  },

  // ── Status requests (agent-raised, awaiting your decision) ───────────────────
  /** GET /agency/agents/status-requests — pauses, reactivations and departures agents have proposed. */
  listStatusRequests(): Promise<ContractStatusRequestsResponse> {
    return api.get<ContractStatusRequestsResponse>('/agency/agents/status-requests');
  },
  /**
   * POST /agency/agents/status-requests/:requestId/resolve — approve or reject.
   * You cannot resolve a request you raised yourself (`403
   * CONTRACT_STATUS_REQUEST_NOT_YOURS`); the agent clears those from their side.
   */
  resolveStatusRequest(
    requestId: string,
    decision: ContractStatusRequestDecision,
    note?: string,
  ): Promise<ContractStatusRequestResponse> {
    return api.post<ContractStatusRequestResponse>(
      `/agency/agents/status-requests/${requestId}/resolve`,
      { decision, ...(note ? { note } : {}) },
    );
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
