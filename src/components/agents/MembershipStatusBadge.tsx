import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MembershipStatus } from '@/types/agent.types';

const STATUS_MAP: Record<MembershipStatus, { label: string; dot: string; className: string }> = {
  pending: { label: 'Pending', dot: 'bg-amber-500', className: 'border-amber-500 text-amber-600 bg-amber-50' },
  approved: { label: 'Approved', dot: 'bg-green-500', className: 'border-green-500 text-green-600 bg-green-50' },
  // A mutual break, not a sanction — deliberately calmer than `suspended`.
  paused: { label: 'Paused', dot: 'bg-slate-400', className: 'border-slate-400 text-slate-600 bg-slate-50' },
  suspended: { label: 'Suspended', dot: 'bg-red-500', className: 'border-red-500 text-red-600 bg-red-50' },
  removed: { label: 'Removed', dot: 'bg-gray-400', className: 'border-gray-400 text-gray-600 bg-gray-50' },
};

export function MembershipStatusBadge({ status }: { status: MembershipStatus }) {
  const meta = STATUS_MAP[status];
  return (
    <Badge variant="outline" className={cn(meta.className)}>
      <span className={cn('w-2 h-2 rounded-full mr-1.5', meta.dot)} />
      {meta.label}
    </Badge>
  );
}
