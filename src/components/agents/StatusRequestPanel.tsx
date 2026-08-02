import { formatNumber, formatDate } from '@/lib/format';
import { AlertTriangle, Check, Loader2, Undo2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type {
  ContractStatusRequest,
  ContractStatusRequestAction,
  ContractStatusRequestDecision,
} from '@/types/agent.types';

/**
 * One pending two-party contract change, in whichever direction it runs.
 *
 * `GET /agency/agents/status-requests` returns both — the pauses and departures
 * an agent proposed **and** the removals we did — because it is the only place a
 * `requestId` is exposed and `cancel` needs ours. So the same row renders as a
 * decision ("Wants to leave — Approve / Reject") or as a proposal in flight
 * ("Removal proposed — Cancel"), and which one is never guessed from the shape
 * of the data: `availableActions` names the verbs the server will accept, and
 * offering the other is a 403 `CONTRACT_STATUS_REQUEST_NOT_YOURS` on click.
 *
 * Lives in its own module rather than in ConnectionsTab because the Manage sheet
 * renders it too, and importing it back from there would close a cycle.
 */

/** Copy for a change the AGENT proposed — ours to approve or reject. */
const INCOMING_COPY: Record<string, { label: string; description: string }> = {
  pause: {
    label: 'Wants to pause',
    description: 'They want to stop taking new assignments for a while, keeping the contract alive.',
  },
  reactivate: {
    label: 'Wants to resume',
    description: 'They want to come back off a pause and start receiving assignments again.',
  },
  deactivate: {
    label: 'Wants to leave',
    description: 'They want to leave your roster. Any cash and unpaid earnings must be settled first.',
  },
};

/** Copy for a change WE proposed — ours to cancel, theirs to answer. */
const OUTGOING_COPY: Record<string, { label: string; description: string }> = {
  pause: {
    label: 'Pause proposed',
    description: 'Waiting on the agent to agree. Until they do, nothing about the contract changes.',
  },
  reactivate: {
    label: 'Resume proposed',
    description: 'Waiting on the agent to agree. Until they do, nothing about the contract changes.',
  },
  deactivate: {
    label: 'Removal proposed',
    description:
      'Waiting on the agent to agree. The contract ends only once they do and any cash and unpaid earnings are settled.',
  },
};

function transitionCopy(transition: string, mine: boolean) {
  const table = mine ? OUTGOING_COPY : INCOMING_COPY;
  return (
    table[transition] ?? {
      label: transition.replace(/_/g, ' '),
      description: mine
        ? 'A contract change you proposed, waiting on the agent.'
        : 'A contract change awaiting your decision.',
    }
  );
}

export interface StatusRequestPanelProps {
  request: ContractStatusRequest;
  busy: boolean;
  note: string;
  noteOpen: boolean;
  onNoteChange: (value: string) => void;
  onOpenNote: () => void;
  onResolve: (decision: ContractStatusRequestDecision) => void;
  onCancel: () => void;
}

export function StatusRequestPanel({
  request,
  busy,
  note,
  noteOpen,
  onNoteChange,
  onOpenNote,
  onResolve,
  onCancel,
}: StatusRequestPanelProps) {
  const can = (action: ContractStatusRequestAction) => request.availableActions?.includes(action);
  const mine = !request.awaitingMyDecision;
  const copy = transitionCopy(request.transition, mine);
  const blocking = request.blockingConditions;
  const isBlocked = blocking != null && !blocking.clear;

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{copy.label}</Badge>
          <span className="text-xs text-muted-foreground">Raised {formatDate(request.createdAt)}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{copy.description}</p>
        {request.reason && <p className="text-sm mt-1">“{request.reason}”</p>}
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
              {mine
                ? 'Re-checked when the agent agrees — until it clears, their approval would be refused.'
                : 'Checked again when you approve — approving now would be refused.'}
            </p>
          </div>
        </div>
      )}

      {noteOpen && (
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Add a note for the agent (optional)…"
        />
      )}

      <div className="flex flex-wrap gap-2">
        {can('approve') && (
          <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => onResolve('approve')}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Approve
          </Button>
        )}
        {can('reject') && (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => onResolve('reject')}>
            <X className="w-3.5 h-3.5" /> Reject
          </Button>
        )}
        {can('cancel') && (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={onCancel}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
            Cancel request
          </Button>
        )}
        {!noteOpen && request.availableActions?.length > 0 && (
          <Button size="sm" variant="ghost" onClick={onOpenNote}>
            Add a note
          </Button>
        )}
      </div>
    </div>
  );
}
