import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { SHIPMENT_STATUS_STYLE } from '@/components/shipments/shipment-status';
import { cn } from '@/lib/utils';
import type { ShipmentStatus } from '@/types/shipment.types';

export function ShipmentStatusBadge({ status, className }: { status: ShipmentStatus; className?: string }) {
  // Callers that need the bare label (filter pills) read `shipments:status.*`
  // themselves — the same keys, so a pill and the badge it matches can't drift.
  const { t } = useTranslation('shipments');
  const label = t(`status.${status}` as 'status.pending');
  const style = SHIPMENT_STATUS_STYLE[status];
  return (
    <Badge variant="outline" className={cn(style.className, className)}>
      <span className={cn('w-2 h-2 rounded-full me-1.5', style.dot)} />
      {label}
    </Badge>
  );
}
