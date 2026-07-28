import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
 */
export function UnsavedChangesBar({ visible, saving, onDiscard, onSave }: UnsavedChangesBarProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-background/95 py-1.5 pl-4 pr-1.5 shadow-lg backdrop-blur animate-fade-in sm:gap-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        <p className="text-sm font-medium">Unsaved changes</p>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={onDiscard}
            disabled={saving}
          >
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
