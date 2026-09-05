import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('vendors');
  return (
    <>
      <FilterSection label={t('filters.location')} description={t('filters.locationDescription')}>
        <div className="grid grid-cols-2 gap-3">
          <FilterField label={t('filters.city')} htmlFor="filter-city">
            <Input
              id="filter-city"
              placeholder={t('filters.cityPlaceholder')}
              value={filters.city}
              onChange={(e) => onChange('city', e.target.value)}
              className="h-10"
            />
          </FilterField>
          <FilterField label={t('filters.state')} htmlFor="filter-state">
            <Input
              id="filter-state"
              placeholder={t('filters.statePlaceholder')}
              value={filters.state}
              onChange={(e) => onChange('state', e.target.value)}
              className="h-10"
            />
          </FilterField>
        </div>
      </FilterSection>

      <FilterSection label={t('filters.orderPolicy')}>
        <div className="space-y-2">
          <FilterToggle
            icon={RotateCcw}
            label={t('filters.returnsAccepted')}
            description={t('filters.returnsAcceptedDescription')}
            checked={filters.returnEligible}
            onCheckedChange={(v) => onChange('returnEligible', v)}
          />
          <FilterToggle
            icon={XCircle}
            label={t('filters.cancellable')}
            description={t('filters.cancellableDescription')}
            checked={filters.cancellable}
            onCheckedChange={(v) => onChange('cancellable', v)}
          />
        </div>
      </FilterSection>
    </>
  );
}
