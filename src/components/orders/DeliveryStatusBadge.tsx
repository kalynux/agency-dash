import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FulfillmentStatus } from '@/types';

const STATUS_MAP: Record<FulfillmentStatus, { label: string; className: string }> = {
  unfulfilled: { label: 'Unfulfilled', className: 'border-slate-400 text-slate-600 bg-slate-50' },
  partial: { label: 'Partially Fulfilled', className: 'border-amber-500 text-amber-600 bg-amber-50' },
  fulfilled: { label: 'Fulfilled', className: 'border-green-500 text-green-600 bg-green-50' },
  restocked: { label: 'Restocked', className: 'border-gray-500 text-gray-600 bg-gray-50' },
};

export function DeliveryStatusBadge({ status }: { status: FulfillmentStatus }) {
  const meta = STATUS_MAP[status];
  return (
    <Badge variant="outline" className={cn(meta.className)}>
      {meta.label}
    </Badge>
  );
}
