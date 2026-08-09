/**
 * Picking regions from the country's catalogue.
 *
 * ONE CATALOGUE, THREE CALLERS. The magazin's own `coverage_areas` (Account →
 * Locations and onboarding) and an agent contract's `coverage.regions` are now
 * validated against the same `locations.json` regions of the agency's country, so
 * they get the same control — a region typed as free text is a `400` on either
 * path, and two differently-shaped pickers would make that inconsistency look
 * deliberate.
 *
 * The contract caller needs three things the other two don't, and all three are
 * additive props rather than a second component: marking the agency's OWN
 * declared coverage, an "all regions" empty state, and legacy free-text values
 * rendered as removable chips.
 *
 * It deliberately reads no store. `Step1Logistics` renders during onboarding,
 * outside `MagazinProvider`, so `country` and `highlightKeys` are passed in.
 *
 * See api-doc/agency/agent-roster.md ("Coverage regions are PICKED, not typed")
 * and api-doc/agency/magazin.md.
 */

import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { regionsFor, type RegionEntry } from '@/lib/regions';
import { cn } from '@/lib/utils';

export interface RegionPickerProps {
  /** Selected region KEYS. `[]` is a legitimate state — see `emptyHint`. */
  value: string[];
  onChange: (next: string[]) => void;
  /**
   * ISO-2 country. `null`/unknown yields an empty catalogue, which callers must
   * treat as "no picker" rather than falling back to a default country.
   */
  country: string | null | undefined;
  disabled?: boolean;
  /**
   * Overrides the catalogue. The repair path for
   * `400 CONTRACT_COVERAGE_REGION_INVALID`, whose `details.allowedRegions` is the
   * server's full list — so a picker built from a stale country can be fixed from
   * the error itself, without a second request.
   */
  options?: RegionEntry[];
  /**
   * Regions to mark as ones we already serve. MARKS, NEVER DISABLES: a contract
   * may legitimately name a region the agency is expanding into but has not
   * declared yet, so the others stay selectable.
   */
  highlightKeys?: string[];
  highlightLabel?: string;
  /**
   * Selected values that are not in the catalogue — legacy free text like
   * `"Douala"`. Rendered as removable chips rather than dropped, so the agency
   * sees what is about to stop being valid instead of watching it vanish.
   */
  unknownValues?: string[];
  onRemoveUnknown?: (value: string) => void;
  /** What an empty selection MEANS. On a contract that is "all regions", not "none". */
  emptyHint?: ReactNode;
  /** Shown when the catalogue is empty (unknown country). */
  noRegionsLabel?: string;
  className?: string;
}

export function RegionPicker({
  value,
  onChange,
  country,
  disabled,
  options,
  highlightKeys,
  highlightLabel,
  unknownValues,
  onRemoveUnknown,
  emptyHint,
  noRegionsLabel,
  className,
}: RegionPickerProps) {
  const { t, i18n } = useTranslation('common');
  const regions = useMemo(
    () => options ?? regionsFor(country, i18n.language),
    [options, country, i18n.language],
  );

  const toggle = (key: string, checked: boolean) => {
    onChange(checked ? [...value, key] : value.filter((r) => r !== key));
  };

  if (regions.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        {noRegionsLabel ?? t('values.notAvailable')}
      </p>
    );
  }

  const highlighted = new Set(highlightKeys ?? []);

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {regions.map(({ key, label }) => (
          <label
            key={key}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <Checkbox
              checked={value.includes(key)}
              disabled={disabled}
              onCheckedChange={(c) => toggle(key, !!c)}
            />
            <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
            {highlighted.has(key) && highlightLabel && (
              <span
                title={highlightLabel}
                className="flex-shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              >
                {highlightLabel}
              </span>
            )}
          </label>
        ))}
      </div>

      {unknownValues && unknownValues.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {unknownValues.map((raw) => (
            <Badge
              key={raw}
              variant="outline"
              className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
            >
              {raw}
              {onRemoveUnknown && !disabled && (
                <button
                  type="button"
                  onClick={() => onRemoveUnknown(raw)}
                  className="rounded-full transition-opacity hover:opacity-70"
                  aria-label={t('actions.remove')}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {value.length === 0 && (!unknownValues || unknownValues.length === 0) && emptyHint && (
        <p className="mt-2 text-xs text-muted-foreground">{emptyHint}</p>
      )}
    </div>
  );
}
