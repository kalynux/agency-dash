import { formatNumber, formatDate } from '@/lib/format';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Inbox, Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { AsyncBoundary, EmptyState } from '@/components/common/state-views';
import { toApiError } from '@/hooks/useResource';
import { useAgentsRoster } from '@/store/agents.store';
import { useAgentActions } from '@/hooks/useAgentActions';
import { agentsService } from '@/services/agents.service';
import { ApiError } from '@/types/api';
import type {
  ContractStatusRequest,
  ContractStatusRequestDecision,
  RosterEntry,
} from '@/types/agent.types';

/**
 * Contract changes an **agent** proposed, waiting on the agency's decision —
 * a pause, a reactivation, or a departure (see api-doc/agency/agent-roster.md).
 *
 * Ending or pausing a contract is deliberately a two-party transition: whoever
 * moves raises a request and the other side clears it. This inbox is the agency
 * half of that. Requests the agency itself raised (e.g. proposing a removal from
 * the roster) do NOT appear here — the agent resolves those, and attempting them
 * here returns `CONTRACT_STATUS_REQUEST_NOT_YOURS`.
 */

const TRANSITION_COPY: Record<string, { label: string; description: string }> = {
  pause: {
    label: 'Pause contract',
    description: 'They want to stop taking new assignments for a while, keeping the contract alive.',
  },
  reactivate: {
    label: 'Resume contract',
    description: 'They want to come back off a pause and start receiving assignments again.',
  },
  deactivate: {
    label: 'End contract',
    description: 'They want to leave your roster. Any cash and unpaid earnings must be settled first.',
  },
};

function transitionCopy(transition: string) {
  return (
    TRANSITION_COPY[transition] ?? {
      label: transition.replace(/_/g, ' '),
      description: 'A contract change awaiting your decision.',
    }
  );
}

export function RequestsTab() {
  const { roster, refetch: refetchRoster } = useAgentsRoster();

  const [requests, setRequests] = useState<ContractStatusRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  // Which request has its note box open, and what has been typed into it.
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await agentsService.listStatusRequests();
      setRequests(res.data);
    } catch (err) {
      setError(toApiError(err, 'STATUS_REQUESTS_FETCH_FAILED', 'Failed to load requests'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const actions = useAgentActions({
    onRosterChanged: () => {
      // A resolved request moves the contract, so both lists are now stale.
      load();
      refetchRoster();
    },
  });

  /** Name the agent behind a request — a contract IS a membership. */
  const agentFor = (request: ContractStatusRequest): RosterEntry | undefined =>
    roster.find((entry) => entry.membership.id === request.contractId);

  const resolve = async (request: ContractStatusRequest, decision: ContractStatusRequestDecision) => {
    const result = await actions.resolveStatusRequest(request.id, decision, note.trim() || undefined);
    if (result) {
      setNoteFor(null);
      setNote('');
    }
  };

  // The endpoint only returns what is waiting on you; the state check is belt
  // and braces (and case-insensitive, since it is a free-form string here).
  const pending = requests.filter((r) => (r.state ?? 'pending').toLowerCase() === 'pending');

  return (
    <Card>
      <CardContent className="p-0">
        <AsyncBoundary
          isLoading={isLoading && requests.length === 0}
          error={requests.length === 0 ? error : undefined}
          onRetry={load}
          isEmpty={!isLoading && pending.length === 0}
          emptyState={
            <EmptyState
              icon={Inbox}
              title="No requests waiting on you"
              description="When an agent asks to pause, resume or leave, it lands here for your decision."
              className="border-0"
            />
          }
        >
          <div className="divide-y">
            {pending.map((request) => {
              const entry = agentFor(request);
              const copy = transitionCopy(request.transition);
              const blocking = request.blockingConditions;
              const isBlocked = blocking != null && !blocking.clear;
              const busy = actions.pendingKey === `resolve:${request.id}`;

              return (
                <div key={request.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">
                          {entry?.agent.name ?? 'An agent on your roster'}
                        </span>
                        <Badge variant="outline">{copy.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{copy.description}</p>
                      {request.reason && (
                        <p className="text-sm mt-1">“{request.reason}”</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Raised {formatDate(request.requestedAt ?? request.createdAt)}
                      </p>
                    </div>
                  </div>

                  {isBlocked && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-500">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div className="space-y-0.5">
                        <p className="font-medium">Settle up before approving</p>
                        {blocking.outstandingCod > 0 && (
                          <p>They still hold {formatNumber(blocking.outstandingCod)} of your COD cash.</p>
                        )}
                        {blocking.outstandingPayment > 0 && (
                          <p>You still owe them {formatNumber(blocking.outstandingPayment)} in earnings.</p>
                        )}
                        <p className="opacity-80">
                          Checked again when you approve — approving now would be refused.
                        </p>
                      </div>
                    </div>
                  )}

                  {noteFor === request.id && (
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      maxLength={300}
                      placeholder="Add a note for the agent (optional)…"
                    />
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={busy}
                      onClick={() => resolve(request, 'approve')}
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={busy}
                      onClick={() => resolve(request, 'reject')}
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </Button>
                    {noteFor !== request.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setNoteFor(request.id);
                          setNote('');
                        }}
                      >
                        Add a note
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </AsyncBoundary>
      </CardContent>
    </Card>
  );
}
