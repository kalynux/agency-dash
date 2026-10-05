import { ScrollText } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The "read the terms" control on an agent or vendor row — the agreement an
 * agency signs up to (a vendor's policies, an agent's contract).
 *
 * `ScrollText`, not ⓘ (2026-10-05): the ⓘ means "a hint about this label"
 * everywhere else in the dashboard, while this opens a document of terms. One
 * icon for both sides so a row reads the same in Agents and in Vendors.
 *
 * 40px square on a phone (touch target), 36px on desktop; stops the press so a
 * tappable row behind it does not open too.
 */
export function PolicyTermsButton({
  label,
  onClick,
  className,
}: {
  /** Accessible name, e.g. "View Acme's policies". Also the hover title. */
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background',
        'text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9 md:w-9',
        className,
      )}
    >
      <ScrollText className="h-4 w-4" />
    </button>
  );
}
