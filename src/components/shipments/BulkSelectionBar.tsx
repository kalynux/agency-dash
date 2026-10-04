import { useTranslation } from 'react-i18next';
import { UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKeyboardOpen } from '@/platform/shell/keyboard';
import { cn } from '@/lib/utils';

interface BulkSelectionBarProps {
  count: number;
  max: number;
  onClear: () => void;
  onAssign: () => void;
}

/**
 * Floating "N selected" pill for the shipments list's bulk offer, with Clear
 * and Assign actions.
 *
 * It is the same pill as `UnsavedChangesBar`, on purpose — same inverted
 * surface, same row, same offsets — so "something is waiting on you" reads the
 * same everywhere in the app. The offsets are the part that matters: below `md`
 * the fixed bottom tab bar (4rem + safe-area inset, with its FAB a further 20px
 * above) covers anything pinned lower, which is exactly where the old in-flow
 * `sticky bottom-4` bar ended up. See `UnsavedChangesBar` for the arithmetic;
 * keep the two in sync.
 *
 * The page reserves room under its content while this is up (a spacer after the
 * list), so the last row and the pagination can be scrolled clear of it.
 */
export function BulkSelectionBar({ count, max, onClear, onAssign }: BulkSelectionBarProps) {
  const { t } = useTranslation('shipments');
  const keyboardOpen = useKeyboardOpen();
  if (count === 0) return null;
  const atLimit = count >= max;

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-50 flex justify-center px-3 md:px-4',
        keyboardOpen ? 'bottom-4' : 'bottom-[calc(6rem+env(safe-area-inset-bottom))]',
        'md:bottom-6',
      )}
    >
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-full bg-foreground py-1.5 ps-1.5 pe-1.5 text-background shadow-2xl ring-1 ring-foreground/10 animate-fade-in md:w-auto md:max-w-none md:gap-3"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0 rounded-full text-background/70 hover:bg-background/15 hover:text-background"
          onClick={onClear}
          aria-label={t('bulkAssign.clear')}
          title={t('bulkAssign.clear')}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none" title={atLimit ? t('bulkAssign.limitReached', { max }) : undefined}>
          {/* The count is the one figure here — set it apart from the words. */}
          <span
            className={cn(
              'inline-flex h-6 min-w-6 flex-shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
              atLimit ? 'bg-amber-500 text-black' : 'bg-background text-foreground',
            )}
          >
            {count}
          </span>
          <p className="min-w-0 truncate text-sm font-medium">
            {t('bulkAssign.selectedLabel', { count })}
            <span className="ms-1.5 text-xs font-normal text-background/60 tabular-nums">
              {atLimit ? t('bulkAssign.limitShort') : t('bulkAssign.ofMax', { max })}
            </span>
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          className="flex-shrink-0 gap-1.5 rounded-full px-3 sm:px-4"
          onClick={onAssign}
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span className="md:hidden">{t('bulkAssign.actionShort')}</span>
          <span className="max-md:hidden">{t('bulkAssign.action')}</span>
        </Button>
      </div>
    </div>
  );
}
