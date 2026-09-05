import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

/**
 * Centered popup on desktop, bottom sheet on a phone.
 *
 * Header and footer stay pinned and only the middle scrolls, in both shapes —
 * a form the length of a card entry used to push its own "Save" below the fold
 * on the device where that hurts most. The two branches are separate Radix
 * roots on purpose: swapping the panel's classes at a breakpoint would keep the
 * centered dialog's focus and drag semantics on a sheet that reads as one.
 */

export interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Scrollable body. */
  children: ReactNode;
  /** Pinned actions. Full width and stacked on a phone, trailing row on desktop. */
  footer?: ReactNode;
  /** Desktop panel width (e.g. `sm:max-w-2xl`). */
  desktopClassName?: string;
  /** Mobile panel override — `h-auto max-h-[92dvh]` lets a short form size itself. */
  mobileClassName?: string;
  footerClassName?: string;
  /** Blocks overlay/escape dismissal — set while a submit is in flight. */
  disableClose?: boolean;
}

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  desktopClassName = 'sm:max-w-lg',
  mobileClassName,
  footerClassName,
  disableClose = false,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  const handleOpenChange = (next: boolean) => {
    if (!next && disableClose) return;
    onOpenChange(next);
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className={cn('flex h-[92dvh] flex-col gap-0 rounded-t-2xl p-0', mobileClassName)}
          onInteractOutside={(e) => disableClose && e.preventDefault()}
          onEscapeKeyDown={(e) => disableClose && e.preventDefault()}
        >
          {/* `pr-12` clears the panel's own close button. */}
          <SheetHeader className="shrink-0 border-b p-4 pr-12">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          {/* `min-h-0` or the body refuses to shrink inside the flex column and
              the panel grows past its max height instead of scrolling. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
          {footer && (
            // A stretched column, so each action is a full-width tap target
            // clear of the gesture bar.
            <SheetFooter
              className={cn(
                'shrink-0 border-t pb-[calc(1rem+env(safe-area-inset-bottom))]',
                footerClassName,
              )}
            >
              {footer}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn('flex max-h-[85dvh] flex-col gap-0 p-0', desktopClassName)}
        onInteractOutside={(e) => disableClose && e.preventDefault()}
        onEscapeKeyDown={(e) => disableClose && e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b p-4 pr-12 text-left sm:px-5">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer && (
          <div
            className={cn(
              'flex shrink-0 justify-end gap-2 border-t p-4 sm:px-5 sm:py-3',
              footerClassName,
            )}
          >
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
