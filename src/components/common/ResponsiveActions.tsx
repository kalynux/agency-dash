import { useState, type ReactNode } from 'react';
import { Loader2, MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export interface ResponsiveActionItem {
  key: string;
  label: string;
  /** Why the action is unavailable, or what it will do. Mobile sheet only. */
  hint?: string;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  /** Spinner in place of the icon while this one action is in flight. */
  busy?: boolean;
  onSelect: () => void;
}

export interface ResponsiveActionsProps {
  /** Sheet header on mobile — name the record being acted on, not the menu. */
  title?: string;
  items: readonly ResponsiveActionItem[];
  /** Accessible name for the default `⋯` trigger. */
  label: string;
  /** Replaces the default `⋯` button. Must accept a click. */
  trigger?: ReactNode;
  /** Spinner on the default trigger — for a mutation the row is waiting on. */
  busy?: boolean;
  align?: 'start' | 'end';
  className?: string;
}

/**
 * A per-record action menu: a dropdown on desktop, a bottom sheet of tappable
 * rows on a phone.
 *
 * Generalised from the shipments row menu, which arrived at this shape first
 * and for good reasons. A dropdown anchored to a `⋯` in the corner of a card
 * puts 32px-tall items under the thumb that just covered them, and the menu
 * often opens upward off the top of a card near the bottom of the list. A sheet
 * is anchored where the thumb already is, has room to say *why* an action is
 * unavailable rather than only greying it out, and cannot be clipped.
 *
 * `hint` is the part worth keeping honest. A disabled row in a dropdown is a
 * dead end; the same row in a sheet can carry "needs an agent first" underneath
 * it, which is the difference between a broken button and an explained one.
 */
export function ResponsiveActions({
  title,
  items,
  label,
  trigger,
  busy = false,
  align = 'end',
  className,
}: ResponsiveActionsProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  const defaultTrigger = (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8', className)}
      aria-label={label}
      onClick={(e) => {
        // Rows are usually clickable themselves; without this the menu tap also
        // opens the record behind it.
        e.stopPropagation();
        if (isMobile) setOpen(true);
      }}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <MoreHorizontal className="size-4" />
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <>
        {trigger ? (
          <span onClick={() => setOpen(true)} className={className}>
            {trigger}
          </span>
        ) : (
          defaultTrigger
        )}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="h-auto gap-0 rounded-t-2xl p-0">
            {title && (
              <SheetHeader className="border-b pe-10 text-start">
                <SheetTitle className="truncate text-base">{title}</SheetTitle>
              </SheetHeader>
            )}
            <div className="flex flex-col py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {items.map((item) => (
                <SheetActionRow
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  hint={item.hint}
                  disabled={item.disabled}
                  busy={item.busy}
                  destructive={item.destructive}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger ?? defaultTrigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        {title && (
          <>
            <DropdownMenuLabel className="truncate">{title}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {items.map((item) => (
          <DropdownMenuItem
            key={item.key}
            disabled={item.disabled}
            variant={item.destructive ? 'destructive' : 'default'}
            onSelect={item.onSelect}
          >
            {item.busy ? <Loader2 className="size-4 animate-spin" /> : item.icon}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * One row of a bottom action sheet.
 *
 * Exported because a few sheets are hand-built around a record's own layout and
 * only want the row; everything else should use `ResponsiveActions`.
 */
export function SheetActionRow({
  icon,
  label,
  hint,
  disabled,
  busy,
  destructive,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  hint?: string;
  disabled?: boolean;
  busy?: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 px-5 py-3 text-start transition-colors',
        'hover:bg-muted/60 active:bg-muted disabled:opacity-50',
        destructive && 'text-destructive',
      )}
    >
      <span className="shrink-0 [&_svg]:size-5">
        {busy ? <Loader2 className="size-5 animate-spin" /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );
}
