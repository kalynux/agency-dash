import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CodDiscrepancyStatus } from '@/types/cod-cash.types';

/** Colour per status; the label lives in `cash:discrepancyStatus.*`, keyed by the enum. */
const STATUS_STYLE: Record<CodDiscrepancyStatus, { dot: string; className: string }> = {
  open: { dot: 'bg-red-500', className: 'border-red-500 text-red-600 bg-red-50' },
  resolved: { dot: 'bg-green-500', className: 'border-green-500 text-green-600 bg-green-50' },
  written_off: { dot: 'bg-gray-400', className: 'border-gray-400 text-gray-600 bg-gray-50' },
};

export function CodDiscrepancyStatusBadge({ status }: { status: CodDiscrepancyStatus }) {
  const { t } = useTranslation('cash');
  const style = STATUS_STYLE[status];
  return (
    <Badge variant="outline" className={cn(style.className)}>
      <span className={cn('w-2 h-2 rounded-full me-1.5', style.dot)} />
      {t(`discrepancyStatus.${status}` as 'discrepancyStatus.open')}
    </Badge>
  );
}
