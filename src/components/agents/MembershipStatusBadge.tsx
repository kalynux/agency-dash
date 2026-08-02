import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MembershipStatus } from '@/types/agent.types';

const STATUS_MAP: Record<MembershipStatus, { label: string; dot: string; className: string }> = {
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
  // A mutual break, not a sanction — deliberately calmer than `suspended`.
  paused: {
    label: 'Paused',
    dot: 'bg-slate-400',
    className: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900 dark:border-slate-700',
  },
  suspended: {
    label: 'Suspended',
    dot: 'bg-destructive',
    className: 'text-destructive bg-destructive/10 border-destructive/20',
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
  deactivated: {
    label: 'Ended',
    dot: 'bg-muted-foreground',
    className: 'text-muted-foreground bg-muted border-border',
  },
};

export function MembershipStatusBadge({
  status,
  className,
}: {
  status: MembershipStatus;
  className?: string;
}) {
  const meta = STATUS_MAP[status];
  if (!meta) return null;
  return (
    <Badge variant="outline" className={cn(meta.className, className)}>
      <span className={cn('w-2 h-2 rounded-full mr-1.5', meta.dot)} />
      {meta.label}
    </Badge>
  );
}
