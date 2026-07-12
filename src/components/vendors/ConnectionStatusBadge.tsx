import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ConnectionStatus } from '@/types/vendor-connection.types';

const STATUS_MAP: Record<ConnectionStatus, { label: string; dot: string; className: string }> = {
  pending: {
    label: 'Pending',
    dot: 'bg-amber-500',
    className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  },
  active: {
    label: 'Active',
    dot: 'bg-emerald-500',
    className: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800',
  },
  paused_reapproval: {
    label: 'Reapproval needed',
    dot: 'bg-amber-500',
    className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  },
  rejected: {
    label: 'Rejected',
    dot: 'bg-destructive',
    className: 'text-destructive bg-destructive/10 border-destructive/20',
  },
  withdrawn: {
    label: 'Withdrawn',
    dot: 'bg-muted-foreground',
    className: 'text-muted-foreground bg-muted border-border',
  },
  terminated: {
    label: 'Terminated',
    dot: 'bg-muted-foreground',
    className: 'text-muted-foreground bg-muted border-border',
  },
};

export function ConnectionStatusBadge({ status, className }: { status: ConnectionStatus; className?: string }) {
  const meta = STATUS_MAP[status];
  return (
    <Badge variant="outline" className={cn(meta.className, className)}>
      <span className={cn('w-2 h-2 rounded-full mr-1.5', meta.dot)} />
      {meta.label}
    </Badge>
  );
}
