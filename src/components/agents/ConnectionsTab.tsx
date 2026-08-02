import { formatNumber, formatDate } from '@/lib/format';
import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, Star, User, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { useAgentsRoster } from '@/store/agents.store';
import { useAgentActions } from '@/hooks/useAgentActions';
import { MembershipStatusBadge } from '@/components/agents/MembershipStatusBadge';
import { AgentMembershipDialog } from '@/components/agents/AgentMembershipDialog';
import { getVehicleIcon, formatVehicleType } from '@/components/agents/vehicle.constants';
import {
  agentAvatarUrl,
  HISTORY_MEMBERSHIP_STATUSES,
  type ContractStatusRequest,
  type ContractStatusRequestDecision,
  type MembershipStatus,
  type RosterEntry,
} from '@/types/agent.types';

/**
 * Agents → Connections tab: every contract your agency has, past and present,
 * and every decision waiting on you — the direct counterpart of the vendor
 * Connections tab.
 *
 * Two kinds of decision land here, and they are deliberately on the same row as
 * the agent they concern rather than in a separate inbox:
 *
 * 1. **Join requests** — a `pending` contract. Whoever raised it cannot answer
 *    it, so the buttons come from `initiatedBy`: the agent applied → Approve /
 *    Reject; we approached them → Withdraw. Offering the wrong pair is a 403.
 * 2. **Contract changes** — a pause, a resume or a departure the *agent*
 *    proposed (`GET /agency/agents/status-requests`). Ending or pausing a
 *    contract is a two-party transition: whoever moves raises a request and the
 *    other side clears it. Requests we raised ourselves (e.g. proposing a
 *    removal) are absent here by design — the agent clears those.
 */

type StatusChip = 'all' | 'requests' | 'active' | 'change_requested' | 'paused' | 'suspended' | 'history';

const STATUS_FILTERS: { value: StatusChip; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'requests', label: 'Join requests' },
  { value: 'active', label: 'Active' },
  { value: 'change_requested', label: 'Change requested' },
  { value: 'paused', label: 'Paused' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'history', label: 'History' },
];

const TRANSITION_COPY: Record<string, { label: string; description: string }> = {
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

function transitionCopy(transition: string) {
  return (
    TRANSITION_COPY[transition] ?? {
      label: transition.replace(/_/g, ' '),
      description: 'A contract change awaiting your decision.',
    }
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────────

function StatusRequestPanel({
  request,
  busy,
  note,
  noteOpen,
  onNoteChange,
  onOpenNote,
  onResolve,
}: {
  request: ContractStatusRequest;
  busy: boolean;
  note: string;
  noteOpen: boolean;
  onNoteChange: (value: string) => void;
  onOpenNote: () => void;
  onResolve: (decision: ContractStatusRequestDecision) => void;
}) {
  const copy = transitionCopy(request.transition);
  const blocking = request.blockingConditions;
  const isBlocked = blocking != null && !blocking.clear;

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{copy.label}</Badge>
          <span className="text-xs text-muted-foreground">
            Raised {formatDate(request.requestedAt ?? request.createdAt)}
          </span>
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
            <p className="opacity-80">Checked again when you approve — approving now would be refused.</p>
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
        <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => onResolve('approve')}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Approve
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => onResolve('reject')}>
          <X className="w-3.5 h-3.5" /> Reject
        </Button>
        {!noteOpen && (
          <Button size="sm" variant="ghost" onClick={onOpenNote}>
            Add a note
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Tab ────────────────────────────────────────────────────────────────────────

export interface ConnectionsTabProps {
  /** Called after any successful mutation, so the parent can refresh the shared pending-action badge. */
  onContractChange?: () => void;
  /**
   * Contract to open on arrival — an `agent_contract.*` notification deep-links
   * to `agents/{contractId}`. Honoured once the roster has loaded the row.
   */
  openContractId?: string | null;
}

export function ConnectionsTab({ onContractChange, openContractId }: ConnectionsTabProps) {
  const { roster, statusRequests, isLoading, error, refetch } = useAgentsRoster();

  const [chip, setChip] = useState<StatusChip>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<RosterEntry | null>(null);
  // Which status request has its note box open, and what has been typed into it.
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');

  // Terminal contracts arrive with the roster — `GET /agency/agents` returns
  // every status by default, and those rows ARE the relationship history — so
  // the History chip is just another filter over the same list, not its own fetch.
  const actions = useAgentActions({
    onRosterChanged: () => {
      refetch();
      onContractChange?.();
    },
  });

  // A deep-linked contract opens as soon as its row arrives — the roster is
  // fetched asynchronously, so it usually is not there on first render. Derived
  // rather than pushed into state from an effect, which would rerender twice;
  // `deepLinkDismissed` is what stops it reopening after the user closes it.
  const [deepLinkDismissed, setDeepLinkDismissed] = useState(false);
  const deepLinked =
    openContractId && !deepLinkDismissed
      ? roster.find((e) => e.membership.id === openContractId) ?? null
      : null;
  const activeEntry = selected ?? deepLinked;

  /** The pending change an agent raised on this contract, if any. */
  const requestByContract = useMemo(() => {
    const map = new Map<string, ContractStatusRequest>();
    for (const request of statusRequests) map.set(request.contractId, request);
    return map;
  }, [statusRequests]);

  const resolve = async (request: ContractStatusRequest, decision: ContractStatusRequestDecision) => {
    const result = await actions.resolveStatusRequest(request.id, decision, note.trim() || undefined);
    if (result) {
      setNoteFor(null);
      setNote('');
    }
  };

  const matchesChip = (entry: RosterEntry): boolean => {
    const status: MembershipStatus = entry.membership.status;
    switch (chip) {
      case 'all':
        return true;
      case 'requests':
        return status === 'pending';
      case 'change_requested':
        return requestByContract.has(entry.membership.id);
      case 'history':
        return HISTORY_MEMBERSHIP_STATUSES.includes(status);
      default:
        return status === chip;
    }
  };

  const query = search.trim().toLowerCase();
  const filtered = roster.filter((entry) => {
    if (!entry.agent) return false;
    if (!matchesChip(entry)) return false;
    if (!query) return true;
    const { name, email, phone } = entry.agent;
    return [name, email, phone].some((field) => field?.toLowerCase().includes(query));
  });

  const listLoading = isLoading && roster.length === 0;

  return (
    <div className="space-y-3">
      <SearchFilterBar
        value={search}
        onChange={setSearch}
        placeholder="Search agents…"
        searchLabel="Search your agents by name, email, or phone"
        activeCount={chip === 'all' ? 0 : 1}
        onReset={() => setChip('all')}
        filterDescription="Every agent contract your agency has, past and present."
        resultCount={filtered.length}
        resultNoun="contract"
      >
        <FilterSection label="Contract status">
          <FilterOptionGroup value={chip} onChange={setChip} options={STATUS_FILTERS} />
        </FilterSection>
      </SearchFilterBar>

      {listLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading contracts…
        </div>
      ) : error && roster.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          <Button variant="outline" onClick={refetch}>Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-xl">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {query
              ? 'No agents match your search.'
              : chip === 'all'
                ? 'No agent contracts yet — find an agent in the Browse tab.'
                : 'Nothing in this category yet.'}
          </p>
        </div>
      ) : (
        <div className="-mx-4 divide-y border-y sm:-mx-6 md:mx-0 md:space-y-2 md:divide-y-0 md:border-y-0">
          {filtered.map((entry) => {
            const { membership, agent, cashHeld } = entry;
            const VehicleIcon = getVehicleIcon(agent.vehicleInfo?.vehicle_type);
            const avatar = agentAvatarUrl(agent);
            const request = requestByContract.get(membership.id);
            const pendingApprove = actions.pendingKey === `approve:${membership.id}`;
            const pendingReject = actions.pendingKey === `reject:${membership.id}`;
            const pendingWithdraw = actions.pendingKey === `withdraw:${membership.id}`;

            return (
              <div
                key={membership.id}
                className="space-y-3 p-4 md:rounded-xl md:border md:border-border md:p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="flex items-center gap-3 min-w-0 text-left"
                    onClick={() => setSelected(entry)}
                  >
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {avatar ? (
                        <img src={avatar} alt={agent.name} crossOrigin="use-credentials" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{agent.name}</span>
                        <MembershipStatusBadge status={membership.status} className="text-[10px]" />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <VehicleIcon className="w-3 h-3" />
                          {agent.vehicleInfo ? formatVehicleType(agent.vehicleInfo.vehicle_type) : '—'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          {agent.trustScore}
                        </span>
                        {cashHeld > 0 && <span className="text-amber-600">Holds {formatNumber(cashHeld)}</span>}
                      </div>
                    </div>
                  </button>

                  <div className="flex-shrink-0">
                    {membership.status === 'pending' ? (
                      membership.initiatedBy === 'agent' ? (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            className="gap-1"
                            disabled={pendingApprove}
                            onClick={() => actions.approve(membership.id, agent.id)}
                          >
                            {pendingApprove ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={pendingReject}
                            onClick={() => actions.reject(membership.id, undefined, agent.id)}
                          >
                            {pendingReject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                            Decline
                          </Button>
                        </div>
                      ) : (
                        // We approached them — it is theirs to answer, ours to pull back.
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingWithdraw}
                          onClick={() => actions.withdraw(agent.id, membership.id)}
                        >
                          {pendingWithdraw ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Withdraw'}
                        </Button>
                      )
                    ) : HISTORY_MEMBERSHIP_STATUSES.includes(membership.status) ? (
                      <Button size="sm" variant="ghost" onClick={() => setSelected(entry)}>
                        View
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setSelected(entry)}>
                        Manage
                      </Button>
                    )}
                  </div>
                </div>

                {request && (
                  <StatusRequestPanel
                    request={request}
                    busy={actions.pendingKey === `resolve:${request.id}`}
                    note={note}
                    noteOpen={noteFor === request.id}
                    onNoteChange={setNote}
                    onOpenNote={() => { setNoteFor(request.id); setNote(''); }}
                    onResolve={(decision) => resolve(request, decision)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <AgentMembershipDialog
        entry={activeEntry}
        open={!!activeEntry}
        onOpenChange={(open) => {
          if (open) return;
          setSelected(null);
          setDeepLinkDismissed(true);
        }}
        onChanged={() => {
          refetch();
          onContractChange?.();
        }}
      />
    </div>
  );
}
