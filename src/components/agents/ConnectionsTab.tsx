import { formatNumber } from '@/lib/format';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, Star, User, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { useAgentsRoster } from '@/store/agents.store';
import { useAgentActions } from '@/hooks/useAgentActions';
import { getApiErrorMessage } from '@/lib/errors';
import { MembershipStatusBadge } from '@/components/agents/MembershipStatusBadge';
import { AgentMembershipDialog } from '@/components/agents/AgentMembershipDialog';
import { StatusRequestPanel } from '@/components/agents/StatusRequestPanel';
import { TermsProposalPanel } from '@/components/agents/TermsProposalPanel';
import {
  getVehicleIcon,
  formatVehicleType,
  vehicleColorSwatch,
} from '@/components/agents/vehicle.constants';
import {
  agentAvatarUrl,
  contractOffer,
  HISTORY_MEMBERSHIP_STATUSES,
  type ContractStatusRequest,
  type ContractStatusRequestDecision,
  type ContractTermsProposal,
  type MembershipStatus,
  type RosterEntry,
} from '@/types/agent.types';

/**
 * Agents → Connections tab: every contract your agency has, past and present,
 * and every decision waiting on you — the direct counterpart of the vendor
 * Connections tab.
 *
 * Three kinds of decision land here, deliberately on the same row as the agent
 * they concern rather than in a separate inbox:
 *
 * 1. **Offers** — a `pending` contract, whose terms one side has put on the
 *    table. The party who made the standing offer may only withdraw it; the
 *    other may approve, decline or counter. That is `awaitingDecisionFrom`, not
 *    `initiatedBy` — an agency that opened the contract becomes the answering
 *    party the moment the agent counters. `contractOffer` reads the rule.
 * 2. **Terms changes on a live contract** (`GET /agency/agents/terms-proposals`)
 *    — staged, never applied: the agreed split goes on pricing deliveries until
 *    the proposal is accepted.
 * 3. **Status changes** — a pause, a resume or a departure someone proposed
 *    (`GET /agency/agents/status-requests`). Two-party transitions: whoever
 *    moves raises a request and the other side clears it.
 *
 * Both list endpoints return BOTH directions, so a row is either ours to answer
 * or ours to pull back — never both, and never inferred: `availableActions`
 * names the verbs the server will accept.
 */

type StatusChip =
  | 'all'
  | 'requests'
  | 'active'
  | 'change_requested'
  | 'terms_proposed'
  | 'paused'
  | 'suspended'
  | 'history';

/** Chip order. The copy lives in `agents:connections.chips.*`, keyed by value. */
const STATUS_CHIPS: StatusChip[] = [
  'all',
  'requests',
  'active',
  'change_requested',
  'terms_proposed',
  'paused',
  'suspended',
  'history',
];

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
  const { t } = useTranslation(['agents', 'common']);
  const { roster, statusRequests, termsProposals, isLoading, error, refetch } = useAgentsRoster();

  const statusFilters = useMemo(
    () =>
      STATUS_CHIPS.map((value) => ({
        value,
        label: t(`connections.chips.${value}` as 'connections.chips.all'),
      })),
    [t],
  );

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

  /** The pending status change on this contract, in either direction. */
  const requestByContract = useMemo(() => {
    const map = new Map<string, ContractStatusRequest>();
    for (const request of statusRequests) map.set(request.contractId, request);
    return map;
  }, [statusRequests]);

  /** The open terms proposal on this contract — at most one, by unique index. */
  const proposalByContract = useMemo(() => {
    const map = new Map<string, ContractTermsProposal>();
    for (const proposal of termsProposals) map.set(proposal.contractId, proposal);
    return map;
  }, [termsProposals]);

  const clearNote = (result: unknown) => {
    if (result) {
      setNoteFor(null);
      setNote('');
    }
  };

  const resolve = async (request: ContractStatusRequest, decision: ContractStatusRequestDecision) =>
    clearNote(await actions.resolveStatusRequest(request.id, decision, note.trim() || undefined));

  const cancel = async (request: ContractStatusRequest) =>
    clearNote(await actions.cancelStatusRequest(request.id, note.trim() || undefined));

  const matchesChip = (entry: RosterEntry): boolean => {
    const status: MembershipStatus = entry.membership.status;
    switch (chip) {
      case 'all':
        return true;
      case 'requests':
        return status === 'pending';
      case 'change_requested':
        return requestByContract.has(entry.membership.id);
      case 'terms_proposed':
        return proposalByContract.has(entry.membership.id);
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
        placeholder={t('connections.searchPlaceholder')}
        searchLabel={t('connections.searchLabel')}
        activeCount={chip === 'all' ? 0 : 1}
        onReset={() => setChip('all')}
        filterDescription={t('connections.filterDescription')}
        resultCount={filtered.length}
        resultNounKey="common:nouns.contract"
      >
        <FilterSection label={t('connections.statusFilter')}>
          <FilterOptionGroup value={chip} onChange={setChip} options={statusFilters} />
        </FilterSection>
      </SearchFilterBar>

      {listLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> {t('connections.loading')}
        </div>
      ) : error && roster.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">{getApiErrorMessage(error)}</p>
          <Button variant="outline" onClick={refetch}>{t('common:actions.retry')}</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-xl">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {query
              ? t('connections.emptyFiltered')
              : chip === 'all'
                ? t('connections.empty')
                : t('connections.emptyCategory')}
          </p>
        </div>
      ) : (
        <div className="-mx-4 divide-y border-y sm:-mx-6 md:mx-0 md:space-y-2 md:divide-y-0 md:border-y-0">
          {filtered.map((entry) => {
            const { membership, agent, cashHeld } = entry;
            const VehicleIcon = getVehicleIcon(agent.vehicleInfo?.vehicle_type);
            const avatar = agentAvatarUrl(agent);
            const request = requestByContract.get(membership.id);
            const proposal = proposalByContract.get(membership.id);
            const offer = contractOffer(membership);
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
                    className="flex items-center gap-3 min-w-0 text-start"
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
                          {agent.vehicleInfo
                            ? formatVehicleType(agent.vehicleInfo.vehicle_type)
                            : t('common:values.notAvailable')}
                          {/* The plate is what picks one bike out of five in a
                              yard; the swatch only when we can actually draw it. */}
                          {vehicleColorSwatch(agent.vehicleInfo?.color) && (
                            <span
                              aria-hidden
                              className="h-2.5 w-2.5 flex-shrink-0 rounded-full border"
                              style={{ backgroundColor: vehicleColorSwatch(agent.vehicleInfo?.color)! }}
                            />
                          )}
                          {agent.vehicleInfo?.plate_number && (
                            <span className="font-mono">{agent.vehicleInfo.plate_number}</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          {agent.trustScore}
                        </span>
                        {cashHeld > 0 && (
                          <span className="text-amber-600">
                            {t('connections.holdsCash', { amount: formatNumber(cashHeld) })}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex-shrink-0">
                    {/* The standing offer is theirs → we answer it. Countering
                        needs the terms editor, so that one lives in the sheet. */}
                    {offer === 'ours-to-answer' ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          className="gap-1"
                          disabled={pendingApprove}
                          onClick={() => actions.approve(membership.id, agent.id)}
                        >
                          {pendingApprove ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          {t('connections.accept')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={pendingReject}
                          onClick={() => actions.reject(membership.id, undefined, agent.id)}
                        >
                          {pendingReject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          {t('connections.decline')}
                        </Button>
                      </div>
                    ) : offer === 'theirs-to-answer' ? (
                      // Ours is the standing offer — it is theirs to answer, ours to pull back.
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingWithdraw}
                        onClick={() => actions.withdraw(agent.id, membership.id)}
                      >
                        {pendingWithdraw ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('connections.withdraw')}
                      </Button>
                    ) : offer === 'needs-terms' ? (
                      // A bare join request: nobody has stated terms, so there is
                      // nothing to approve. Approving would be 422
                      // CONTRACT_TERMS_NOT_PROPOSED — we owe the first offer.
                      <Button size="sm" onClick={() => setSelected(entry)}>
                        {t('connections.proposeTerms')}
                      </Button>
                    ) : HISTORY_MEMBERSHIP_STATUSES.includes(membership.status) ? (
                      <Button size="sm" variant="ghost" onClick={() => setSelected(entry)}>
                        {t('connections.view')}
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setSelected(entry)}>
                        {t('connections.manage')}
                      </Button>
                    )}
                  </div>
                </div>

                {request && (
                  <StatusRequestPanel
                    request={request}
                    busy={
                      actions.pendingKey === `resolve:${request.id}` ||
                      actions.pendingKey === `cancel:${request.id}`
                    }
                    note={note}
                    noteOpen={noteFor === request.id}
                    onNoteChange={setNote}
                    onOpenNote={() => { setNoteFor(request.id); setNote(''); }}
                    onResolve={(decision) => resolve(request, decision)}
                    onCancel={() => cancel(request)}
                  />
                )}

                {proposal && (
                  <TermsProposalPanel
                    proposal={proposal}
                    busy={
                      actions.pendingKey === `proposal-resolve:${proposal.id}` ||
                      actions.pendingKey === `proposal-cancel:${proposal.id}`
                    }
                    note={note}
                    noteOpen={noteFor === proposal.id}
                    onNoteChange={setNote}
                    onOpenNote={() => { setNoteFor(proposal.id); setNote(''); }}
                    onResolve={async (decision) =>
                      clearNote(
                        await actions.resolveTermsProposal(proposal.id, decision, note.trim() || undefined),
                      )
                    }
                    onCancel={async () =>
                      clearNote(
                        await actions.cancelTermsProposal(proposal.id, note.trim() || undefined),
                      )
                    }
                    // Countering means writing figures, which needs the editor.
                    onCounter={() => setSelected(entry)}
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
