import { useTranslation } from 'react-i18next';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { TrackedAgentCard } from '@/components/tracking/TrackedAgentCard';
import { cn } from '@/lib/utils';
import type { AgentLiveFix, TrackingBoardAgent } from '@/types/tracking.types';

export type SignalFilter = 'all' | 'live' | 'no_signal' | 'ended';

interface TrackingPanelProps {
  /** Already filtered by the page — the map still shows everyone. */
  agents: TrackingBoardAgent[];
  search: string;
  onSearchChange: (value: string) => void;
  signalFilter: SignalFilter;
  onSignalFilterChange: (value: SignalFilter) => void;
  fixes: Record<string, AgentLiveFix>;
  revoked: Set<string>;
  selectedAgentId: string | null;
  selectedShipmentId: string | null;
  isDark: boolean;
  onSelectAgent: (agentId: string) => void;
  onSelectShipment: (agentId: string, shipmentId: string) => void;
  className?: string;
}

/**
 * The roster side of Live Tracking — one component behind both shells: a
 * closable sidebar on desktop, a bottom sheet on phones. The search row sticks
 * to the top of its own scroll area so it survives a long list.
 */
export function TrackingPanel({
  agents,
  search,
  onSearchChange,
  signalFilter,
  onSignalFilterChange,
  fixes,
  revoked,
  selectedAgentId,
  selectedShipmentId,
  isDark,
  onSelectAgent,
  onSelectShipment,
  className,
}: TrackingPanelProps) {
  const { t } = useTranslation('tracking');

  const signalFilters: { value: SignalFilter; label: string }[] = [
    { value: 'all', label: t('filters.signalAll') },
    { value: 'live', label: t('filters.signalLive') },
    { value: 'no_signal', label: t('filters.signalNoSignal') },
    { value: 'ended', label: t('filters.signalEnded') },
  ];

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="sticky top-0 z-10 bg-background pb-2">
        <SearchFilterBar
          value={search}
          onChange={onSearchChange}
          placeholder={t('filters.searchPlaceholder')}
          searchLabel={t('filters.searchLabel')}
          activeCount={signalFilter === 'all' ? 0 : 1}
          onReset={() => onSignalFilterChange('all')}
          filterDescription={t('filters.description')}
          resultCount={agents.length}
          resultNounKey="common:nouns.agent"
        >
          <FilterSection label={t('filters.signal')}>
            <FilterOptionGroup
              value={signalFilter}
              onChange={onSignalFilterChange}
              options={signalFilters}
            />
          </FilterSection>
        </SearchFilterBar>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2 pe-0.5">
        {agents.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            {t('filters.noMatches')}
          </p>
        ) : (
          agents.map((agent) => (
            <TrackedAgentCard
              key={agent.agentId}
              agent={agent}
              fix={fixes[agent.agentId]}
              isRevoked={revoked.has(agent.agentId)}
              isSelected={agent.agentId === selectedAgentId}
              selectedShipmentId={agent.agentId === selectedAgentId ? selectedShipmentId : null}
              isDark={isDark}
              onSelectAgent={() => onSelectAgent(agent.agentId)}
              onSelectShipment={(shipmentId) => onSelectShipment(agent.agentId, shipmentId)}
            />
          ))
        )}
      </div>
    </div>
  );
}
