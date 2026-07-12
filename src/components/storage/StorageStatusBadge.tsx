import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { StorageStatus } from '@/types';

const STATUS_MAP: Record<StorageStatus, { label: string; dot: string; className: string }> = {
  in_stock: { label: 'In Stock', dot: 'bg-green-500', className: 'border-green-500 text-green-600 bg-green-50' },
  low_stock: { label: 'Low Stock', dot: 'bg-yellow-500', className: 'border-yellow-500 text-yellow-600 bg-yellow-50' },
  out_of_stock: { label: 'Out of Stock', dot: 'bg-red-500', className: 'border-red-500 text-red-600 bg-red-50' },
  reserved: { label: 'Reserved', dot: 'bg-blue-500', className: 'border-blue-500 text-blue-600 bg-blue-50' },
};

export function StorageStatusBadge({ status }: { status: StorageStatus }) {
  const meta = STATUS_MAP[status];
  return (
    <Badge variant="outline" className={cn('capitalize', meta.className)}>
      <span className={cn('w-2 h-2 rounded-full mr-1.5', meta.dot)} />
      {meta.label}
    </Badge>
  );
}
