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
 */
export function UnsavedChangesBar({ visible, saving, onDiscard, onSave }: UnsavedChangesBarProps) {
  const { t } = useTranslation('common');
  const keyboardOpen = useKeyboardOpen();
  if (!visible) return null;

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4',
        keyboardOpen ? 'bottom-4' : 'bottom-[calc(6rem+env(safe-area-inset-bottom))]',
        'md:bottom-6',
      )}
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border bg-background/95 py-1.5 ps-3 pe-1.5 shadow-lg backdrop-blur animate-fade-in sm:gap-3 sm:ps-4">
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        <p className="whitespace-nowrap text-sm font-medium">{t('states.unsavedChanges')}</p>
        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full px-2.5 sm:px-3"
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
            <span className="sm:hidden">{t('actions.save')}</span>
            <span className="max-sm:hidden">{t('actions.saveChanges')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
