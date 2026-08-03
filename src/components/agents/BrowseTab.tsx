import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchFilterBar } from '@/components/common/SearchFilterBar';
import { AgentCard, AgentCardSkeleton } from '@/components/agents/AgentCard';
import { AgentDetailSheet } from '@/components/agents/AgentDetailSheet';
import { AgentFiltersPanel } from '@/components/agents/AgentFiltersPanel';
import { RequestAgentDialog } from '@/components/agents/RequestAgentDialog';
import {
  countActiveAgentFilters,
  INITIAL_AGENT_FILTERS,
  toAgentBrowseParams,
  type AgentFilters,
} from '@/components/agents/agentFilters';
import { useAgentActions } from '@/hooks/useAgentActions';
import { useIsMobile } from '@/hooks/use-mobile';
import { agentsService } from '@/services/agents.service';
import { getApiErrorMessage } from '@/lib/errors';
import { HISTORY_MEMBERSHIP_STATUSES } from '@/types/agent.types';
import type { AgentDirectoryItem, AgentListMeta, AgentMembership } from '@/types/agent.types';

// ─── Per-card action slot ───────────────────────────────────────────────────────
// Which control belongs on a card is decided by `contract`: absent or terminal →
// Offer; live → a status pill; pending → a link into the roster.
//
// A pending contract is deliberately NOT answerable from here. Terms are
// negotiated now, so whose move it is comes from `awaitingDecisionFrom` — and a
// directory row does not carry it. `initiatedBy` cannot stand in: an agency that
// raised a request becomes the answering party the moment the agent counters,
// and a bare agent join request is nobody's to approve until we make an offer.
// Guessing from what the directory does carry would render Approve on rows the
// server answers with 403, so the card sends the user where the whole contract
// is loaded instead.

/**
 * `size="sm"` is 32px tall — fine as a trailing control on a desktop row, under
 * the touch-target minimum once these drop onto the card's own action bar on a
 * phone. See the `max-md:` restack in `AgentCard`.
 */
const ACTION_BUTTON = 'max-md:h-10 max-md:px-4';

function ContractActionSlot({
  agent,
  actions,
  onOffer,
}: {
  agent: AgentDirectoryItem;
  actions: ReturnType<typeof useAgentActions>;
  onOffer: (agent: AgentDirectoryItem) => void;
}) {
  const { t } = useTranslation('agents');
  const contract = agent.contract;

  // No history, or a terminal one — a fresh request creates a NEW contract
  // rather than reviving the old row, so "Offer again" is a plain offer.
  if (!contract || HISTORY_MEMBERSHIP_STATUSES.includes(contract.status)) {
    return (
      <Button
        size="sm"
        variant="outline"
        className={ACTION_BUTTON}
        disabled={actions.pendingKey === `request:${agent.id}`}
        onClick={() => onOffer(agent)}
      >
        {actions.pendingKey === `request:${agent.id}` ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : contract ? (
          t('browse.offerAgain')
        ) : (
          t('browse.offer')
        )}
      </Button>
    );
  }

  if (contract.status === 'pending') {
    return (
      <Button asChild size="sm" variant="outline" className={ACTION_BUTTON}>
        <Link to={`/dashboard/agents/${contract.id}`}>{t('browse.reviewOffer')}</Link>
      </Button>
    );
  }

  if (contract.status === 'active') {
    return (
      <Badge variant="secondary" className="text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800">
        {t('browse.onRoster')}
      </Badge>
    );
  }

  // paused / suspended — managed from the Connections tab, not from here.
  return (
    <Badge variant="secondary">
      {t(`membershipStatus.${contract.status}` as 'membershipStatus.paused')}
    </Badge>
  );
}

// ─── Browser ────────────────────────────────────────────────────────────────────

export interface BrowseTabProps {
  /** Called after any successful contract mutation, so the parent can refresh the roster. */
  onContractChange?: () => void;
}

/** Agents → Browse tab: the platform directory, each card driven by your contract state. */
export function BrowseTab({ onContractChange }: BrowseTabProps) {
  const { t } = useTranslation(['agents', 'common']);
  const isMobile = useIsMobile();
  const [agents, setAgents] = useState<AgentDirectoryItem[]>([]);
  const [meta, setMeta] = useState<AgentListMeta | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [detailAgent, setDetailAgent] = useState<AgentDirectoryItem | null>(null);
  /** The agent whose offer is being written — `POST /requests` needs terms with it. */
  const [offerAgent, setOfferAgent] = useState<AgentDirectoryItem | null>(null);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<AgentFilters>(INITIAL_AGENT_FILTERS);
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<AgentFilters>(INITIAL_AGENT_FILTERS);
  const [page, setPage] = useState(1);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Fold a mutated contract back onto its card so the button flips without a refetch. */
  const applyContract = useCallback(
    (agentId: string, contract: AgentMembership) => {
      const ref = {
        id: contract.id,
        status: contract.status,
        initiatedBy: contract.initiatedBy,
        isPrimary: contract.isPrimary,
      };
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, contract: ref } : a)));
      setDetailAgent((prev) => (prev && prev.id === agentId ? { ...prev, contract: ref } : prev));
      onContractChange?.();
    },
    [onContractChange],
  );

  const actions = useAgentActions({ onContractChanged: applyContract });

  const loadAgents = useCallback(
    async (currentFilters: AgentFilters, currentSearch: string, currentPage: number) => {
      setLoadingAgents(true);
      setFetchError(null);
      try {
        const params = { ...toAgentBrowseParams(currentFilters), page: currentPage };
        if (currentSearch) params.search = currentSearch;

        const res = await agentsService.browse(params);
        setAgents(res.data ?? []);
        setMeta(res.meta ?? null);
      } catch (err) {
        setFetchError(getApiErrorMessage(err));
      } finally {
        setLoadingAgents(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadAgents(appliedFilters, appliedSearch, page);
  }, [appliedFilters, appliedSearch, page, loadAgents]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setAppliedSearch(value);
      setPage(1);
    }, 400);
  };

  const handleFilterChange = <K extends keyof AgentFilters>(key: K, value: AgentFilters[K]) => {
    const next = { ...filters, [key]: value };
    setFilters(next);

    // Only the trust box is free typing; the pills apply immediately.
    if (key === 'minTrustScore') {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
      filterDebounceRef.current = setTimeout(() => {
        setAppliedFilters(next);
        setPage(1);
      }, 400);
    } else {
      setAppliedFilters(next);
      setPage(1);
    }
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_AGENT_FILTERS);
    setAppliedFilters(INITIAL_AGENT_FILTERS);
    setPage(1);
  };

  const activeFilterCount = countActiveAgentFilters(appliedFilters);

  // Shared by both branches below so the mobile/desktop split is only about the
  // scroll container, never about what the list renders.
  const agentCards = agents.map((agent) => (
    <AgentCard
      key={agent.id}
      agent={agent}
      onInfo={() => setDetailAgent(agent)}
      rightSlot={<ContractActionSlot agent={agent} actions={actions} onOffer={setOfferAgent} />}
    />
  ));

  return (
    <div className="space-y-3">
      <SearchFilterBar
        value={search}
        onChange={handleSearchChange}
        placeholder={t('browse.searchPlaceholder')}
        searchLabel={t('browse.searchLabel')}
        activeCount={activeFilterCount}
        onReset={handleClearFilters}
        filterDescription={t('browse.filterDescription')}
        resultCount={meta?.total}
        resultNounKey="common:nouns.agent"
      >
        <AgentFiltersPanel filters={filters} onChange={handleFilterChange} />
      </SearchFilterBar>

      <div className="flex items-center justify-between h-5">
        {!loadingAgents && meta && (
          <p className="text-xs text-muted-foreground">{t('browse.found', { count: meta.total })}</p>
        )}
        {loadingAgents && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>

      {fetchError ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">{fetchError}</p>
          <Button variant="outline" onClick={() => loadAgents(appliedFilters, appliedSearch, page)}>
            {t('common:actions.retry')}
          </Button>
        </div>
      ) : loadingAgents && agents.length === 0 ? (
        <div className="space-y-3 p-1">
          {[1, 2, 3].map((i) => <AgentCardSkeleton key={i} />)}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-10">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {activeFilterCount > 0 || appliedSearch ? t('browse.emptyFiltered') : t('browse.empty')}
          </p>
          {(activeFilterCount > 0 || appliedSearch) && (
            <button
              type="button"
              onClick={() => { handleSearchChange(''); handleClearFilters(); }}
              className="mt-2 text-xs text-primary hover:underline"
            >
              {t('browse.clearFilters')}
            </button>
          )}
        </div>
      ) : isMobile ? (
        // No ScrollArea on phones — Radix's viewport wrapper is shrink-to-fit
        // while the viewport clips horizontally, which slices the action buttons
        // off the right edge. Here the page scrolls instead. See `vendors/BrowseTab`.
        <div className="space-y-3">{agentCards}</div>
      ) : (
        <ScrollArea className="h-[52vh] min-h-[220px]">
          <div className="space-y-3 pr-3">{agentCards}</div>
        </ScrollArea>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || loadingAgents}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('common:actions.previous')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('common:pagination.pageOf', { page, total: meta.totalPages })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= meta.totalPages || loadingAgents}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('common:actions.next')}
          </Button>
        </div>
      )}

      <AgentDetailSheet
        agent={detailAgent}
        open={detailAgent !== null}
        onOpenChange={(open) => { if (!open) setDetailAgent(null); }}
        footerSlot={
          detailAgent && (
            <ContractActionSlot agent={detailAgent} actions={actions} onOffer={setOfferAgent} />
          )
        }
      />

      <RequestAgentDialog
        agent={offerAgent}
        open={offerAgent !== null}
        onOpenChange={(open) => { if (!open) setOfferAgent(null); }}
        busy={offerAgent ? actions.pendingKey === `request:${offerAgent.id}` : false}
        onSubmit={(terms) => actions.request(offerAgent!.id, terms)}
      />
    </div>
  );
}
