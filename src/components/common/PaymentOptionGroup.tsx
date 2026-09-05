import { useId } from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { PaymentBrandLogo, PaymentBrandStrip } from './PaymentBrandLogo';
import type { PaymentOption } from './payment-options';

export type { PaymentOption } from './payment-options';

/**
 * The one control every payment surface picks with — a channel ("card" vs
 * "mobile money"), an operator, a payout provider.
 *
 * It is a real radio group underneath (Radix), not a row of buttons, so arrow
 * keys move between options, Space selects, the group takes one tab stop, and a
 * screen reader announces "3 of 5". Getting that right by hand on a `<button>`
 * grid is exactly the sort of thing that quietly rots, so it isn't done by hand.
 *
 * Three layouts, same semantics:
 *  - `row`     — full-width cards with a description and a strip of accepted
 *                marks. The top-level choice, where the copy has to earn the tap.
 *  - `stacked` — the same card with the mark and the tick on their own top line
 *                and the copy underneath, so two sit abreast from `sm` up
 *                without the text being squeezed into a column.
 *  - `tile`    — a compact grid of logo-over-name tiles. The second choice, once
 *                the channel is settled and the brands speak for themselves.
 */

export interface PaymentOptionGroupProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: readonly PaymentOption[];
  layout?: 'row' | 'stacked' | 'tile';
  /**
   * Names the group. Rendered as its heading and wired as the accessible name —
   * always pass one; it is what a screen-reader user hears before the options.
   */
  label: string;
  /**
   * How the heading is set. `field` matches the form labels beside it;
   * `section` is the quieter uppercase rule a chooser sits under, for when the
   * group opens a form rather than being one field of it.
   */
  labelTone?: 'field' | 'section';
  /** Drop the visible heading (the surrounding form already says it). */
  hideLabel?: boolean;
  /** Note under the group — e.g. why two operators are greyed out. */
  description?: string;
  /** Tile columns from `sm` up. Phones always get two. */
  columns?: 2 | 3;
  /**
   * Classes for the option grid itself — `grid-cols-3` to hold a choice on one
   * row at every width, say. Separate from `className` because that one lands on
   * the labelled wrapper, which is the heading's box, not the grid's.
   */
  gridClassName?: string;
  className?: string;
}

const cardBase = cn(
  'group relative flex text-left transition-all duration-200 motion-reduce:transition-none',
  'rounded-xl border bg-card',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'disabled:cursor-not-allowed disabled:opacity-55',
  // Only a pointer that can hover gets the hover paint — on a phone it would
  // otherwise stick after the tap.
  '[@media(hover:hover)]:enabled:hover:border-primary/50 [@media(hover:hover)]:enabled:hover:bg-accent/40',
  'enabled:active:scale-[0.99] motion-reduce:enabled:active:scale-100',
  'data-[state=checked]:border-primary data-[state=checked]:bg-primary/[0.06]',
  'data-[state=checked]:ring-1 data-[state=checked]:ring-primary/25 data-[state=checked]:shadow-sm',
);

function Indicator() {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/35 transition-colors duration-200 motion-reduce:transition-none',
        'group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary',
      )}
    >
      <Check className="h-3 w-3 text-primary-foreground opacity-0 group-data-[state=checked]:opacity-100 group-data-[state=checked]:animate-pop" />
    </span>
  );
}

// `inline-block` so a preceding `space-y-*` can actually put a gap above it —
// vertical margin is dropped on a plain inline box.
function Badge({ children }: { children: string }) {
  return (
    <span className="inline-block rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * The option's leading mark — its own logo when it has one, otherwise its icon
 * on a plate.
 *
 * The plate is neutral until the option is picked, then fills with the accent:
 * a row of pre-tinted plates reads as several half-selected options, which is
 * the one thing a chooser must never suggest.
 */
function Visual({ option }: { option: PaymentOption }) {
  if (option.brand) return <PaymentBrandLogo brand={option.brand} size="lg" decorative />;
  if (!option.icon) return null;
  const Icon = option.icon;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors duration-200 motion-reduce:transition-none group-data-[state=checked]:bg-primary group-data-[state=checked]:text-primary-foreground">
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

export function PaymentOptionGroup({
  value,
  onValueChange,
  options,
  layout = 'row',
  label,
  labelTone = 'field',
  hideLabel = false,
  description,
  columns = 3,
  gridClassName,
  className,
}: PaymentOptionGroupProps) {
  const headingId = useId();
  const descriptionId = useId();
  // Both only exist in the labelled branch — never point at an element we skipped.
  const showHeading = !hideLabel;
  const showDescription = showHeading && !!description;

  const group = (
    <RadioGroupPrimitive.Root
      value={value ?? ''}
      onValueChange={onValueChange}
      // The visible heading *is* the group's name when there is one, so a screen
      // reader reads it once rather than hearing a duplicate aria-label.
      aria-label={showHeading ? undefined : label}
      aria-labelledby={showHeading ? headingId : undefined}
      aria-describedby={showDescription ? descriptionId : undefined}
      className={cn(
        layout === 'row'
          ? 'grid gap-2.5'
          : layout === 'stacked'
            // Two abreast at every width, so the whole choice is one glance —
            // that is the point of the layout. A lone card (no Stripe key, say)
            // keeps the full width rather than sitting half-empty beside a gap.
            ? cn('grid gap-2.5', options.length > 1 && 'grid-cols-2')
            : cn('grid grid-cols-2 gap-2', columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'),
        // With a heading the wrapper owns the caller's classes, not the grid.
        !showHeading && className,
        gridClassName,
      )}
    >
      {options.map((option) =>
        layout === 'row' ? (
          <RadioGroupPrimitive.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={cn(cardBase, 'min-h-[4.5rem] w-full items-center gap-3 p-3 sm:gap-4 sm:p-4')}
          >
            <Visual option={option} />

            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold leading-tight text-foreground group-data-[state=checked]:text-primary">
                  {option.label}
                </span>
                {option.badge && <Badge>{option.badge}</Badge>}
                {option.meta && (
                  <span className="text-[11px] font-medium text-muted-foreground">{option.meta}</span>
                )}
              </span>
              {option.description && (
                <span className="block text-xs leading-snug text-muted-foreground">
                  {option.description}
                </span>
              )}
              {/* The description already names these brands — announcing the strip
                  too would read the same list twice into the radio's name. */}
              {option.brands && option.brands.length > 0 && (
                <PaymentBrandStrip brands={option.brands} decorative className="pt-0.5" />
              )}
            </span>

            <Indicator />
          </RadioGroupPrimitive.Item>
        ) : layout === 'stacked' ? (
          <RadioGroupPrimitive.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={cn(cardBase, 'w-full flex-col items-start gap-2.5 p-3 sm:p-4')}
          >
            {/* The mark and the tick share the top line, so the copy below gets
                the card's whole width even when two cards sit abreast. The mark
                keeps its slot even when an option has none, so the tick stays
                pinned to the trailing edge either way. */}
            <span className="flex w-full items-center justify-between gap-2">
              <span className="shrink-0">
                <Visual option={option} />
              </span>
              <Indicator />
            </span>

            <span className="w-full min-w-0 space-y-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold leading-tight text-foreground group-data-[state=checked]:text-primary">
                  {option.label}
                </span>
                {option.badge && <Badge>{option.badge}</Badge>}
                {option.meta && (
                  <span className="text-[11px] font-medium text-muted-foreground">{option.meta}</span>
                )}
              </span>
              {option.description && (
                <span className="block text-xs leading-snug text-muted-foreground">
                  {option.description}
                </span>
              )}
              {/* No brand strip here, unlike a row: at half the width the marks
                  crowd out the copy that is doing the actual explaining. */}
              {option.footer && (
                <span className="flex flex-wrap items-center gap-1.5 pt-1">{option.footer}</span>
              )}
            </span>
          </RadioGroupPrimitive.Item>
        ) : (
          <RadioGroupPrimitive.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={cn(
              cardBase,
              'min-h-[5.75rem] flex-col items-center justify-center gap-2 p-3 text-center',
            )}
          >
            {/* The tick rides the corner here — a tile has no room for a column of its own. */}
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary opacity-0 transition-opacity duration-200 motion-reduce:transition-none group-data-[state=checked]:opacity-100 group-data-[state=checked]:animate-pop"
            >
              <Check className="h-2.5 w-2.5 text-primary-foreground" />
            </span>

            <Visual option={option} />

            <span className="w-full space-y-0.5">
              {/* Wrapped, not truncated: a tile is barely wider than its own logo
                  on a phone, and "Mobile Mon…" is worse than two short lines. */}
              <span className="line-clamp-2 block text-balance text-xs font-semibold leading-tight text-foreground group-data-[state=checked]:text-primary">
                {option.label}
              </span>
              {option.badge && <Badge>{option.badge}</Badge>}
            </span>
          </RadioGroupPrimitive.Item>
        ),
      )}
    </RadioGroupPrimitive.Root>
  );

  if (!showHeading) return group;

  return (
    <div className={cn('space-y-2', className)}>
      <p
        id={headingId}
        className={cn(
          'leading-none',
          labelTone === 'section'
            ? 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'
            : 'text-sm font-medium text-foreground',
        )}
      >
        {label}
      </p>
      {group}
      {showDescription && (
        <p id={descriptionId} className="text-xs leading-snug text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
