import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CodDepositStatus } from '@/types/cod-cash.types';

/** Colour per status; the label lives in `cash:depositStatus.*`, keyed by the enum. */
const STATUS_STYLE: Record<CodDepositStatus, { dot: string; className: string }> = {
  declared: { dot: 'bg-yellow-500', className: 'border-yellow-500 text-yellow-600 bg-yellow-50' },
  confirmed: { dot: 'bg-green-500', className: 'border-green-500 text-green-600 bg-green-50' },
  rejected: { dot: 'bg-red-500', className: 'border-red-500 text-red-600 bg-red-50' },
};

export function CodDepositStatusBadge({ status }: { status: CodDepositStatus }) {
  const { t } = useTranslation('cash');
  const style = STATUS_STYLE[status];
  return (
    // No `capitalize`: casing belongs to the translation, and forcing it breaks
    // languages where a mid-sentence noun stays lower-case.
    <Badge variant="outline" className={cn(style.className)}>
      <span className={cn('w-2 h-2 rounded-full me-1.5', style.dot)} />
      {t(`depositStatus.${status}` as 'depositStatus.declared')}
    </Badge>
  );
}
