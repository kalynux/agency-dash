import { RotateCcw, X, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { VendorFilters } from '@/components/vendors/vendorFilters';

export interface VendorFiltersPanelProps {
  filters: VendorFilters;
  onChange: (key: keyof VendorFilters, value: string | boolean) => void;
  onClear: () => void;
}

export function VendorFiltersPanel({ filters, onChange, onClear }: VendorFiltersPanelProps) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="filter-city" className="text-xs">City</Label>
          <Input
            id="filter-city"
            placeholder="e.g. Douala"
            value={filters.city}
            onChange={(e) => onChange('city', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-state" className="text-xs">State</Label>
          <Input
            id="filter-state"
            placeholder="e.g. Littoral"
            value={filters.state}
            onChange={(e) => onChange('state', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-5">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            id="filter-return-eligible"
            checked={filters.returnEligible}
            onCheckedChange={(v) => onChange('returnEligible', !!v)}
          />
          <span className="text-xs flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Returns accepted
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            id="filter-cancellable"
            checked={filters.cancellable}
            onCheckedChange={(v) => onChange('cancellable', !!v)}
          />
          <span className="text-xs flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Cancellable
          </span>
        </label>
      </div>

      <button
        type="button"
        onClick={onClear}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
      >
        <X className="w-3 h-3" />
        Clear filters
      </button>
    </div>
  );
}
