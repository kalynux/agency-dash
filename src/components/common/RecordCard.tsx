import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** A label/value pair under the card's headline. */
export interface RecordField {
  label: string;
  value: ReactNode;
  /** Drop the row entirely when there is nothing to say. Defaults to showing it. */
  hideWhenEmpty?: boolean;
}

export interface RecordCardProps {
  /** The one thing that identifies the record — a name, a reference, an order number. */
  title: ReactNode;
  /** Status badge, beside the title. */
  badge?: ReactNode;
  /** The figure this record is about, set against the title. Usually money. */
  primary?: ReactNode;
  /** Short facts joined by `·` under the headline — dates, types, counts. */
  meta?: ReactNode[];
  /** Label/value rows, for the columns that do not fit the headline. */
  fields?: RecordField[];
  /** Free text at the foot — a note, a rejection reason. */
  note?: ReactNode;
  /** The `⋯` menu, or a row of buttons. */
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * One record of a listing, as a card — the mobile half of a table.
 *
 * A table below `md` is a horizontal scroller: every column past the second is
 * off-screen, the header that names them scrolls away with them, and a row's
 * actions end up furthest from the thumb. The card keeps the same information
 * and drops only the grid.
 *
 * The slots are ordered by how a record is actually read, and that order is the
 * component's real content:
 *
 *   title + badge ······ what is it, and what state is it in
 *   primary ············ the number, set right so a column of them lines up
 *   meta ··············· the short facts, one line, `·` separated
 *   fields ············· the remaining columns, labelled because they are not
 *                        self-describing out of a table
 *   note ··············· prose, last, because it is the longest
 *
 * Everything is optional; a two-column table becomes a title and a `primary`
 * and nothing else. Pair with `listSurfaceClass` on the wrapping `<Card>` so the
 * list runs edge to edge through the page gutter.
 */
export function RecordCard({
  title,
  badge,
  primary,
  meta,
  fields,
  note,
  actions,
  onClick,
  className,
}: RecordCardProps) {
  const visibleMeta = meta?.filter(Boolean) ?? [];
  const visibleFields = fields?.filter((f) => !f.hideWhenEmpty || Boolean(f.value)) ?? [];

  return (
    <div
      className={cn(
        'p-4 transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50 active:bg-muted/50',
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate font-medium">{title}</span>
            {badge && <span className="shrink-0">{badge}</span>}
          </div>

          {visibleMeta.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              {visibleMeta.map((item, i) => (
                // Index keys: these are positional fragments of one sentence,
                // never reordered and never keyed by anything of their own.
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden>·</span>}
                  {item}
                </span>
              ))}
            </p>
          )}
        </div>

        {primary && <div className="shrink-0 text-end font-medium">{primary}</div>}

        {/* `-me-2` pulls the ghost button's own padding back out to the card
            edge, so the icon lines up with the content above it. */}
        {actions && (
          <div className="-me-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>

      {visibleFields.length > 0 && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {visibleFields.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="min-w-0 truncate text-end">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/**
 * The `<ul>` a run of `RecordCard`s lives in — one hairline between rows and
 * nothing else. Separate from the card so a listing can mix in its own row
 * types (a date separator, a "load more") without losing the rhythm.
 */
export function RecordCardList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('divide-y md:hidden', className)}>{children}</div>;
}
