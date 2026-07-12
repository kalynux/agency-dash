import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AgentStatus } from '@/types';

const STATUS_MAP: Record<AgentStatus, { label: string; dot: string; className: string }> = {
  active: { label: 'Active', dot: 'bg-green-500', className: 'border-green-500 text-green-600 bg-green-50' },
  inactive: { label: 'Inactive', dot: 'bg-gray-400', className: 'border-gray-400 text-gray-600 bg-gray-50' },
  suspended: { label: 'Suspended', dot: 'bg-red-500', className: 'border-red-500 text-red-600 bg-red-50' },
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const meta = STATUS_MAP[status];
  return (
    <Badge variant="outline" className={cn('capitalize', meta.className)}>
      <span className={cn('w-2 h-2 rounded-full mr-1.5', meta.dot)} />
      {meta.label}
    </Badge>
  );
}
