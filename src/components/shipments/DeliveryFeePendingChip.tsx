import { useTranslation } from 'react-i18next';
import { Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** A delivery-fee change waits for the vendor — pickup is blocked until they answer. */
export function DeliveryFeePendingChip({ pending, className }: { pending?: boolean; className?: string }) {
  const { t } = useTranslation('shipments');
  if (pending !== true) return null;
  return (
    <Badge
      variant="outline"
      title={t('deliveryFee.pickupBlocked')}
      className={cn(
        'gap-1 font-normal text-amber-800 border-amber-300 dark:text-amber-300 dark:border-amber-800',
        className,
      )}
    >
      <Receipt className="w-3 h-3" /> {t('deliveryFee.pendingChip')}
    </Badge>
  );
}
