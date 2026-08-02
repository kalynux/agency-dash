import type { ReactNode } from 'react';
import { InfoHint } from '@/components/common/InfoHint';
import { cn } from '@/lib/utils';

/**
 * Page-level layout primitives shared by every dashboard route.
 *
 * `PageHeader` fixes the title → description → actions rhythm in one place so
 * every page reads with the same cadence: title and its description sit tight
 * together (a single group), page actions align to the baseline on wide screens
 * and stack below on narrow ones. It intentionally has no eyebrow/kicker — the
 * title carries its own weight.
 *
 * `PageSection` gives a labelled block a consistent header-to-content gap when a
 * page needs internal sections; use it instead of one-off margins.
 *
 * `listSurfaceClass` and `sectionSurfaceClass` carry the mobile density rules —
 * see their own comments. The search/filter row above a listing is
 * `SearchFilterBar` (`@/components/common/SearchFilterBar`), not a layout
 * primitive.
 */

interface PageHeaderProps {
  title: string;
  description?: string;
  /**
   * Mobile stand-in for `description` — about five words. When set, the full
   * description moves behind an ⓘ beside the title on phones, where a
   * two-line paragraph costs more than it explains. See `SectionHeading`.
   */
  shortDescription?: string;
  /** Right-aligned actions (buttons, filters). Stack below the title on mobile. */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  shortDescription,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="flex items-center gap-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
          {description && shortDescription && (
            <InfoHint className="md:hidden" label={`About ${title}`}>
              {description}
            </InfoHint>
          )}
        </h1>
        {description && (
          <p className={cn('max-w-2xl text-muted-foreground', shortDescription && 'max-md:hidden')}>
            {description}
          </p>
        )}
        {shortDescription && (
          <p className="text-muted-foreground md:hidden">{shortDescription}</p>
        )}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

interface PageSectionProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageSection({ title, description, actions, children, className }: PageSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      {(title || actions) && (
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Mobile-flush listing surface, applied to the `<Card>` that wraps a list or a
 * table.
 *
 * Inside the phone gutter, a bordered card whose rows carry their own padding
 * wastes ~32px on each side and squeezes every row's content. Below `md` (the
 * app's mobile shell — see `useIsMobile`) this drops the card chrome (side
 * border, radius, shadow, vertical padding) and pulls the block out through the
 * gutter, so rows read edge-to-edge and are told apart by their own divider
 * lines instead of by a frame. From `md:` up it is an ordinary Card again.
 *
 * The negative margins mirror the page gutter in `CONTENT_FRAME` (App.tsx);
 * keep them in sync. Pair with `<CardContent className="p-0">`.
 */
export const listSurfaceClass =
  '-mx-4 rounded-none border-x-0 py-0 shadow-none sm:-mx-6 md:mx-0 md:rounded-xl md:border-x md:py-6 md:shadow-sm';

/**
 * Mobile-flush *section* surface, applied to the `<Card>` that wraps one block
 * of a settings screen.
 *
 * `listSurfaceClass` full-bleeds a list through the gutter; this does the
 * opposite job for a block of prose and form fields. A card's frame — border,
 * radius, shadow and `px-6` on both sides — costs ~56px of a 360px screen on
 * top of the page's own gutter, so the content it exists to present ends up
 * squeezed into the middle. Below `md` the card is dropped entirely: the block
 * becomes a plain part of the page, told apart from its neighbour by a single
 * rule (see `sectionGroupClass`) rather than by a frame. From `md:` up it is an
 * ordinary Card again.
 *
 * Pair with `max-md:px-0` on `CardHeader` / `CardContent`.
 *
 * `bg-transparent` is load-bearing: without it `cn`'s merge keeps the base
 * `bg-card` and the section renders as a white block on the near-white page.
 * `md:border-border/70` is deliberately absent — border *colour* and border
 * *width* are separate merge groups, so the base colour survives `border-0`.
 */
export const sectionSurfaceClass =
  'rounded-none border-0 bg-transparent py-0 gap-4 shadow-none ' +
  'md:rounded-xl md:border md:bg-card md:py-6 md:gap-6 md:shadow-sm';

/**
 * Wrapper for a run of `sectionSurfaceClass` sections. On mobile, consecutive
 * de-carded sections are separated by one hairline instead of by two frames.
 *
 * The rule is emitted only under `max-md:` on purpose. A `md:…:border-t-0`
 * reset would out-specify the Card's own `md:border` / `md:py-6` — (0,3,0)
 * against (0,1,0) — and would strip the top border and the 24px top padding
 * from every card but the first on desktop.
 *
 * It matches `[data-slot=card]` rather than `*` so it cannot paint on a sibling
 * that isn't a section: notably `UnsavedChangesBar`, whose root is a
 * viewport-wide `position: fixed` box that would carry the rule straight across
 * the screen.
 *
 * INVARIANT: keep any error alert as the FIRST child of the group. A non-Card
 * between two Cards breaks the adjacency chain and loses a rule.
 */
export const sectionGroupClass =
  'space-y-6 ' +
  'max-md:[&>[data-slot=card]+[data-slot=card]]:border-t ' +
  'max-md:[&>[data-slot=card]+[data-slot=card]]:border-border/70 ' +
  'max-md:[&>[data-slot=card]+[data-slot=card]]:pt-6';

/**
 * Opens a new mobile section on a block the group selector can't reach — a
 * plain wrapper `div`, or a nested group whose parent is a grid. Same rule,
 * applied by hand.
 */
export const sectionRuleClass = 'max-md:border-t max-md:border-border/70 max-md:pt-6';

/**
 * A small "note" block that keeps a surface on mobile instead of de-carding.
 * A section with no heading — a standalone explanatory paragraph — reads as
 * stray text once its frame is gone, so it gets a soft tinted panel instead.
 */
export const noteSurfaceClass =
  'max-md:rounded-lg max-md:border max-md:bg-muted/40 max-md:py-4 max-md:shadow-none';
