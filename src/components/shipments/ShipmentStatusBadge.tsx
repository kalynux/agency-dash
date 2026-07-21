import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ShipmentStatus } from '@/types/shipment.types';

const STATUS_MAP: Record<ShipmentStatus, { label: string; dot: string; className: string }> = {
  pending: {
    label: 'Pending',
    dot: 'bg-muted-foreground',
    className: 'text-muted-foreground bg-muted border-border',
  },
  assigned: {
    label: 'Assigned',
    dot: 'bg-blue-500',
    className: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800',
  },
  handing_over: {
    label: 'Handing Over',
    dot: 'bg-amber-500',
    className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  },
  picked_up: {
    label: 'Picked Up',
    dot: 'bg-indigo-500',
    className: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-950 dark:border-indigo-800',
  },
  in_transit: {
    label: 'In Transit',
    dot: 'bg-purple-500',
    className: 'text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950 dark:border-purple-800',
  },
  agent_delivered: {
    label: 'Awaiting Confirmation',
    dot: 'bg-amber-500',
    className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  },
  delivered: {
    label: 'Delivered',
    dot: 'bg-emerald-500',
    className: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800',
  },
  failed: {
    label: 'Failed',
    dot: 'bg-destructive',
    className: 'text-destructive bg-destructive/10 border-destructive/20',
  },
  returned: {
    label: 'Returned',
    dot: 'bg-muted-foreground',
    className: 'text-muted-foreground bg-muted border-border',
  },
  rejected: {
    label: 'Rejected',
    dot: 'bg-destructive',
    className: 'text-destructive bg-destructive/10 border-destructive/20',
  },
  pending_agency_reassignment: {
    label: 'Reassigning',
    dot: 'bg-amber-500',
    className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  },
};

export function ShipmentStatusBadge({ status, className }: { status: ShipmentStatus; className?: string }) {
  const meta = STATUS_MAP[status];
  return (
    <Badge variant="outline" className={cn(meta.className, className)}>
      <span className={cn('w-2 h-2 rounded-full mr-1.5', meta.dot)} />
      {meta.label}
    </Badge>
  );
}
