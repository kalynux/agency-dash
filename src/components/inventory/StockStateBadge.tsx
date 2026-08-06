import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { STOCK_STATE_STYLE } from '@/components/inventory/stock-state';
import { cn } from '@/lib/utils';
import type { StockState } from '@/types/inventory.types';

export function StockStateBadge({ state, className }: { state: StockState; className?: string }) {
  // Callers that need the bare label (filter pills) read `inventory:stockState.*`
  // themselves — the same keys, so a pill and the badge it matches can't drift.
  const { t } = useTranslation('inventory');
  const style = STOCK_STATE_STYLE[state];
  return (
    <Badge variant="outline" className={cn(style.className, className)}>
      {t(`stockState.${state}` as 'stockState.in_stock')}
    </Badge>
  );
}
