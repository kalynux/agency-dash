import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAutoAssignSetting } from '@/hooks/useAutoAssignSetting';

/**
 * Read-only auto-assignment status for the Shipments header. The switch itself
 * lives in Settings → Preferences; this chip only tells dispatchers which mode
 * is active and links there.
 */
export function AutoAssignStatusChip() {
  const { t } = useTranslation('shipments');
  const { enabled } = useAutoAssignSetting();
  // Nothing trustworthy to show until the server has answered.
  if (enabled === null) return null;

  const state = enabled ? t('autoAssign.on') : t('autoAssign.off');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/dashboard/settings/preferences"
          aria-label={`${t('autoAssign.label')}: ${state}`}
          className="flex flex-shrink-0 items-center gap-2 rounded-lg border bg-card px-2 py-1.5 text-sm transition-colors hover:bg-accent md:px-3 md:py-2"
        >
          <Zap className={cn('w-4 h-4', enabled ? 'text-primary' : 'text-muted-foreground')} />
          {/* Compact on a phone: the ⚡ plus the state word carry the meaning. */}
          <span className="max-md:hidden">{t('autoAssign.label')}:</span>
          <span className={cn('font-medium', !enabled && 'text-muted-foreground')}>{state}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {enabled ? t('autoAssign.tooltipOn') : t('autoAssign.tooltipOff')}
      </TooltipContent>
    </Tooltip>
  );
}
