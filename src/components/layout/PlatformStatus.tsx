import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

export type PlatformHealth = 'online' | 'degraded' | 'offline';

/**
 * Platform health signal for the sidebar footer.
 *
 * STUB: always reports "online" for now. Swap the body for a real source later
 * (e.g. `navigator.onLine` + an API health ping) — this is the single seam.
 */
function usePlatformStatus(): PlatformHealth {
  // TODO: wire a real health source (navigator.onLine / periodic /health ping).
  return 'online';
}

/** Dot colour per state. The label lives in the `nav` bundle, keyed by state. */
const STATUS_DOT: Record<PlatformHealth, string> = {
  online: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  offline: 'bg-red-500',
};

const STATUS_LABEL_KEY: Record<PlatformHealth, string> = {
  online: 'platformStatus.operational',
  degraded: 'platformStatus.degraded',
  offline: 'platformStatus.down',
};

interface PlatformStatusProps {
  /** Hide the text label (collapsed sidebar) and show only the dot. */
  compact?: boolean;
  className?: string;
}

export function PlatformStatus({ compact, className }: PlatformStatusProps) {
  const { t } = useTranslation('nav');
  const status = usePlatformStatus();
  const dot = STATUS_DOT[status];
  const label = t(STATUS_LABEL_KEY[status] as 'platformStatus.operational');

  return (
    <div
      className={cn('flex items-center gap-2', compact && 'justify-center', className)}
      title={label}
      aria-label={compact ? label : undefined}
    >
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
        {status === 'online' && (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', dot)} />
        )}
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', dot)} />
      </span>
      {!compact && (
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
