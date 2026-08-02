import { useState, type ElementType, type ReactNode } from 'react';
import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

/**
 * The one search-and-filter control every listing in the dashboard uses.
 *
 * A single row — a search field that takes the width, and a filter button beside
 * it — with every filter living in a bottom sheet behind that button instead of
 * spilling across the page as a row of selects. That keeps the top of every list
 * the same height and the same shape regardless of how many filters the surface
 * actually has, and gives phones the full width for the one control they use
 * most (search).
 *
 * Filters apply live: changing one inside the sheet refetches behind it, so the
 * sheet's footer button is a dismiss ("Show results"), never an "Apply" the user
 * must remember to press. `activeCount` is the number of filters away from their
 * default — it drives the badge on the button and the Reset affordance, so the
 * user can always tell a filtered list from an empty one.
 *
 * Compose the sheet's body from {@link FilterSection} + {@link FilterOptionGroup}
 * / {@link FilterToggle} / {@link FilterField} rather than dropping raw selects
 * in, so every filter sheet reads the same way.
 */

export interface SearchFilterBarProps {
  /** Current search text. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Filter controls for the bottom sheet. Without them the filter button is hidden. */
  children?: ReactNode;
  /** How many filters differ from their default — badge count and Reset gating. */
  activeCount?: number;
  /** Restores every filter to its default. Shown in the sheet while `activeCount > 0`. */
  onReset?: () => void;
  /** Sheet heading + sub-heading. */
  filterTitle?: string;
  filterDescription?: string;
  /** Rendered on the sheet's dismiss button ("Show 24 results") when provided. */
  resultCount?: number;
  /** What `resultCount` counts, singular ("shipment" → "Show 3 shipments"). */
  resultNoun?: string;
  /** Plural of `resultNoun` when adding an "s" doesn't work ("discrepancies"). */
  resultNounPlural?: string;
  /** Inline controls after the filter button — a view-mode toggle, a refresh, … */
  trailing?: ReactNode;
  /** A line of help under the row (e.g. a minimum-characters hint). */
  hint?: ReactNode;
  className?: string;
  /** Search box `aria-label`, when the placeholder alone reads oddly to a screen reader. */
  searchLabel?: string;
}

export function SearchFilterBar({
  value,
  onChange,
  placeholder = 'Search…',
  children,
  activeCount = 0,
  onReset,
  filterTitle = 'Filters',
  filterDescription,
  resultCount,
  resultNoun = 'result',
  resultNounPlural,
  trailing,
  hint,
  className,
  searchLabel,
}: SearchFilterBarProps) {
  const [open, setOpen] = useState(false);
  const hasFilters = Boolean(children);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={searchLabel ?? placeholder}
            className="h-11 rounded-xl pl-10 pr-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {hasFilters && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(true)}
            aria-label={activeCount > 0 ? `Filters (${activeCount} active)` : 'Filters'}
            aria-expanded={open}
            className={cn(
              'relative h-11 w-11 flex-shrink-0 rounded-xl p-0',
              activeCount > 0 && 'border-primary/60 bg-primary/5 text-primary hover:border-primary hover:bg-primary/10',
            )}
          >
            <SlidersHorizontal className="h-[1.15rem] w-[1.15rem]" />
            {activeCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground ring-2 ring-background">
                {activeCount}
              </span>
            )}
          </Button>
        )}

        {trailing}
      </div>

      {hint && <p className="px-1 text-xs text-muted-foreground">{hint}</p>}

      {hasFilters && (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="mx-auto max-w-2xl rounded-t-2xl">
            {/* `DrawerContent` already draws the grab handle above this row. */}
            <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-2">
              <div className="min-w-0 text-left">
                <DrawerTitle className="flex items-center gap-2 text-base">
                  {filterTitle}
                  {activeCount > 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {activeCount}
                    </span>
                  )}
                </DrawerTitle>
                <DrawerDescription className={cn('mt-0.5 text-xs', !filterDescription && 'sr-only')}>
                  {filterDescription ?? 'Narrow this list down.'}
                </DrawerDescription>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                {onReset && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onReset}
                    disabled={activeCount === 0}
                    className="h-8 gap-1.5 text-muted-foreground disabled:opacity-40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setOpen(false)}
                  aria-label="Close filters"
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain border-t px-5">
              {children}
            </div>

            <div className="border-t bg-background px-5 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3.5">
              <Button type="button" className="h-11 w-full rounded-xl" onClick={() => setOpen(false)}>
                {typeof resultCount === 'number'
                  ? `Show ${resultCount} ${
                      resultCount === 1 ? resultNoun : resultNounPlural ?? `${resultNoun}s`
                    }`
                  : 'Show results'}
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}

// ─── Sheet body primitives ────────────────────────────────────────────────────

/** One labelled group of filters. Siblings are separated by the sheet's dividers. */
export function FilterSection({
  label,
  description,
  children,
  className,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('py-4 first:pt-1 last:pb-2', className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {description && <p className="mt-1 text-xs text-muted-foreground/80">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  icon?: ElementType;
}

/**
 * Single-choice filter as a wrap of pills. Tap targets beat a nested dropdown
 * inside a sheet — every option is visible and one tap away, and the current
 * choice is readable without opening anything.
 */
export function FilterOptionGroup<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly FilterOption<T>[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
              active
                ? 'border-primary bg-primary font-medium text-primary-foreground shadow-sm'
                : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** A boolean filter as a full-width switch row. */
export function FilterToggle({
  label,
  description,
  icon: Icon,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  icon?: ElementType;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-3 transition-colors',
        checked ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-muted/50',
      )}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          {label}
        </span>
        {description && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="flex-shrink-0" />
    </label>
  );
}

/** A labelled slot for a free-form control (text input, date, …) inside a section. */
export function FilterField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
