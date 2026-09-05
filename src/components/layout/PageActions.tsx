import { useState, type ElementType } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/**
 * One thing a page can do, described rather than rendered.
 *
 * Page actions used to be handed to `PageHeader` as ready-made JSX, which meant
 * every page decided for itself how they looked on a phone — and the answer was
 * always the same one: hide the label (`hidden sm:inline`) and hope the icon
 * carried it. That works for two buttons and falls apart at three, which is
 * where most of these screens now are once the notification bell is beside them.
 *
 * Describing an action instead lets the header make that call once, with the
 * whole set in view: what stays on the bar, what folds into the overflow sheet,
 * and — the part JSX could never give back — what the label says once there is
 * room for it again.
 */
export interface PageAction {
  /** Stable key. Also the test handle. */
  id: string;
  /** Full sentence-case label. Shown beside the icon on desktop and in the sheet. */
  label: string;
  icon?: ElementType;
  onSelect: () => void;
  disabled?: boolean;
  /** In flight: the icon spins and the action refuses further taps. */
  busy?: boolean;
  /** Destructive intent — red in the sheet, destructive variant on desktop. */
  destructive?: boolean;
  /**
   * The page's main action. Stays on the bar as an icon button on mobile
   * instead of folding into the overflow, and is the filled button on desktop.
   *
   * At most one or two per page. Marking everything primary is the same as
   * marking nothing.
   */
  primary?: boolean;
}

/** Whether an action can be tapped right now. */
function isBlocked(action: PageAction): boolean {
  return Boolean(action.disabled || action.busy);
}

/** The icon, spinning while the action is in flight. */
function ActionIcon({ action, className }: { action: PageAction; className?: string }) {
  if (action.busy) return <Loader2 className={cn('animate-spin', className)} />;
  if (!action.icon) return null;
  const Icon = action.icon;
  return <Icon className={className} />;
}

/**
 * Renders a page's actions at whatever density the viewport allows.
 *
 * - **Desktop** — every action as a labelled button, in the order given.
 * - **Mobile** — `primary` actions stay on the bar as icon buttons; the rest
 *   fold behind a `⋮` that opens a bottom sheet. A lone leftover is rendered
 *   inline instead, because a menu containing one item is two taps to do what
 *   one tap could.
 */
export function PageActions({
  actions,
  className,
}: {
  actions: PageAction[];
  className?: string;
}) {
  const { t } = useTranslation('common');
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!actions.length) return null;

  if (!isMobile) {
    return (
      <div className={cn('flex flex-shrink-0 items-center gap-2', className)}>
        {actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant={action.primary ? 'default' : action.destructive ? 'destructive' : 'outline'}
            onClick={action.onSelect}
            disabled={isBlocked(action)}
            className="gap-2"
          >
            <ActionIcon action={action} className="h-4 w-4" />
            {action.label}
          </Button>
        ))}
      </div>
    );
  }

  const pinned = actions.filter((a) => a.primary);
  const overflow = actions.filter((a) => !a.primary);
  // A sheet holding a single row is a worse button than the button.
  const inline = overflow.length === 1 ? [...pinned, ...overflow] : pinned;
  const menu = overflow.length === 1 ? [] : overflow;

  return (
    <div className={cn('flex flex-shrink-0 items-center gap-1', className)}>
      {inline.map((action) => (
        <Button
          key={action.id}
          type="button"
          variant={action.primary ? 'default' : 'ghost'}
          size="icon"
          onClick={action.onSelect}
          disabled={isBlocked(action)}
          aria-label={action.label}
          title={action.label}
          className={cn(
            'h-9 w-9 flex-shrink-0',
            // Icon-only, so colour is the only thing left to say "this one is
            // different" — the label that would have said it is in the tooltip.
            action.destructive && !action.primary && 'text-destructive hover:text-destructive',
          )}
        >
          <ActionIcon action={action} className="h-[1.15rem] w-[1.15rem]" />
        </Button>
      ))}

      {menu.length > 0 && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(true)}
            aria-label={t('actions.pageActions')}
            aria-expanded={menuOpen}
            className="h-9 w-9 flex-shrink-0"
          >
            <MoreVertical className="h-[1.15rem] w-[1.15rem]" />
          </Button>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetContent side="bottom" className="rounded-t-2xl p-0">
              <div className="px-4 pb-2 pt-4">
                <SheetTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('actions.pageActions')}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  {t('actions.pageActionsDescription')}
                </SheetDescription>
              </div>
              <div className="border-t py-1">
                {menu.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    disabled={isBlocked(action)}
                    onClick={() => {
                      // Close first: the sheet's exit animation and whatever the
                      // action opens (a dialog, a route change) otherwise race,
                      // and the loser is a dialog underneath a closing overlay.
                      setMenuOpen(false);
                      action.onSelect();
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors',
                      'hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
                      action.destructive && 'text-destructive',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
                        action.destructive
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-primary/10 text-primary',
                      )}
                    >
                      <ActionIcon action={action} className="h-5 w-5" />
                    </span>
                    <span className="flex-1 text-sm font-semibold">{action.label}</span>
                  </button>
                ))}
              </div>
              <div className="h-2 pb-[env(safe-area-inset-bottom)]" />
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
