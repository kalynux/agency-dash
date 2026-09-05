import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ConnectionStatus } from '@/types/vendor-connection.types';

/** Colour per status; the label lives in `vendors:status.*`, keyed by the enum. */
const STATUS_STYLE: Record<ConnectionStatus, { dot: string; className: string }> = {
  pending: {
    dot: 'bg-amber-500',
    className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  },
  active: {
    dot: 'bg-emerald-500',
    className: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800',
  },
  paused_reapproval: {
    dot: 'bg-amber-500',
    className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  },
  rejected: {
    dot: 'bg-destructive',
    className: 'text-destructive bg-destructive/10 border-destructive/20',
  },
  withdrawn: {
    dot: 'bg-muted-foreground',
    className: 'text-muted-foreground bg-muted border-border',
  },
  terminated: {
    dot: 'bg-muted-foreground',
    className: 'text-muted-foreground bg-muted border-border',
  },
};

export function ConnectionStatusBadge({ status, className }: { status: ConnectionStatus; className?: string }) {
  const { t } = useTranslation('vendors');
  const style = STATUS_STYLE[status];
  return (
    <Badge variant="outline" className={cn(style.className, className)}>
      <span className={cn('w-2 h-2 rounded-full me-1.5', style.dot)} />
      {t(`status.${status}` as 'status.pending')}
    </Badge>
  );
}
