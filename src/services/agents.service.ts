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
  NegotiableTermsPayload,
  TermsProposalListResponse,
  TermsProposalResponse,
  TermsProposalResolveResponse,
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
  /**
   * POST /agency/agents/requests — ask a specific agent to contract **on stated
   * terms**. Lands `pending`; the agent accepts, rejects, or counters.
   *
   * `terms` is required and must carry a `fee_split`: an offer with no numbers
   * in it would land the agent on the schema default, whose null
   * `agent_share_percent` pays them zero, so a bare `{ agentId }` is a 400.
   *
   * The agent's relationship cap and COD headroom are **not** checked here — a
   * request may always be raised, and it is approval that binds.
   */
  requestAgent(agentId: string, terms: NegotiableTermsPayload): Promise<MembershipMutationResponse> {
    return api.post<MembershipMutationResponse>('/agency/agents/requests', { agentId, terms });
  },
  /**
   * POST /agency/agents/:membershipId/withdraw — pull back the offer **we** have
   * standing, while the contract is still pending.
   *
   * Not interchangeable with `reject`: the server picks the valid verb from
   * whose terms are standing (`awaitingDecisionFrom`), and the wrong one is a
   * 403. Withdrawing is terminal — requesting the same agent again creates a new
   * contract rather than reviving this row.
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
  /**
   * POST /agency/agents/:membershipId/approve — accept the terms the AGENT has
   * standing. `pending` → `active`.
   *
   * Only callable when `awaitingDecisionFrom` is `agency`. Approving a contract
   * nobody has proposed terms for is `422 CONTRACT_TERMS_NOT_PROPOSED` — render
   * that as "waiting on terms", not as a fault with the agent's account: the
   * guard order is terms → platform gates → COD pool.
   */
  approve(membershipId: string): Promise<MembershipMutationResponse> {
    return api.post<MembershipMutationResponse>(`/agency/agents/${membershipId}/approve`);
  },
  /** POST /agency/agents/:membershipId/reject — refuse the terms the AGENT has standing. */
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
   * PATCH /agency/agents/:membershipId/employment — the agency's own HR record
   * about this agent: type, staff reference, start and end dates.
   *
   * **Unilateral at any status**, and per contract — the same person can be your
   * employee and another agency's freelancer. This is the only route that still
   * works on a live contract, which is why employment is written here rather
   * than through the terms endpoints even though `/terms` also reaches it.
   */
  updateEmployment(membershipId: string, payload: UpdateEmploymentPayload): Promise<AgentMembershipResponse> {
    return api.patch<AgentMembershipResponse>(`/agency/agents/${membershipId}/employment`, payload);
  },
  /**
   * PATCH /agency/agents/:membershipId/terms — the negotiated contract: fee split,
   * remittance cadence, coverage, per-shipment value ceiling. Groups are merged
   * field-by-field, so send only what changed.
   *
   * ⚠️ **Pending contracts only.** On a live one this is `409
   * CONTRACT_TERMS_LIVE_EDIT_NOT_ALLOWED` — its agreed split is pricing
   * deliveries right now, so a change must be staged through
   * {@link proposeTerms} instead. On a pending contract it is identical to
   * {@link counterTerms}, which is the clearer name for what it does; prefer
   * that one and keep this for the `employment` group.
   */
  updateTerms(membershipId: string, payload: UpdateTermsPayload): Promise<AgentMembershipResponse> {
    return api.patch<AgentMembershipResponse>(`/agency/agents/${membershipId}/terms`, payload);
  },

  // ── Terms negotiation ────────────────────────────────────────────────────────
  /**
   * POST /agency/agents/:membershipId/counter — write the terms standing on a
   * **pending** contract.
   *
   * A counter when the agent's terms were standing (the ball moves to them), a
   * revision when ours already were (it stays with them either way). Revising is
   * allowed on purpose: forcing a withdraw and re-request to fix a mistyped
   * percentage would destroy the contract row, its history and the agent's
   * notification thread over a figure nobody had answered. `termsVersion` bumps
   * in both cases, which is how a stale client notices.
   */
  counterTerms(
    membershipId: string,
    terms: NegotiableTermsPayload,
  ): Promise<MembershipMutationResponse> {
    return api.post<MembershipMutationResponse>(`/agency/agents/${membershipId}/counter`, terms);
  },
  /**
   * POST /agency/agents/:membershipId/terms-proposals — propose a change to a
   * **live** contract (`active`, `paused` or `suspended`).
   *
   * The contract is **not modified**: it goes on pricing deliveries by its
   * agreed `fee_split` until the agent accepts, and a rejected or unanswered
   * proposal changes nothing. At most one may be open per contract (enforced by
   * a unique index) — counter the open one to keep the chain, or cancel it.
   */
  proposeTerms(
    membershipId: string,
    terms: NegotiableTermsPayload,
    note?: string,
  ): Promise<TermsProposalResponse> {
    return api.post<TermsProposalResponse>(`/agency/agents/${membershipId}/terms-proposals`, {
      terms,
      ...(note ? { note } : {}),
    });
  },
  /**
   * GET /agency/agents/:membershipId/terms-proposals — that contract's full
   * negotiation trail, newest first, resolved rows included. `supersedesId`
   * reconstructs a counter chain; each row's `termsBefore` is the snapshot taken
   * when it was raised, so an old row still shows what was on the table then.
   */
  listContractTermsProposals(membershipId: string): Promise<TermsProposalListResponse> {
    return api.get<TermsProposalListResponse>(`/agency/agents/${membershipId}/terms-proposals`);
  },
  /**
   * GET /agency/agents/terms-proposals — every **open** proposal across the
   * roster, in both directions.
   *
   * Ours come back too, and must: this is the only place a client learns the id
   * of a proposal it raised itself, which is what `/cancel` needs. Read
   * `awaitingMyDecision` to tell them apart — it is also the correct badge
   * predicate, since counting rows over-counts by our own.
   */
  listOpenTermsProposals(): Promise<TermsProposalListResponse> {
    return api.get<TermsProposalListResponse>('/agency/agents/terms-proposals');
  },
  /**
   * POST /agency/agents/terms-proposals/:proposalId/resolve — answer a proposal
   * the AGENT raised.
   *
   * On approve the terms land on the contract inside the same transaction that
   * marks the proposal accepted, and coherence is re-checked against the
   * contract's *current* split rather than `termsBefore` (the two can diverge
   * while a proposal sits). On reject the contract is untouched.
   */
  resolveTermsProposal(
    proposalId: string,
    decision: ContractStatusRequestDecision,
    note?: string,
  ): Promise<TermsProposalResolveResponse> {
    return api.post<TermsProposalResolveResponse>(
      `/agency/agents/terms-proposals/${proposalId}/resolve`,
      { decision, ...(note ? { note } : {}) },
    );
  },
  /**
   * POST /agency/agents/terms-proposals/:proposalId/cancel — pull back a
   * proposal **we** raised. The contract is untouched — a withdrawn proposal
   * never applied anything — and it frees the one-open-proposal slot.
   */
  cancelTermsProposal(proposalId: string, note?: string): Promise<TermsProposalResponse> {
    return api.post<TermsProposalResponse>(
      `/agency/agents/terms-proposals/${proposalId}/cancel`,
      note ? { note } : undefined,
    );
  },
  /**
   * POST /agency/agents/terms-proposals/:proposalId/counter — supersede the
   * agent's open proposal with ours, in one transaction.
   *
   * Distinct from resolving with `reject`: a rejection ends the negotiation, a
   * counter keeps it alive and records the chain — the old row becomes
   * `superseded` (not `rejected`, which would be a lie) and the new one carries
   * `supersedesId` back to it.
   */
  counterTermsProposal(
    proposalId: string,
    terms: NegotiableTermsPayload,
    note?: string,
  ): Promise<TermsProposalResponse> {
    return api.post<TermsProposalResponse>(
      `/agency/agents/terms-proposals/${proposalId}/counter`,
      { terms, ...(note ? { note } : {}) },
    );
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

  // ── Status requests (pending contract changes, both directions) ──────────────
  /**
   * GET /agency/agents/status-requests — every pending contract change on the
   * roster: pauses, resumes and departures.
   *
   * **Both directions come back**, ours and theirs, because this is the only
   * endpoint that exposes a `requestId` and dropping our own rows would leave
   * `cancel` uncallable. Read `awaitingMyDecision` / `availableActions` per row
   * rather than counting the list.
   */
  listStatusRequests(): Promise<ContractStatusRequestsResponse> {
    return api.get<ContractStatusRequestsResponse>('/agency/agents/status-requests');
  },
  /**
   * POST /agency/agents/status-requests/:requestId/resolve — answer a request the
   * AGENT raised. `note` (≤300 chars) is the optional reason shown to them.
   *
   * You cannot resolve a request you raised yourself (`403
   * CONTRACT_STATUS_REQUEST_NOT_YOURS`); those are {@link cancelStatusRequest}.
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
  /**
   * POST /agency/agents/status-requests/:requestId/cancel — pull back a request
   * **you** raised, most often a termination thought better of.
   *
   * The exact inverse of `resolve`, and the contract is untouched either way:
   * cancelling a proposal to end a contract settles nothing, so there is no
   * outstanding-cash 422 here and `membership` always comes back null. It frees
   * the per-(contract, transition) slot, so the same move can be raised again.
   */
  cancelStatusRequest(requestId: string, note?: string): Promise<ContractStatusRequestResponse> {
    return api.post<ContractStatusRequestResponse>(
      `/agency/agents/status-requests/${requestId}/cancel`,
      note ? { note } : undefined,
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
