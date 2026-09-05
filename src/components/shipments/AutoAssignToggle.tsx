import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useActionRunner } from '@/hooks/useActionRunner';
import { shipmentsService } from '@/services/shipments.service';

const STORAGE_KEY = 'agency:autoAssignEnabled';

/**
 * Standing auto-assignment toggle (PATCH /api/agency/assignment-settings).
 * The backend exposes no read endpoint for the current value, so we remember the
 * operator's own last choice locally purely as a UI convenience — the source of
 * truth is always the last successful PATCH.
 */
export function AutoAssignToggle() {
  const { t } = useTranslation('shipments');
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const { run, isBusy } = useActionRunner();

  const handleChange = async (next: boolean) => {
    const result = await run(
      'assignment-settings',
      () => shipmentsService.updateAssignmentSettings(next),
      { success: next ? t('autoAssign.enabled') : t('autoAssign.disabled') },
    );
    if (result) {
      setEnabled(result.data.autoAssignEnabled);
      try {
        localStorage.setItem(STORAGE_KEY, String(result.data.autoAssignEnabled));
      } catch {
        /* ignore storage errors */
      }
    }
  };

  return (
    // Compact on a phone: the label drops away and the ⚡ carries the meaning,
    // so the control fits the app bar beside the page's other actions instead
    // of pushing the title out of it. The switch keeps its name either way via
    // `aria-label` — the visible `<Label>` is what names it on desktop, and
    // hiding that would otherwise leave an unnamed switch on mobile.
    <div className="flex flex-shrink-0 items-center gap-2 rounded-lg border bg-card px-2 py-1.5 md:px-3 md:py-2">
      <Zap className="w-4 h-4 text-primary" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Label htmlFor="auto-assign" className="text-sm cursor-help max-md:hidden">
            {t('autoAssign.label')}
          </Label>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{t('autoAssign.tooltip')}</TooltipContent>
      </Tooltip>
      <Switch
        id="auto-assign"
        aria-label={t('autoAssign.label')}
        checked={enabled}
        disabled={isBusy}
        onCheckedChange={handleChange}
      />
    </div>
  );
}
