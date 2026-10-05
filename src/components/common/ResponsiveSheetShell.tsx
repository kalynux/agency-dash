import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';

/**
 * The frame only: a bottom sheet on a phone, a centred popup on desktop.
 *
 * `ResponsiveModal` owns its own header/body/footer; this one does not, for the
 * profile-style panels (agent, vendor) whose hero header scrolls with the body
 * and whose layout is the whole point. Sheet and Dialog are both Radix Dialog,
 * so `SheetTitle`/`SheetHeader` inside the children work under either root.
 *
 * Children can hide phone-only furniture (the grab bar) with `md:hidden`.
 */
export function ResponsiveSheetShell({
  open,
  onOpenChange,
  children,
  mobileClassName,
  desktopClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Classes for the bottom sheet (height, radius). */
  mobileClassName?: string;
  /** Classes for the desktop dialog (width). */
  desktopClassName?: string;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn('flex flex-col gap-0 overflow-hidden p-0', mobileClassName)}
        >
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl',
          desktopClassName,
        )}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
