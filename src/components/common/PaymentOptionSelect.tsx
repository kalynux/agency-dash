import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { PaymentBrandLogo } from './PaymentBrandLogo';
import type { PaymentOption } from './payment-options';

/**
 * The same options `PaymentOptionGroup` renders, as a dropdown: one line showing
 * the chosen mark and name, opening a list of logo + name rows.
 *
 * The list is a popover anchored to the trigger on desktop and a bottom sheet on
 * a phone, where an anchored menu would sit under the thumb and clip against the
 * keyboard. Use the group where the choice *is* the screen (onboarding), and
 * this where it is one field among several — a grid of operator tiles above a
 * phone number pushes the rest of the form off the fold for a pick that is
 * usually already correct.
 *
 * Options that are shown but not selectable stay in the list, greyed and
 * badged: hiding them reads as "we don't support your wallet", which is the
 * wrong message — they work for payouts today, just not for charges.
 */

export interface PaymentOptionSelectProps {
  /**
   * Required: the trigger borrows this id to name itself, so the label above it
   * can point at the control without swallowing the selection from the
   * accessible name.
   */
  id: string;
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: readonly PaymentOption[];
  /** Names the field. Rendered above the trigger, and titles the mobile sheet. */
  label: string;
  /** Shown on the trigger while nothing is picked. */
  placeholder: string;
  /** Note at the foot of the list — e.g. why two operators are greyed out. */
  note?: string;
  disabled?: boolean;
  /** Draws the error outline and flags the control for assistive tech. */
  invalid?: boolean;
  /** Applied to the wrapper (label + trigger), matching `PaymentOptionGroup`. */
  className?: string;
}

export function PaymentOptionSelect({
  id,
  value,
  onValueChange,
  options,
  label,
  placeholder,
  note,
  disabled = false,
  invalid = false,
  className,
}: PaymentOptionSelectProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const labelId = `${id}-label`;
  const listId = `${id}-listbox`;
  const selected = options.find((o) => o.value === value);

  const triggerProps = {
    id,
    type: 'button' as const,
    disabled,
    role: 'combobox',
    // Overrides the `dialog` Radix's PopoverTrigger would otherwise assert.
    'aria-haspopup': 'listbox' as const,
    'aria-expanded': open,
    'aria-controls': listId,
    'aria-invalid': invalid || undefined,
    // Both the field label and the trigger's own text, so the control is
    // announced as "Operator, MTN Mobile Money" rather than one or the other.
    'aria-labelledby': `${labelId} ${id}`,
    // Matches the dashboard's inputs exactly — this field sits beside one.
    className: cn(
      'flex h-10 w-full items-center gap-2.5 rounded-lg border px-3 text-left text-sm',
      'border-input bg-transparent shadow-xs outline-none dark:bg-input/30',
      'transition-[color,box-shadow,border-color]',
      '[@media(hover:hover)]:enabled:hover:border-input/70',
      'focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      invalid && 'border-destructive ring-destructive/20 dark:ring-destructive/40',
    ),
  };

  const triggerBody = (
    <>
      {selected ? (
        <>
          <OptionMark option={selected} />
          <span className="min-w-0 flex-1 truncate font-medium">{selected.label}</span>
        </>
      ) : (
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{placeholder}</span>
      )}
      <ChevronDown
        aria-hidden="true"
        className={cn(
          'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
          open && 'rotate-180',
        )}
      />
    </>
  );

  const list = (
    <div id={listId} role="listbox" aria-labelledby={labelId} className="space-y-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={active}
            disabled={option.disabled}
            onClick={() => {
              onValueChange(option.value);
              setOpen(false);
            }}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-2.5 text-left transition-colors',
              // Comfortably above the 44px touch target in the sheet; tighter in
              // the popover, where it is pointer-driven.
              isMobile ? 'min-h-14 py-2.5' : 'min-h-11 py-2',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'enabled:focus-visible:bg-accent [@media(hover:hover)]:enabled:hover:bg-accent',
              active && 'bg-primary/5',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <OptionMark option={option} />
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-sm',
                active ? 'font-semibold text-primary' : 'font-medium text-foreground',
              )}
            >
              {option.label}
            </span>
            {option.badge && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {option.badge}
              </span>
            )}
            {active && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        );
      })}

      {note && <p className="px-2.5 pt-2 text-xs leading-snug text-muted-foreground">{note}</p>}
    </div>
  );

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label id={labelId} htmlFor={id}>
        {label}
      </Label>

      {isMobile ? (
        <>
          <button {...triggerProps} onClick={() => setOpen(true)}>
            {triggerBody}
          </button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent
              side="bottom"
              // The title names the sheet; Radix only warns when neither a
              // description nor this opt-out is present.
              aria-describedby={undefined}
              className="max-h-[80dvh] gap-0 rounded-t-2xl p-0"
            >
              {/* Grab handle — signals the sheet is dismissable by swipe/tap-away. */}
              <div className="flex shrink-0 justify-center pt-2.5">
                <span className="h-1.5 w-10 rounded-full bg-muted-foreground/25" />
              </div>
              <SheetHeader className="shrink-0 border-b p-4 pb-3 pr-14 pt-2">
                <SheetTitle className="text-base">{label}</SheetTitle>
              </SheetHeader>
              {/* `min-h-0` or the list refuses to shrink inside the flex column
                  and the sheet grows past its own max height instead of scrolling. */}
              <div className="min-h-0 overflow-y-auto px-2 py-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                {list}
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger {...triggerProps}>{triggerBody}</PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={6}
            // Matches the trigger so the list reads as an extension of the field
            // rather than a floating menu.
            className="max-h-72 w-[var(--radix-popover-trigger-width)] overflow-y-auto p-1.5"
          >
            {list}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/** The row's leading mark — the brand's own logo, or its icon on a plate. */
function OptionMark({ option }: { option: PaymentOption }) {
  if (option.brand) return <PaymentBrandLogo brand={option.brand} size="sm" decorative />;
  if (!option.icon) return null;
  const Icon = option.icon;
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}
