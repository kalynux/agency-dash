import type { ReactNode } from 'react';
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
 */

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned actions (buttons, filters). Stack below the title on mobile. */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && (
          <p className="max-w-2xl text-muted-foreground">{description}</p>
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
