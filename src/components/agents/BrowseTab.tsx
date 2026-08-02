import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchFilterBar } from '@/components/common/SearchFilterBar';
import { AgentCard, AgentCardSkeleton } from '@/components/agents/AgentCard';
import { AgentDetailSheet } from '@/components/agents/AgentDetailSheet';
import { AgentFiltersPanel } from '@/components/agents/AgentFiltersPanel';
import {
  countActiveAgentFilters,
  INITIAL_AGENT_FILTERS,
  toAgentBrowseParams,
  type AgentFilters,
} from '@/components/agents/agentFilters';
import { useAgentActions } from '@/hooks/useAgentActions';
import { useIsMobile } from '@/hooks/use-mobile';
import { agentsService } from '@/services/agents.service';
import { ApiError } from '@/types/api';
import type { AgentDirectoryItem, AgentListMeta, AgentMembership } from '@/types/agent.types';

// ─── Per-card action slot ───────────────────────────────────────────────────────
// Which button belongs on a card is decided entirely by `contract`: absent or
// terminal → Request; pending → Withdraw if we raised it, Approve/Decline if the
// agent did; live → a status pill. The directory already carries `initiatedBy`,
// so unlike the vendor browse there is nothing to fetch lazily here.

/**
 * `size="sm"` is 32px tall — fine as a trailing control on a desktop row, under
 * the touch-target minimum once these drop onto the card's own action bar on a
 * phone. See the `max-md:` restack in `AgentCard`.
 */
const ACTION_BUTTON = 'max-md:h-10 max-md:px-4';

function ContractActionSlot({
  agent,
  actions,
}: {
  agent: AgentDirectoryItem;
  actions: ReturnType<typeof useAgentActions>;
}) {
  const contract = agent.contract;

  // No history, or a terminal one — a fresh request creates a NEW contract
  // rather than reviving the old row, so "Request again" is a plain request.
  if (!contract || contract.status === 'rejected' || contract.status === 'withdrawn' || contract.status === 'deactivated') {
    const key = `request:${agent.id}`;
    return (
      <Button
        size="sm"
        variant="outline"
        className={ACTION_BUTTON}
        disabled={actions.pendingKey === key}
        onClick={() => actions.request(agent.id)}
      >
        {actions.pendingKey === key ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : contract ? (
          'Request again'
        ) : (
          'Request'
        )}
      </Button>
    );
  }

  if (contract.status === 'pending') {
    // Whoever raised it cannot answer it — that consent is the point of the
    // handshake, and asking for the wrong action is a 403.
    if (contract.initiatedBy === 'agency') {
      const key = `withdraw:${contract.id}`;
      return (
        <Button
          size="sm"
          variant="outline"
          className={ACTION_BUTTON}
          disabled={actions.pendingKey === key}
          onClick={() => actions.withdraw(agent.id, contract.id)}
        >
          {actions.pendingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Withdraw'}
        </Button>
      );
    }

    const approveKey = `approve:${contract.id}`;
    const rejectKey = `reject:${contract.id}`;
    return (
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          className={ACTION_BUTTON}
          disabled={actions.pendingKey === approveKey}
          onClick={() => actions.approve(contract.id, agent.id)}
        >
          {actions.pendingKey === approveKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Approve'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={ACTION_BUTTON}
          disabled={actions.pendingKey === rejectKey}
          onClick={() => actions.reject(contract.id, undefined, agent.id)}
        >
          {actions.pendingKey === rejectKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Decline'}
        </Button>
      </div>
    );
  }

  if (contract.status === 'active') {
    return (
      <Badge variant="secondary" className="text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800">
        On your roster
      </Badge>
    );
  }

  // paused / suspended — managed from the Connections tab, not from here.
  return (
    <Badge variant="secondary" className="capitalize">
      {contract.status}
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
  const isMobile = useIsMobile();
  const [agents, setAgents] = useState<AgentDirectoryItem[]>([]);
  const [meta, setMeta] = useState<AgentListMeta | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [detailAgent, setDetailAgent] = useState<AgentDirectoryItem | null>(null);

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
        setFetchError(err instanceof ApiError ? err.message : 'Failed to load agents. Please try again.');
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
      rightSlot={<ContractActionSlot agent={agent} actions={actions} />}
    />
  ));

  return (
    <div className="space-y-3">
      <SearchFilterBar
        value={search}
        onChange={handleSearchChange}
        placeholder="Search agents…"
        searchLabel="Search agents by name or home base"
        activeCount={activeFilterCount}
        onReset={handleClearFilters}
        filterDescription="Every agent on the platform who could take your shipments."
        resultCount={meta?.total}
        resultNoun="agent"
      >
        <AgentFiltersPanel filters={filters} onChange={handleFilterChange} />
      </SearchFilterBar>

      <div className="flex items-center justify-between h-5">
        {!loadingAgents && meta && (
          <p className="text-xs text-muted-foreground">
            {meta.total} {meta.total === 1 ? 'agent' : 'agents'} found
          </p>
        )}
        {loadingAgents && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>

      {fetchError ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">{fetchError}</p>
          <Button variant="outline" onClick={() => loadAgents(appliedFilters, appliedSearch, page)}>
            Retry
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
            {activeFilterCount > 0 || appliedSearch
              ? 'No agents match your search or filters.'
              : 'No agents are available to contract with yet.'}
          </p>
          {(activeFilterCount > 0 || appliedSearch) && (
            <button
              type="button"
              onClick={() => { handleSearchChange(''); handleClearFilters(); }}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Clear all filters
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
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {meta.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= meta.totalPages || loadingAgents}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <AgentDetailSheet
        agent={detailAgent}
        open={detailAgent !== null}
        onOpenChange={(open) => { if (!open) setDetailAgent(null); }}
        footerSlot={detailAgent && <ContractActionSlot agent={detailAgent} actions={actions} />}
      />
    </div>
  );
}
