import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useActionRunner } from '@/hooks/useActionRunner';
import { agentsService } from '@/services/agents.service';
import type {
  AgentMembership,
  ContractStatusRequestDecision,
  NegotiableTermsPayload,
  UpdateEmploymentPayload,
} from '@/types/agent.types';

// Every contract code this screen can raise now has copy in the central
// registry (@/lib/errors), so there is nothing to override here.

export interface UseAgentActionsOptions {
  /** Called with the updated contract after a directory-level mutation (request/withdraw/approve/reject). */
  onContractChanged?: (agentId: string, contract: AgentMembership) => void;
  onRosterChanged?: () => void;
}

/**
 * Shared agent-contract mutations: the handshake (request / withdraw / approve /
 * reject / counter), the lifecycle (suspend / pause / reinstate / terminate /
 * employment / COD threshold), the terms negotiation on a live contract, and
 * clearing pending status requests — `resolve` for the ones the agent raised,
 * `cancel` for our own.
 *
 * `withdraw` and `approve`/`reject`/`counter` are **not interchangeable**: the
 * server picks the valid pair from whose terms are standing, and offering the
 * wrong one is a 403, not a no-op. Read `awaitingDecisionFrom` (via
 * `contractOffer`) on the contract, and `availableActions` on a request or
 * proposal — both are computed from the same guards the service enforces.
 */
export function useAgentActions({ onContractChanged, onRosterChanged }: UseAgentActionsOptions = {}) {
  const { t } = useTranslation('agents');
  const { pendingKey, run } = useActionRunner();

  const runContract = useCallback(
    (key: string, agentId: string, action: () => Promise<{ data: AgentMembership }>, success: string) =>
      run(key, async () => (await action()).data, { success }).then((contract) => {
        if (contract) {
          onContractChanged?.(agentId, contract);
          onRosterChanged?.();
        }
        return contract;
      }),
    [run, onContractChanged, onRosterChanged],
  );

  // ── The handshake ───────────────────────────────────────────────────────────
  /**
   * Offer an agent from the directory a contract on stated terms. `terms` must
   * carry a fee split — an offer with no numbers would pay them nothing.
   */
  const request = useCallback(
    (agentId: string, terms: NegotiableTermsPayload) =>
      runContract(
        `request:${agentId}`,
        agentId,
        () => agentsService.requestAgent(agentId, terms),
        t('toasts.offerSent'),
      ),
    [runContract, t],
  );

  /** Pull back a request we raised, while it is still pending. */
  const withdraw = useCallback(
    (agentId: string, membershipId: string, reason?: string) =>
      runContract(
        `withdraw:${membershipId}`,
        agentId,
        () => agentsService.withdraw(membershipId, reason),
        t('toasts.withdrawn'),
      ),
    [runContract, t],
  );

  // ── Membership lifecycle ─────────────────────────────────────────────────────
  const approve = useCallback(
    (membershipId: string, agentId = '') =>
      runContract(
        `approve:${membershipId}`,
        agentId,
        () => agentsService.approve(membershipId),
        t('toasts.approved'),
      ),
    [runContract, t],
  );

  const reject = useCallback(
    (membershipId: string, reason?: string, agentId = '') =>
      runContract(
        `reject:${membershipId}`,
        agentId,
        () => agentsService.reject(membershipId, reason),
        t('toasts.declined'),
      ),
    [runContract, t],
  );

  const suspend = useCallback(
    (membershipId: string, reason: string) =>
      run(`suspend:${membershipId}`, () => agentsService.suspend(membershipId, reason), {
        success: t('toasts.suspended'),
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged, t],
  );

  const pause = useCallback(
    (membershipId: string, reason?: string) =>
      run(`pause:${membershipId}`, () => agentsService.pause(membershipId, reason), {
        success: t('toasts.paused'),
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged, t],
  );

  const reinstate = useCallback(
    (membershipId: string) =>
      run(`reinstate:${membershipId}`, () => agentsService.reinstate(membershipId), {
        success: t('toasts.reinstated'),
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged, t],
  );

  /** Proposes termination — the agent has to agree before the contract actually ends. */
  const terminate = useCallback(
    (membershipId: string, reason?: string) =>
      run(`terminate:${membershipId}`, () => agentsService.terminate(membershipId, reason), {
        success: t('toasts.removalRequested'),
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged, t],
  );

  // `PATCH .../terms` has no action here on purpose. It reaches employment AND
  // the negotiated groups in one call, which is exactly the line the API stopped
  // allowing: on a live contract it is `409 CONTRACT_TERMS_LIVE_EDIT_NOT_ALLOWED`.
  // The three actions below split the same fields the way the server does —
  // employment unilaterally, terms through the agent.

  /**
   * Employment terms — the agency's own HR record about this agent. Unilateral
   * at any status: staging a staff number behind the agent's consent would be
   * theatre, so this never becomes a proposal.
   */
  const updateEmployment = useCallback(
    (membershipId: string, payload: UpdateEmploymentPayload) =>
      run(`employment:${membershipId}`, () => agentsService.updateEmployment(membershipId, payload), {
        success: t('toasts.employmentUpdated'),
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged, t],
  );

  // ── Terms negotiation ────────────────────────────────────────────────────────
  /**
   * Write the terms standing on a **pending** contract — a counter to the
   * agent's figures, or a revision of our own unanswered offer. Either way the
   * agent is the one who must answer next.
   */
  const counterTerms = useCallback(
    (membershipId: string, terms: NegotiableTermsPayload, agentId = '') =>
      runContract(
        `counter:${membershipId}`,
        agentId,
        () => agentsService.counterTerms(membershipId, terms),
        t('toasts.termsCountered'),
      ),
    [runContract, t],
  );

  /**
   * Propose a change to a **live** contract. Nothing moves on the contract: it
   * keeps pricing deliveries by its agreed split until the agent accepts, which
   * is the whole reason this is not an edit.
   */
  const proposeTerms = useCallback(
    (membershipId: string, terms: NegotiableTermsPayload, note?: string) =>
      run(`propose:${membershipId}`, () => agentsService.proposeTerms(membershipId, terms, note), {
        success: t('toasts.proposalSent'),
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged, t],
  );

  /** Answer a change the AGENT proposed to a live contract. */
  const resolveTermsProposal = useCallback(
    (proposalId: string, decision: ContractStatusRequestDecision, note?: string) =>
      run(
        `proposal-resolve:${proposalId}`,
        () => agentsService.resolveTermsProposal(proposalId, decision, note),
        {
          success:
            decision === 'approve'
              ? t('toasts.proposalApproved')
              : t('toasts.proposalDeclined'),
        },
      ).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged, t],
  );

  /**
   * Supersede the agent's open proposal with ours. Distinct from rejecting it: a
   * rejection ends the negotiation, a counter keeps it alive and records the
   * chain, so a multi-round haggle stays reconstructible afterwards.
   */
  const counterTermsProposal = useCallback(
    (proposalId: string, terms: NegotiableTermsPayload, note?: string) =>
      run(
        `proposal-counter:${proposalId}`,
        () => agentsService.counterTermsProposal(proposalId, terms, note),
        { success: t('toasts.counterProposalSent') },
      ).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged, t],
  );

  /** Pull back a proposal **we** raised. The contract was never touched. */
  const cancelTermsProposal = useCallback(
    (proposalId: string, note?: string) =>
      run(`proposal-cancel:${proposalId}`, () => agentsService.cancelTermsProposal(proposalId, note), {
        success: t('toasts.proposalWithdrawn'),
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged, t],
  );

  /** Answer a change the AGENT proposed. `note` is the optional reason they see. */
  const resolveStatusRequest = useCallback(
    (requestId: string, decision: ContractStatusRequestDecision, note?: string) =>
      run(
        `resolve:${requestId}`,
        () => agentsService.resolveStatusRequest(requestId, decision, note),
        {
          success:
            decision === 'approve' ? t('toasts.requestApproved') : t('toasts.requestRejected'),
        },
      ).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged, t],
  );

  /**
   * Pull back a change **we** proposed. Not interchangeable with
   * `resolveStatusRequest` — the server picks the valid verb from
   * `requestedByRole`, and the wrong one is a 403. Render from the row's
   * `availableActions` rather than guessing.
   */
  const cancelStatusRequest = useCallback(
    (requestId: string, note?: string) =>
      run(`cancel:${requestId}`, () => agentsService.cancelStatusRequest(requestId, note), {
        success: t('toasts.requestCancelled'),
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged, t],
  );

  const updateCodLimit = useCallback(
    (membershipId: string, threshold: number) =>
      run(`cod-limit:${membershipId}`, async () => (await agentsService.updateCodLimit(membershipId, threshold)).data, {
        success: t('toasts.codUpdated'),
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged, t],
  );

  return {
    pendingKey,
    request,
    withdraw,
    approve,
    reject,
    suspend,
    pause,
    reinstate,
    terminate,
    updateEmployment,
    counterTerms,
    proposeTerms,
    resolveTermsProposal,
    counterTermsProposal,
    cancelTermsProposal,
    resolveStatusRequest,
    cancelStatusRequest,
    updateCodLimit,
  };
}
