import { RotateCcw, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FilterField, FilterSection, FilterToggle } from '@/components/common/SearchFilterBar';
import type { VendorFilters } from '@/components/vendors/vendorFilters';

export interface VendorFiltersPanelProps {
  filters: VendorFilters;
  onChange: (key: keyof VendorFilters, value: string | boolean) => void;
}

/** Body of the vendor-browse filter sheet — see `SearchFilterBar`. */
export function VendorFiltersPanel({ filters, onChange }: VendorFiltersPanelProps) {
  return (
    <>
      <FilterSection label="Location" description="Matches the vendor's registered pickup area.">
        <div className="grid grid-cols-2 gap-3">
          <FilterField label="City" htmlFor="filter-city">
            <Input
              id="filter-city"
              placeholder="e.g. Douala"
              value={filters.city}
              onChange={(e) => onChange('city', e.target.value)}
              className="h-10"
            />
          </FilterField>
          <FilterField label="State" htmlFor="filter-state">
            <Input
              id="filter-state"
              placeholder="e.g. Littoral"
              value={filters.state}
              onChange={(e) => onChange('state', e.target.value)}
              className="h-10"
            />
          </FilterField>
        </div>
      </FilterSection>

      <FilterSection label="Order policy">
        <div className="space-y-2">
          <FilterToggle
            icon={RotateCcw}
            label="Returns accepted"
            description="The vendor takes goods back after delivery."
            checked={filters.returnEligible}
            onCheckedChange={(v) => onChange('returnEligible', v)}
          />
          <FilterToggle
            icon={XCircle}
            label="Cancellable"
            description="Orders can still be called off before pickup."
            checked={filters.cancellable}
            onCheckedChange={(v) => onChange('cancellable', v)}
          />
        </div>
      </FilterSection>
    </>
  );
}
