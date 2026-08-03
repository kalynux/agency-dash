import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bike, Car, Truck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  FilterField,
  FilterOptionGroup,
  FilterSection,
  type FilterOption,
} from '@/components/common/SearchFilterBar';
import type { AgentFilters } from '@/components/agents/agentFilters';

export interface AgentFiltersPanelProps {
  filters: AgentFilters;
  onChange: <K extends keyof AgentFilters>(key: K, value: AgentFilters[K]) => void;
}

/** Body of the agent-browse filter sheet — see `SearchFilterBar`. */
export function AgentFiltersPanel({ filters, onChange }: AgentFiltersPanelProps) {
  const { t } = useTranslation('agents');

  // Built inside the component, not at module scope: a module constant would
  // freeze its labels in whatever language was active at import.
  const vehicleOptions = useMemo<FilterOption<AgentFilters['vehicleType']>[]>(
    () => [
      { value: '', label: t('vehicle.any') },
      { value: 'bike', label: t('vehicle.bike'), icon: Bike },
      { value: 'car', label: t('vehicle.car'), icon: Car },
      { value: 'van', label: t('vehicle.van'), icon: Truck },
      { value: 'truck', label: t('vehicle.truck'), icon: Truck },
    ],
    [t],
  );

  const availabilityOptions = useMemo<FilterOption<AgentFilters['availability']>[]>(
    () => [
      { value: '', label: t('availability.any') },
      { value: 'online', label: t('availability.online') },
      { value: 'on_break', label: t('availability.on_break') },
      { value: 'offline', label: t('availability.offline') },
    ],
    [t],
  );

  const sortOptions = useMemo<FilterOption<AgentFilters['sort']>[]>(
    () => [
      { value: 'trust', label: t('filters.sortTrust') },
      { value: 'name', label: t('filters.sortName') },
    ],
    [t],
  );

  return (
    <>
      <FilterSection label={t('filters.vehicle')}>
        <FilterOptionGroup
          value={filters.vehicleType}
          onChange={(v) => onChange('vehicleType', v)}
          options={vehicleOptions}
        />
      </FilterSection>

      <FilterSection
        label={t('filters.availability')}
        description={t('filters.availabilityDescription')}
      >
        <FilterOptionGroup
          value={filters.availability}
          onChange={(v) => onChange('availability', v)}
          options={availabilityOptions}
        />
      </FilterSection>

      <FilterSection label={t('filters.trust')} description={t('filters.trustDescription')}>
        <FilterField label={t('filters.minTrust')} htmlFor="filter-min-trust">
          <Input
            id="filter-min-trust"
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            placeholder={t('filters.minTrustPlaceholder')}
            value={filters.minTrustScore}
            onChange={(e) => onChange('minTrustScore', e.target.value)}
            className="h-10"
          />
        </FilterField>
      </FilterSection>

      <FilterSection label={t('filters.sortBy')}>
        <FilterOptionGroup value={filters.sort} onChange={(v) => onChange('sort', v)} options={sortOptions} />
      </FilterSection>
    </>
  );
}
