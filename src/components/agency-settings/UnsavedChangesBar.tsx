import { useTranslation } from 'react-i18next';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKeyboardOpen } from '@/platform/shell/keyboard';
import { cn } from '@/lib/utils';

interface UnsavedChangesBarProps {
  /** Show the bar (typically `dirty || saving`). */
  visible: boolean;
  /** Disables both buttons and swaps the Save icon for a spinner. */
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

/**
 * Floating "Unsaved changes" pill pinned to the bottom of the viewport, with
 * Discard / Save actions. One instance per settings tab — the tab tracks its
 * own dirty state and performs a single API call on save.
 *
 * Below `md` the app runs the bottom tab bar (App.tsx renders `MobileTabBar`
 * under 768px, the same breakpoint as `md`), which is `fixed` at `bottom-0`,
 * 4rem tall plus the safe-area inset, and whose FAB pokes a further 20px above
 * its own row. A pill at `bottom-6` lands underneath all of that and is simply
 * invisible on a phone, so the mobile offset clears the row, the inset and the
 * FAB. It lines up with the `pb-[calc(6rem+…)]` the mobile shell already
 * reserves under the content — keep the two in sync.
 *
 * While the on-screen keyboard is up (native only — see
 * `platform/shell/keyboard.ts`) the tab bar hides itself, so that whole
 * allowance would leave the pill floating in mid-screen. The offset collapses
 * with it, which also puts Save directly above the keyboard on the settings
 * forms where the field being edited is the reason the bar appeared at all.
 *
 * On a phone the pill takes the full row (capped at `max-w-sm`) and the label
 * truncates, so the two buttons always fit — a nowrap label on a content-sized
 * pill pushed Save past the right edge of a 360px screen.
 *
 * The surface is inverted (`bg-foreground`) rather than `bg-background`: on the
 * page's own colour the pill read as one more card, and a pending save is the
 * one thing on the screen that must not be missed. Inverted, it is dark on the
 * light theme and light on the dark one — the snackbar convention.
 */
export function UnsavedChangesBar({ visible, saving, onDiscard, onSave }: UnsavedChangesBarProps) {
  const { t } = useTranslation('common');
  const keyboardOpen = useKeyboardOpen();
  if (!visible) return null;

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
        className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-full bg-foreground py-1.5 ps-3.5 pe-1.5 text-background shadow-2xl ring-1 ring-foreground/10 animate-fade-in md:w-auto md:max-w-none md:gap-3 md:ps-4"
      >
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        <p className="min-w-0 flex-1 truncate text-xs font-medium md:flex-none md:text-sm">
          {t('states.unsavedChanges')}
        </p>
        <div className="flex flex-shrink-0 items-center gap-1 md:gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full px-2.5 text-background/80 hover:bg-background/15 hover:text-background sm:px-3"
            onClick={onDiscard}
            disabled={saving}
          >
            {t('actions.discard')}
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 rounded-full px-3 sm:px-4"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {/* "Save changes" costs ~50px the 360px pill can't spare. */}
            <span className="md:hidden">{t('actions.save')}</span>
            <span className="max-md:hidden">{t('actions.saveChanges')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
