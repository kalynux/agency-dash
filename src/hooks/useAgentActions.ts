import { useCallback } from 'react';
import { useActionRunner } from '@/hooks/useActionRunner';
import { agentsService } from '@/services/agents.service';
import type {
  AgentMembership,
  ContractStatusRequestDecision,
  UpdateTermsPayload,
} from '@/types/agent.types';

// Every contract code this screen can raise now has copy in the central
// registry (@/lib/errors), so there is nothing to override here.

export interface UseAgentActionsOptions {
  /** Called with the updated contract after a directory-level mutation (request/withdraw/approve/reject). */
  onContractChanged?: (agentId: string, contract: AgentMembership) => void;
  onRosterChanged?: () => void;
}

/**
 * Shared agent-contract mutations: request / withdraw / approve / reject, the
 * contract lifecycle (suspend / pause / reinstate / terminate / terms / COD
 * threshold), and resolving the status requests agents raise.
 *
 * `request`+`withdraw` and `approve`+`reject` are **not interchangeable** — the
 * server picks the valid pair from who raised the contract (`initiatedBy`), and
 * offering the wrong one is a 403, not a no-op.
 */
export function useAgentActions({ onContractChanged, onRosterChanged }: UseAgentActionsOptions = {}) {
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
  /** Ask an agent from the directory to contract. They accept from their own app. */
  const request = useCallback(
    (agentId: string) =>
      runContract(
        `request:${agentId}`,
        agentId,
        () => agentsService.requestAgent(agentId),
        'Request sent — the agent has to accept before the contract starts.',
      ),
    [runContract],
  );

  /** Pull back a request we raised, while it is still pending. */
  const withdraw = useCallback(
    (agentId: string, membershipId: string, reason?: string) =>
      runContract(
        `withdraw:${membershipId}`,
        agentId,
        () => agentsService.withdraw(membershipId, reason),
        'Request withdrawn.',
      ),
    [runContract],
  );

  // ── Membership lifecycle ─────────────────────────────────────────────────────
  const approve = useCallback(
    (membershipId: string, agentId = '') =>
      runContract(
        `approve:${membershipId}`,
        agentId,
        () => agentsService.approve(membershipId),
        'Agent approved.',
      ),
    [runContract],
  );

  const reject = useCallback(
    (membershipId: string, reason?: string, agentId = '') =>
      runContract(
        `reject:${membershipId}`,
        agentId,
        () => agentsService.reject(membershipId, reason),
        'Request declined.',
      ),
    [runContract],
  );

  const suspend = useCallback(
    (membershipId: string, reason: string) =>
      run(`suspend:${membershipId}`, () => agentsService.suspend(membershipId, reason), {
        success: 'Agent suspended — they keep current shipments but receive no new ones.',
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged],
  );

  const pause = useCallback(
    (membershipId: string, reason?: string) =>
      run(`pause:${membershipId}`, () => agentsService.pause(membershipId, reason), {
        success: 'Agent paused — they keep current shipments but receive no new ones.',
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged],
  );

  const reinstate = useCallback(
    (membershipId: string) =>
      run(`reinstate:${membershipId}`, () => agentsService.reinstate(membershipId), {
        success: 'Agent reinstated.',
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged],
  );

  /** Proposes termination — the agent has to agree before the contract actually ends. */
  const terminate = useCallback(
    (membershipId: string, reason?: string) =>
      run(`terminate:${membershipId}`, () => agentsService.terminate(membershipId, reason), {
        success: 'Removal requested — the contract ends once the agent agrees and cash is settled.',
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged],
  );

  // Employment is one group of `updateTerms` — `PATCH .../employment` is only a
  // legacy alias for it, so there is no separate action here.
  const updateTerms = useCallback(
    (membershipId: string, payload: UpdateTermsPayload) =>
      run(`terms:${membershipId}`, () => agentsService.updateTerms(membershipId, payload), {
        success: 'Contract terms updated.',
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged],
  );

  const resolveStatusRequest = useCallback(
    (requestId: string, decision: ContractStatusRequestDecision, note?: string) =>
      run(
        `resolve:${requestId}`,
        () => agentsService.resolveStatusRequest(requestId, decision, note),
        {
          success: decision === 'approve' ? 'Request approved.' : 'Request rejected.',
        },
      ).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged],
  );

  const updateCodLimit = useCallback(
    (membershipId: string, threshold: number) =>
      run(`cod-limit:${membershipId}`, async () => (await agentsService.updateCodLimit(membershipId, threshold)).data, {
        success: 'COD threshold updated.',
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged],
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
    updateTerms,
    resolveStatusRequest,
    updateCodLimit,
  };
}
