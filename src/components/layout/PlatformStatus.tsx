import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { useIsOnline } from '@/platform/network';

export type PlatformHealth = 'online' | 'degraded' | 'offline';

/**
 * Platform health signal for the sidebar footer.
 *
 * Sourced from the device's connectivity (CAPACITOR-PLAN.md → P3.4): the OS's
 * own network state on a device, `navigator.onLine` in a browser. It used to
 * return a hardcoded `'online'`, which is the worst possible answer — a green
 * "All systems operational" dot on a phone in airplane mode.
 *
 * `'degraded'` is still unreachable. It is kept because it is the honest label
 * for "connected, but the API is not answering", and nothing here measures
 * that yet — that needs a health ping, which is its own decision about how
 * often to spend a request saying nothing is wrong. Adding the state to the
 * union costs nothing; guessing at it would cost trust.
 */
function usePlatformStatus(): PlatformHealth {
  return useIsOnline() ? 'online' : 'offline';
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
  // Not `platformStatus.down`: "Service disruption" points the finger at the
  // platform for what is almost always a phone in a lift.
  offline: 'platformStatus.offline',
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
