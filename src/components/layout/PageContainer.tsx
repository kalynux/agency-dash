import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { InfoHint } from '@/components/common/InfoHint';
import { findNavTrail } from '@/config/navigation';
import { tx } from '@/i18n/tx';
import { cn } from '@/lib/utils';
import { NotificationBell } from './NotificationBell';
import { PageActions, type PageAction } from './PageActions';
import { mobileAppBarClass, mobileAppBarTitleRowClass } from './mobileChrome';

export type { PageAction } from './PageActions';

/**
 * Page-level layout primitives shared by every dashboard route.
 *
 * `PageHeader` fixes the title → description → actions rhythm in one place so
 * every page reads with the same cadence: title and its description sit tight
 * together (a single group), page actions align to the baseline on wide screens
 * and stack below on narrow ones. It has no eyebrow/kicker — the title carries
 * its own weight — but it does take a `parent` crumb, for the routes that are
 * one submenu of a menu (see `SubPageHeader`).
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
  /**
   * Name of the menu this route sits under, rendered as a plain crumb before
   * the title ("Account › Profile"). Deliberately not a link: it names where
   * you are, and the parent has no page of its own to go back to — every one of
   * them redirects straight to its first submenu.
   *
   * Desktop only. On a phone the crumb spends a third of the title row naming
   * the menu the user tapped one screen ago, and the title it pushes aside is
   * the half that says where they actually are.
   */
  parent?: string;
  description?: string;
  /**
   * Mobile stand-in for `description` — about five words. When set, the full
   * description moves behind an ⓘ beside the title on phones, where a
   * two-line paragraph costs more than it explains. See `SectionHeading`.
   */
  shortDescription?: string;
  /**
   * Free-form inline controls — a live status pill, a toggle, anything that is
   * not a button with a label. Always rendered on the bar, at every width.
   *
   * For ordinary buttons prefer {@link PageHeaderProps.actionItems}: only the
   * described form can be folded into the mobile overflow sheet with its label
   * intact.
   */
  actions?: ReactNode;
  /**
   * The page's actions, described rather than rendered, so the header can lay
   * them out for the viewport it is on — labelled buttons on desktop, icons and
   * an overflow sheet on a phone. See {@link PageAction}.
   */
  actionItems?: PageAction[];
  /** Applied to the title row (the pinned band on mobile). */
  className?: string;
}

/**
 * The page's title bar.
 *
 * On desktop this is an ordinary heading block. On a phone it is the app bar:
 * pinned under the status bar, one row of title-and-actions at a fixed height,
 * the notification bell always in the top-right corner, and a description
 * clamped to a single line beneath. See `./mobileChrome` for the pinning
 * contract it shares with `SearchFilterBar` — in particular why the height of
 * the title row is fixed and why the description sits outside it.
 */
export function PageHeader({
  title,
  parent,
  description,
  shortDescription,
  actions,
  actionItems,
  className,
}: PageHeaderProps) {
  const { t } = useTranslation('common');
  return (
    <div className={cn(mobileAppBarClass, className)}>
      <div
        className={cn(
          'flex items-center justify-between gap-2 md:gap-4',
          mobileAppBarTitleRowClass,
        )}
      >
        <h1
          className={cn(
            'flex min-w-0 flex-1 items-center gap-x-1.5 text-lg font-bold tracking-tight md:text-2xl',
            // A crumb is two names on one line, so it skips the desktop size
            // step: "Cash Management › Discrepancies" at 3xl wraps on anything
            // narrower than a wide laptop.
            !parent && 'lg:text-3xl',
          )}
        >
          {parent && (
            <span className="flex min-w-0 items-center gap-x-1.5 max-md:hidden">
              <span className="truncate text-muted-foreground">{parent}</span>
              <ChevronRight
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-muted-foreground/60 rtl:-scale-x-100"
              />
            </span>
          )}
          {/* `truncate`, not wrap: the row's height is the offset the search bar
              pins to, so a title long enough to wrap would open a seam between
              the two pinned bands. */}
          <span className="truncate">{title}</span>
          {description && shortDescription && (
            <InfoHint className="shrink-0 md:hidden" label={t('form.aboutSection', { title })}>
              {description}
            </InfoHint>
          )}
        </h1>

        <div className="flex flex-shrink-0 items-center gap-1 md:gap-2">
          {actions}
          {actionItems && actionItems.length > 0 && <PageActions actions={actionItems} />}
          {/* Last, so it is the constant in the corner across every screen —
              the one control whose position the user can learn. Desktop has its
              own in `Header`. */}
          <NotificationBell className="md:hidden" />
        </div>
      </div>

      {/* One line, everywhere. On a phone the ⓘ above carries the full text
          when a `shortDescription` was supplied; on desktop the title attribute
          does, for the rare description wider than the column. */}
      {description && (
        <p
          title={description}
          className={cn(
            'mt-1.5 line-clamp-1 max-w-2xl text-sm text-muted-foreground md:text-base',
            shortDescription && 'max-md:hidden',
          )}
        >
          {description}
        </p>
      )}
      {shortDescription && (
        <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground md:hidden">
          {shortDescription}
        </p>
      )}
    </div>
  );
}

/**
 * Handed down to a tab component so it can supply the page header's actions.
 *
 * The header belongs to the page (only it knows the crumb and the description),
 * but the button that reloads a tab belongs to the tab — it closes over that
 * tab's own `load` and its in-flight state. Rather than lift that state up, the
 * page passes down a renderer and the tab decides what goes in the action slot.
 *
 * Takes {@link PageAction}s rather than JSX so a tab's actions get the same
 * mobile treatment as a page's — an icon on the bar, or a labelled row in the
 * overflow sheet — instead of each tab having to decide for itself.
 */
export type RenderPageHeader = (actions?: PageAction[]) => ReactNode;

interface SubPageHeaderProps extends Omit<PageHeaderProps, 'title' | 'parent'> {
  /**
   * The *resolved* submenu route. Pages that fall back to a default tab must
   * pass that tab's path rather than `location.pathname`: on bare
   * `/dashboard/account` the crumb would otherwise stop at "Account" while the
   * content below it is already Profile.
   */
  path: string;
}

/**
 * `PageHeader` for a route that is one submenu of a menu.
 *
 * Both names come out of `config/navigation.ts`, so the crumb can never drift
 * from the sidebar entry the user clicked — the page only supplies the
 * description, which belongs to the submenu and not to its parent.
 */
export function SubPageHeader({ path, ...rest }: SubPageHeaderProps) {
  const { t } = useTranslation('nav');
  const trail = findNavTrail(path);
  if (!trail) return null;
  const { parent, child } = trail;
  return (
    <PageHeader
      parent={child && tx(t, parent.labelKey)}
      title={tx(t, (child ?? parent).labelKey)}
      {...rest}
    />
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
 * Surface for the small blocks that sit ABOVE a page's real content — a stat
 * tile, an inline "record …" form, a banner.
 *
 * The base `Card` is sized for a section someone reads: `py-6` on the card plus
 * `px-6` on its content. A block that only carries a label, a figure and a hint
 * pays that box twice — the card's `py-6` *and* its content's own `p-4` — so
 * ~80px of a ~150px tile is whitespace and a row of three tiles pushes the table
 * they summarise off the fold. This gives the card no box of its own (padding,
 * and the 24px flex gap that would otherwise separate a header from content),
 * leaving the padding to the content, applied once.
 *
 * Pair with `compactCardContentClass`.
 */
export const compactCardClass = 'gap-0 py-0';

/**
 * Content padding for a `compactCardClass` card. One step up on wide screens,
 * where the room is there to spend; on a phone the gutter is already doing half
 * this job. Compose with `cn` when the block needs its own layout classes.
 */
export const compactCardContentClass = 'p-4 sm:p-5';

/**
 * A small "note" block that keeps a surface on mobile instead of de-carding.
 * A section with no heading — a standalone explanatory paragraph — reads as
 * stray text once its frame is gone, so it gets a soft tinted panel instead.
 *
 * Padding belongs to the content here too (see `compactCardClass`) — a note is
 * one paragraph, and a 24px box around it on top of its own padding reads as a
 * gap rather than as breathing room.
 */
export const noteSurfaceClass =
  compactCardClass + ' max-md:rounded-lg max-md:border max-md:bg-muted/40 max-md:shadow-none';
