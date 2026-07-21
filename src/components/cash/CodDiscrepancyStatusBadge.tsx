import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CodDiscrepancyStatus } from '@/types/cod-cash.types';

const STATUS_MAP: Record<CodDiscrepancyStatus, { label: string; dot: string; className: string }> = {
  open: { label: 'Open', dot: 'bg-red-500', className: 'border-red-500 text-red-600 bg-red-50' },
  resolved: { label: 'Resolved', dot: 'bg-green-500', className: 'border-green-500 text-green-600 bg-green-50' },
  written_off: { label: 'Written Off', dot: 'bg-gray-400', className: 'border-gray-400 text-gray-600 bg-gray-50' },
};

export function CodDiscrepancyStatusBadge({ status }: { status: CodDiscrepancyStatus }) {
  const meta = STATUS_MAP[status];
  return (
    <Badge variant="outline" className={cn('capitalize', meta.className)}>
      <span className={cn('w-2 h-2 rounded-full mr-1.5', meta.dot)} />
      {meta.label}
    </Badge>
  );
}
