import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CodRemittanceStatus } from '@/types/cod-cash.types';

const STATUS_MAP: Record<CodRemittanceStatus, { label: string; dot: string; className: string }> = {
  declared: { label: 'Declared', dot: 'bg-yellow-500', className: 'border-yellow-500 text-yellow-600 bg-yellow-50' },
  confirmed: { label: 'Confirmed', dot: 'bg-green-500', className: 'border-green-500 text-green-600 bg-green-50' },
  rejected: { label: 'Rejected', dot: 'bg-red-500', className: 'border-red-500 text-red-600 bg-red-50' },
};

export function CodRemittanceStatusBadge({ status }: { status: CodRemittanceStatus }) {
  const meta = STATUS_MAP[status];
  return (
    <Badge variant="outline" className={cn('capitalize', meta.className)}>
      <span className={cn('w-2 h-2 rounded-full mr-1.5', meta.dot)} />
      {meta.label}
    </Badge>
  );
}
