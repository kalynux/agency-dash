import { Bike, Car, Truck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  FilterField,
  FilterOptionGroup,
  FilterSection,
  type FilterOption,
} from '@/components/common/SearchFilterBar';
import type { AgentFilters } from '@/components/agents/agentFilters';

const VEHICLE_OPTIONS: FilterOption<AgentFilters['vehicleType']>[] = [
  { value: '', label: 'Any' },
  { value: 'bike', label: 'Bike', icon: Bike },
  { value: 'car', label: 'Car', icon: Car },
  { value: 'van', label: 'Van', icon: Truck },
  { value: 'truck', label: 'Truck', icon: Truck },
];

const AVAILABILITY_OPTIONS: FilterOption<AgentFilters['availability']>[] = [
  { value: '', label: 'Any' },
  { value: 'online', label: 'Online' },
  { value: 'on_break', label: 'On break' },
  { value: 'offline', label: 'Offline' },
];

const SORT_OPTIONS: FilterOption<AgentFilters['sort']>[] = [
  { value: 'trust', label: 'Highest trust' },
  { value: 'name', label: 'Name A–Z' },
];

export interface AgentFiltersPanelProps {
  filters: AgentFilters;
  onChange: <K extends keyof AgentFilters>(key: K, value: AgentFilters[K]) => void;
}

/** Body of the agent-browse filter sheet — see `SearchFilterBar`. */
export function AgentFiltersPanel({ filters, onChange }: AgentFiltersPanelProps) {
  return (
    <>
      <FilterSection label="Vehicle">
        <FilterOptionGroup
          value={filters.vehicleType}
          onChange={(v) => onChange('vehicleType', v)}
          options={VEHICLE_OPTIONS}
        />
      </FilterSection>

      <FilterSection
        label="Availability"
        description="What the agent wants right now — not how loaded they are."
      >
        <FilterOptionGroup
          value={filters.availability}
          onChange={(v) => onChange('availability', v)}
          options={AVAILABILITY_OPTIONS}
        />
      </FilterSection>

      <FilterSection label="Trust" description="Composite 0–100 score from their delivery record.">
        <FilterField label="Minimum trust score" htmlFor="filter-min-trust">
          <Input
            id="filter-min-trust"
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            placeholder="e.g. 80"
            value={filters.minTrustScore}
            onChange={(e) => onChange('minTrustScore', e.target.value)}
            className="h-10"
          />
        </FilterField>
      </FilterSection>

      <FilterSection label="Sort by">
        <FilterOptionGroup value={filters.sort} onChange={(v) => onChange('sort', v)} options={SORT_OPTIONS} />
      </FilterSection>
    </>
  );
}
