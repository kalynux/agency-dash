import type { ElementType, ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Tap-to-reveal help text, shown behind an ⓘ beside a label or heading.
 *
 * Built on Popover rather than Tooltip on purpose: `ui/tooltip.tsx` is a plain
 * Radix passthrough that opens on hover and focus only, so it never opens from
 * a tap — and a phone is exactly where this is used most. Popover opens on
 * click, portals out of any clipping ancestor, and handles collision with the
 * viewport edge itself.
 *
 * The icon is `Info`, not `AlertCircle`: the exclamation circle already means
 * "something is wrong" everywhere else in the dashboard (`state-views`,
 * `BillingTab`, `Overview`), and help is not an error.
 */
export function InfoHint({
  children,
  label = 'More information',
  align = 'start',
  className,
}: {
  children: ReactNode;
  /** Accessible name for the trigger. Override when "more information" is vague. */
  label?: string;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          // 32px hit area on a 24px footprint: the negative margin keeps the
          // icon from opening a gap in the label's rhythm while still clearing
          // the touch-target minimum.
          className={cn(
            'inline-flex h-8 w-8 -m-1 shrink-0 items-center justify-center rounded-full',
            'text-muted-foreground transition-colors hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        collisionPadding={12}
        className="w-[min(20rem,calc(100vw-2rem))] p-3 text-xs leading-relaxed text-muted-foreground"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The heading of a settings section — title, description and an optional
 * right-aligned action (a status badge, a refresh button).
 *
 * Its job is the mobile/desktop split on the description. Desktop has the room
 * for the full sentence and shows it inline. A phone does not: a three-line
 * paragraph under every heading is what pushes the actual controls below the
 * fold. So when `short` is given, mobile shows that one line instead and the
 * full text moves behind an ⓘ — nothing is thrown away, it is one tap further.
 *
 * Keep `short` to about five words, and make it name the thing rather than
 * explain it ("Regions you serve", not "The regions you serve and your
 * headquarters addresses"). Without `short`, the description renders as-is at
 * every width.
 */
export function SectionHeading({
  icon: Icon,
  title,
  description,
  short,
  action,
  className,
}: {
  icon?: ElementType;
  title: ReactNode;
  description?: ReactNode;
  /** Mobile stand-in for `description`; the full text moves behind the ⓘ. */
  short?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <CardHeader className={cn('max-md:px-0', className)}>
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
          {title}
          {description && short && (
            <InfoHint className="md:hidden" label={`About ${typeof title === 'string' ? title : 'this section'}`}>
              {description}
            </InfoHint>
          )}
        </CardTitle>
        {action}
      </div>
      {description && (
        <CardDescription className={cn(short && 'max-md:hidden')}>{description}</CardDescription>
      )}
      {short && <CardDescription className="md:hidden">{short}</CardDescription>}
    </CardHeader>
  );
}
