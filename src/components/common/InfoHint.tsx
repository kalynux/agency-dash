import type { ElementType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
  label,
  align = 'start',
  className,
}: {
  children: ReactNode;
  /** Accessible name for the trigger. Override when "more information" is vague. */
  label?: string;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  const { t } = useTranslation('common');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label ?? t('form.moreInformation')}
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
  const { t } = useTranslation('common');
  return (
    <CardHeader className={cn('max-md:px-0', className)}>
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
          {title}
          {description && short && (
            <InfoHint
              className="md:hidden"
              label={
                typeof title === 'string'
                  ? t('form.aboutSection', { title })
                  : t('form.moreInformation')
              }
            >
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

/**
 * A form field's label, with its helper text behind an ⓘ on mobile.
 *
 * The field-level half of `SectionHeading`'s bargain. A settings form on a
 * phone that carries a sentence under every input reads as a page of prose
 * with a few boxes in it; the label plus an ⓘ keeps the explanation one tap
 * away. Pair with {@link FieldHint} carrying the same text, which renders it
 * inline on desktop — where there is room — and nowhere on mobile.
 *
 * Only for *neutral* help. A warning, an error or a state the user has to act
 * on ("this number is not verified") stays visible at every width.
 */
export function FieldLabel({
  htmlFor,
  hint,
  children,
  className,
}: {
  htmlFor?: string;
  /** Mobile-only ⓘ content. Omit for a plain label. */
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation('common');
  return (
    <div className={cn('flex min-h-5 items-center gap-1.5', className)}>
      <Label htmlFor={htmlFor} className="leading-snug">
        {children}
      </Label>
      {hint && (
        <InfoHint
          className="md:hidden"
          label={typeof children === 'string' ? t('form.aboutSection', { title: children }) : undefined}
        >
          {hint}
        </InfoHint>
      )}
    </div>
  );
}

/** The desktop half of {@link FieldLabel}: inline helper text, hidden below `md`. */
export function FieldHint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('max-md:hidden text-xs text-muted-foreground', className)}>{children}</p>;
}

/**
 * The heading of a *block* inside a page — the small bold line above an inline
 * form or a listing, one step below `SectionHeading`.
 *
 * Same job as `SectionHeading`'s mobile/desktop split, applied where there is no
 * Card to hang a header off. Those blocks currently carry their explanation as a
 * `<p class="text-xs text-muted-foreground">` under the controls, which on a
 * phone is two more lines of prose between the user and the next thing they
 * came to do. Here the hint stays inline on desktop and moves behind the ⓘ on
 * mobile — the same bargain, so the two read as one system.
 *
 * `action` is for a control that belongs to the block rather than to the page:
 * a refresh, a "see all".
 */
export function BlockHeading({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  /** One sentence. Inline on desktop, behind the ⓘ on mobile. */
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation('common');
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          {title}
          {hint && (
            <InfoHint className="md:hidden" label={t('form.aboutSection', { title })}>
              {hint}
            </InfoHint>
          )}
        </p>
        {action}
      </div>
      {hint && <p className="max-md:hidden text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
