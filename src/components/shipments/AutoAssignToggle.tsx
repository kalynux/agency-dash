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
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <Zap className="w-4 h-4 text-primary" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Label htmlFor="auto-assign" className="text-sm cursor-help">
            {t('autoAssign.label')}
          </Label>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{t('autoAssign.tooltip')}</TooltipContent>
      </Tooltip>
      <Switch id="auto-assign" checked={enabled} disabled={isBusy} onCheckedChange={handleChange} />
    </div>
  );
}
