import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AgentInviteStatus } from '@/types/agent.types';

const STATUS_MAP: Record<AgentInviteStatus, { label: string; dot: string; className: string }> = {
  pending: { label: 'Pending', dot: 'bg-yellow-500', className: 'border-yellow-500 text-yellow-600 bg-yellow-50' },
  accepted: { label: 'Accepted', dot: 'bg-green-500', className: 'border-green-500 text-green-600 bg-green-50' },
  declined: { label: 'Declined', dot: 'bg-red-500', className: 'border-red-500 text-red-600 bg-red-50' },
  revoked: { label: 'Revoked', dot: 'bg-gray-400', className: 'border-gray-400 text-gray-600 bg-gray-50' },
};

export function AgentInviteStatusBadge({ status }: { status: AgentInviteStatus }) {
  const meta = STATUS_MAP[status];
  return (
    <Badge variant="outline" className={cn('capitalize', meta.className)}>
      <span className={cn('w-2 h-2 rounded-full mr-1.5', meta.dot)} />
      {meta.label}
    </Badge>
  );
}
