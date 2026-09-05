import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  selectTriggerClassName,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/**
 * A row in the list.
 *
 * `description` is the supporting fact that makes the choice obvious — what an
 * agent is holding, what a method costs. It reads as a muted suffix in the
 * desktop dropdown, where there is one line, and as a proper second line in the
 * mobile sheet, where there is room. Either way the closed trigger shows only
 * `label`, because the trigger is a summary and not a row.
 */
export interface ResponsiveSelectOption<T extends string = string> {
  value: T;
  label: string;
  /** Supporting detail: inline and muted on desktop, a second line on mobile. */
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface ResponsiveSelectProps<T extends string = string> {
  value: T | '';
  onValueChange: (value: T) => void;
  options: readonly ResponsiveSelectOption<T>[];
  placeholder?: string;
  /** Sheet header on mobile. Falls back to `placeholder`. */
  title?: string;
  /**
   * Show a filter box above the list. `'auto'` (the default) turns it on once
   * the list is long enough to need scrolling on a phone.
   */
  searchable?: boolean | 'auto';
  disabled?: boolean;
  /** Trigger label override — for when the closed control shows less than the row does. */
  renderValue?: (option: ResponsiveSelectOption<T>) => ReactNode;
  id?: string;
  name?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  className?: string;
  size?: 'sm' | 'default';
}

/** Above this many options the sheet gets a filter box under `searchable: 'auto'`. */
const SEARCH_THRESHOLD = 8;

/**
 * A select that is a dropdown on desktop and a bottom sheet on a phone.
 *
 * **Why swap the whole control rather than restyle the popover.** A Radix
 * `Select` positions its content against the trigger and sizes it to the space
 * left on screen. On a phone that lands a 200px scroll box over the middle of
 * the viewport, often under the thumb that opened it and sometimes under the
 * keyboard — and the items inside it are sized for a mouse. Forcing that
 * popover to the bottom edge with CSS fights the positioning engine for a
 * result that still has dropdown-sized hit targets. A sheet is the native idiom,
 * it has room for a second line per option, and its rows are a full tap target
 * wide. Same reasoning, and the same two-separate-roots shape, as
 * `ResponsiveModal`.
 *
 * The closed control is identical either way — both wear
 * `selectTriggerClassName` — so nothing moves when the viewport crosses the
 * breakpoint.
 *
 * Data-driven rather than compound (`<SelectItem>` children) on purpose: the two
 * branches render the same options in two quite different shapes, and a list of
 * objects is the only description of "the options" that both can consume.
 */
export function ResponsiveSelect<T extends string = string>({
  value,
  onValueChange,
  options,
  placeholder,
  title,
  searchable = 'auto',
  disabled,
  renderValue,
  id,
  name,
  className,
  size = 'default',
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: ResponsiveSelectProps<T>) {
  const { t } = useTranslation('common');
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);

  // Desktop keeps the Radix Select: on a pointer device the dropdown IS the
  // right control, and it brings typeahead and roving focus for free.
  if (!isMobile) {
    return (
      <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled} name={name}>
        <SelectTrigger
          id={id}
          size={size}
          className={className}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
        >
          <SelectValue placeholder={placeholder}>
            {selected ? (renderValue?.(selected) ?? selected.label) : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
              {o.icon}
              {o.label}
              {o.description && (
                <span className="text-muted-foreground">{o.description}</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const showSearch =
    searchable === true || (searchable === 'auto' && options.length > SEARCH_THRESHOLD);

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? options.filter((o) =>
        `${o.label} ${o.description ?? ''}`.toLowerCase().includes(needle),
      )
    : options;

  const close = () => {
    setOpen(false);
    // Cleared on close, not on open: leaving it behind means reopening the
    // sheet shows yesterday's filter with no visible cause.
    setQuery('');
  };

  return (
    <>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen(true)}
        data-slot="select-trigger"
        data-size={size}
        // Radix sets this attribute itself; the styling above keys off it to
        // grey out an unfilled control, so the hand-rolled trigger has to too.
        data-placeholder={selected ? undefined : ''}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className={cn(selectTriggerClassName, 'text-start', className)}
      >
        <span data-slot="select-value" className="min-w-0 truncate">
          {selected ? (renderValue?.(selected) ?? selected.label) : placeholder}
        </span>
        <ChevronDown className="size-4 opacity-50" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <SheetContent
          side="bottom"
          // `h-auto` so a three-option list is a three-option sheet rather than
          // most of the screen; the cap is what makes a long one scroll.
          className="flex h-auto max-h-[85dvh] flex-col gap-0 rounded-t-2xl p-0"
        >
          {/* `pe-10` clears the panel's own close button. */}
          <SheetHeader className="shrink-0 border-b p-4 pe-10 text-start">
            <SheetTitle className="text-base">{title ?? placeholder ?? ariaLabel}</SheetTitle>
          </SheetHeader>

          {showSearch && (
            <div className="relative shrink-0 border-b p-3">
              <Search
                className="pointer-events-none absolute start-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('actions.search')}
                aria-label={t('actions.search')}
                className="ps-9"
                // No autofocus: raising the keyboard would eat the list the
                // user came here to look at. They tap the box if they want it.
                autoFocus={false}
              />
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {visible.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {t('states.noResults')}
              </p>
            ) : (
              <ul className="divide-y">
                {visible.map((o) => {
                  const isSelected = o.value === value;
                  return (
                    <li key={o.value}>
                      <button
                        type="button"
                        disabled={o.disabled}
                        onClick={() => {
                          onValueChange(o.value);
                          close();
                        }}
                        // min-h-14: a comfortable thumb target, taller than the
                        // 44px floor because these rows are the whole point of
                        // the sheet.
                        className={cn(
                          'flex min-h-14 w-full items-center gap-3 px-4 py-3 text-start transition-colors',
                          'hover:bg-muted/60 active:bg-muted disabled:opacity-50',
                          isSelected && 'bg-primary/5',
                        )}
                      >
                        {o.icon && <span className="shrink-0">{o.icon}</span>}
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate', isSelected && 'font-medium')}>
                            {o.label}
                          </span>
                          {o.description && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {o.description}
                            </span>
                          )}
                        </span>
                        {isSelected && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
