import { useCallback } from 'react';
import { getApiErrorMessage } from '@/lib/errors';
import { useActionRunner } from '@/hooks/useActionRunner';
import { agentsService } from '@/services/agents.service';
import type {
  AgentInvite,
  ContractStatusRequestDecision,
  UpdateTermsPayload,
} from '@/types/agent.types';

// All agent/membership/COD codes live in the central registry (@/lib/errors).
export function getAgentErrorMessage(err: unknown): string {
  return getApiErrorMessage(err);
}

export interface UseAgentActionsOptions {
  onInviteChanged?: (invite: AgentInvite) => void;
  onRosterChanged?: () => void;
}

/**
 * Shared agent-roster mutations (invites + membership lifecycle: approve /
 * decline / suspend / pause / reinstate / remove / employment / contract terms /
 * COD threshold, plus resolving the status requests agents raise).
 */
export function useAgentActions({ onInviteChanged, onRosterChanged }: UseAgentActionsOptions = {}) {
  const { pendingKey, run } = useActionRunner();

  // ── Invites ────────────────────────────────────────────────────────────────
  const invite = useCallback(
    (email: string) =>
      run('invite', async () => (await agentsService.invite(email)).data, {
        success: `Invite sent to ${email}.`,
        onError: () => {},
      }).then((data) => {
        if (data) onInviteChanged?.(data);
        return data;
      }),
    [run, onInviteChanged],
  );

  const revokeInvite = useCallback(
    (id: string) =>
      run(`revoke:${id}`, async () => (await agentsService.revokeInvite(id)).data, {
        success: 'Invite revoked.',
      }).then((data) => {
        if (data) onInviteChanged?.(data);
        return data;
      }),
    [run, onInviteChanged],
  );

  // ── Membership lifecycle ─────────────────────────────────────────────────────
  const approve = useCallback(
    (membershipId: string) =>
      run(`approve:${membershipId}`, () => agentsService.approve(membershipId), {
        success: 'Agent approved.',
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged],
  );

  const decline = useCallback(
    (membershipId: string, reason?: string) =>
      run(`decline:${membershipId}`, () => agentsService.decline(membershipId, reason), {
        success: 'Request declined.',
      }).then((r) => {
        if (r) onRosterChanged?.();
        return r;
      }),
    [run, onRosterChanged],
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

  const remove = useCallback(
    (membershipId: string, reason?: string) =>
      run(`remove:${membershipId}`, () => agentsService.remove(membershipId, reason), {
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
    invite,
    revokeInvite,
    approve,
    decline,
    suspend,
    pause,
    reinstate,
    remove,
    updateTerms,
    resolveStatusRequest,
    updateCodLimit,
  };
}
