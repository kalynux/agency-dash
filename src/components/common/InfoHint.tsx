import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Tap-to-reveal help text, shown behind an ⓘ beside a label or heading.
 *
 * The icon is `Info`, not `AlertCircle`: the exclamation circle already means
 * "something is wrong" everywhere else in the dashboard (`state-views`,
 * `BillingTab`, `Overview`), and help is not an error.
 *
 * A TOOLTIP ON DESKTOP, A BOTTOM SHEET ON A PHONE (2026-10-05). For two days it
 * was a sheet at every width, and on a monitor that read as a whole panel
 * sliding up for two sentences. On desktop it is now an anchored popover that
 * opens on hover *and* on press (a press pins it until an outside press or Esc),
 * so it behaves like a tooltip without being one — Radix's Tooltip never opens
 * on touch or click, and this content is sometimes the whole explanation of a
 * figure. Below `md` it stays a real `Sheet` (a modal Radix dialog), so it nests
 * cleanly inside the other sheets it lives in and a press on the dimmed
 * backdrop closes it the same way it closes every other sheet.
 *
 * Safe inside a tappable row or card: presses on the trigger and inside the
 * sheet stop at the wrapper. React bubbles events from a portal through the
 * component tree, so without it, reading a hint would also open the row.
 */
export function InfoHint({
  children,
  label,
  title,
  align = 'center',
  className,
}: {
  children: ReactNode;
  /** Accessible name for the trigger. Override when "more information" is vague. */
  label?: string;
  /** Heading for the explanation — what the ⓘ is about. */
  title?: ReactNode;
  /** Desktop popover alignment against the icon. Ignored by the phone sheet. */
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  const { t } = useTranslation('common');
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  // Desktop only: `hover` opened it, `press` pinned it. A pinned hint ignores
  // the pointer leaving — the user asked for it and may be reading.
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const heading = title ?? label ?? t('form.moreInformation');

  const trigger = (
    <button
      type="button"
      aria-label={label ?? t('form.moreInformation')}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => {
        if (isMobile) {
          setOpen(true);
          return;
        }
        // A press on an already-pinned hint closes it; otherwise it pins.
        const next = !(open && pinned);
        setPinned(next);
        setOpen(next);
      }}
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
  );

  if (!isMobile) {
    const hoverOpen = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      window.clearTimeout(closeTimer.current);
      setOpen(true);
    };
    const hoverClose = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || pinned) return;
      window.clearTimeout(closeTimer.current);
      closeTimer.current = window.setTimeout(() => setOpen(false), 150);
    };
    return (
      <span
        className="contents"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setPinned(false);
          }}
        >
          <PopoverAnchor asChild>
            <span
              ref={anchorRef}
              className="inline-flex"
              onPointerEnter={hoverOpen}
              onPointerLeave={hoverClose}
            >
              {trigger}
            </span>
          </PopoverAnchor>
          <PopoverContent
            side="top"
            align={align}
            sideOffset={6}
            collisionPadding={12}
            // Hover-opened hints must not steal focus from whatever the user
            // is typing in; a pinned one still traps nothing (popover is
            // non-modal), Esc and an outside press close it.
            onOpenAutoFocus={(e) => e.preventDefault()}
            // The icon is an anchor, not a Radix trigger, so a press on it
            // counts as "outside" — let the button's own toggle decide instead
            // of closing here and reopening on the click that follows.
            onInteractOutside={(e) => {
              if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
            }}
            onPointerEnter={hoverOpen}
            onPointerLeave={hoverClose}
            onClick={(e) => e.stopPropagation()}
            className="w-auto max-w-xs space-y-1 px-3 py-2.5 text-xs leading-relaxed"
          >
            <p className="text-sm font-semibold text-foreground">{heading}</p>
            <div className="text-foreground/80">{children}</div>
          </PopoverContent>
        </Popover>
      </span>
    );
  }

  return (
    <span
      className="contents"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {trigger}
      <Sheet open={open} onOpenChange={setOpen}>
        {/* `h-auto` so a two-line hint is a two-line sheet; `sm:max-w-lg` +
            `mx-auto` keeps it a readable column on a wide screen instead of a
            strip across the whole monitor. */}
        <SheetContent
          side="bottom"
          className="mx-auto flex h-auto max-h-[75dvh] w-full flex-col gap-0 rounded-t-2xl p-0 sm:max-w-lg sm:border-x"
        >
          <div aria-hidden className="flex shrink-0 justify-center pb-1 pt-2.5">
            <span className="h-1 w-9 rounded-full bg-muted-foreground/30" />
          </div>
          {/* `pe-12` clears the panel's own close button. */}
          <SheetHeader className="shrink-0 px-5 pb-2 pt-1 pe-12 text-start">
            <SheetTitle className="text-base">{heading}</SheetTitle>
          </SheetHeader>
          <SheetDescription asChild>
            <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-sm leading-relaxed text-foreground/80">
              {children}
            </div>
          </SheetDescription>
        </SheetContent>
      </Sheet>
    </span>
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
 *
 * On a phone the `short` line itself is no longer printed (2026-09-29, the same
 * rule as the vendor dashboard): a subtitle under every heading restated the
 * title and was most of what made these forms read as a wall of text. `short`
 * still decides that the description moves behind the ⓘ there. `icon` is
 * accepted for existing call sites but not drawn — an icon beside every
 * heading read as decoration.
 */
export function SectionHeading({
  title,
  description,
  short,
  action,
  className,
}: {
  /** @deprecated Not drawn — see above. */
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
          {title}
          {description && short && (
            <InfoHint
              className="md:hidden"
              title={title}
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
          title={children}
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
            <InfoHint className="md:hidden" title={title} label={t('form.aboutSection', { title })}>
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
