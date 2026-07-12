import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types';

const STATUS_MAP: Record<OrderStatus, { label: string; dot: string; className: string }> = {
  pending: { label: 'Pending', dot: 'bg-yellow-500', className: 'border-yellow-500 text-yellow-600 bg-yellow-50' },
  confirmed: { label: 'Confirmed', dot: 'bg-blue-500', className: 'border-blue-500 text-blue-600 bg-blue-50' },
  processing: { label: 'Processing', dot: 'bg-purple-500', className: 'border-purple-500 text-purple-600 bg-purple-50' },
  shipped: { label: 'Shipped', dot: 'bg-indigo-500', className: 'border-indigo-500 text-indigo-600 bg-indigo-50' },
  delivered: { label: 'Delivered', dot: 'bg-green-500', className: 'border-green-500 text-green-600 bg-green-50' },
  cancelled: { label: 'Cancelled', dot: 'bg-red-500', className: 'border-red-500 text-red-600 bg-red-50' },
  refunded: { label: 'Refunded', dot: 'bg-gray-500', className: 'border-gray-500 text-gray-600 bg-gray-50' },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_MAP[status];
  return (
    <Badge variant="outline" className={cn('capitalize', meta.className)}>
      <span className={cn('w-2 h-2 rounded-full mr-1.5', meta.dot)} />
      {meta.label}
    </Badge>
  );
}
