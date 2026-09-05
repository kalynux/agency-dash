import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MembershipStatus } from '@/types/agent.types';

/** Colour per status; the label lives in `agents:membershipStatus.*`, keyed by the enum. */
const STATUS_STYLE: Record<MembershipStatus, { dot: string; className: string }> = {
  pending: {
    dot: 'bg-amber-500',
    className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  },
  active: {
    dot: 'bg-emerald-500',
    className: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800',
  },
  // A mutual break, not a sanction — deliberately calmer than `suspended`.
  paused: {
    dot: 'bg-slate-400',
    className: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900 dark:border-slate-700',
  },
  suspended: {
    dot: 'bg-destructive',
    className: 'text-destructive bg-destructive/10 border-destructive/20',
  },
  rejected: {
    dot: 'bg-destructive',
    className: 'text-destructive bg-destructive/10 border-destructive/20',
  },
  withdrawn: {
    dot: 'bg-muted-foreground',
    className: 'text-muted-foreground bg-muted border-border',
  },
  deactivated: {
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
  const { t } = useTranslation('agents');
  const style = STATUS_STYLE[status];
  if (!style) return null;
  return (
    <Badge variant="outline" className={cn(style.className, className)}>
      <span className={cn('w-2 h-2 rounded-full me-1.5', style.dot)} />
      {t(`membershipStatus.${status}` as 'membershipStatus.pending')}
    </Badge>
  );
}
