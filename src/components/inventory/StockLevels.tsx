/**
 * The three numbers that describe one stored line: what is physically on our
 * shelves, what is already spoken for by in-flight orders, and what is left over.
 *
 * `available = onHand − reserved` is the number that answers "how much is
 * actually left", so it leads everywhere; `onHand` is the number a stock count
 * in the warehouse should match. Keeping both in one file is what stops a list
 * row and the detail sheet from disagreeing about which of the two "amount left"
 * means — a mistake that costs a real pick.
 *
 * See api-doc/agency/inventory.md.
 */

import { useTranslation } from 'react-i18next';
import { Boxes, Lock, PackageCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { STOCK_STATE_STYLE } from '@/components/inventory/stock-state';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { InventoryDetail, InventoryListItem } from '@/types/inventory.types';

// ─── List row ─────────────────────────────────────────────────────────────────

/**
 * Compact stock figures for a list row: the available count in the state's own
 * colour, with the reserved count beneath it only when something is actually
 * reserved — a "0 reserved" line on every row is chrome, not information.
 */
export function StockLevelCell({
  item,
  className,
}: {
  item: InventoryListItem;
  className?: string;
}) {
  const { t } = useTranslation('inventory');
  const style = STOCK_STATE_STYLE[item.stockState];

  return (
    <div className={cn('flex flex-col items-start gap-x-3 gap-y-0.5', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('cursor-help font-numeric text-base font-semibold', style.text)}>
            {formatNumber(item.available)}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[16rem] space-y-1">
          <p className="font-medium">{t('stock.availableTitle')}</p>
          <p>{t('stock.availableHint')}</p>
        </TooltipContent>
      </Tooltip>

      {item.reserved > 0 ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3 flex-shrink-0" />
          {t('stock.reservedOfOnHand', {
            reserved: formatNumber(item.reserved),
            onHand: formatNumber(item.onHand),
          })}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          {t('stock.onHandShort', { count: item.onHand })}
        </span>
      )}
    </div>
  );
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

/**
 * The two secondary tiles. The primary one (available) is written out inline in
 * the section below instead, because its figure is the only one that takes the
 * stock state's own colour — threading a fourth tone through here to serve a
 * single caller would hide that rule rather than express it.
 */
function StockTile({
  icon: Icon,
  label,
  value,
  caption,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  caption?: string;
  tone: 'neutral' | 'reserved';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        tone === 'reserved' && 'border-dashed',
        tone === 'neutral' && 'bg-muted/40',
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1 font-numeric text-lg font-bold tracking-tight">{value}</p>
      {caption && <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}

/**
 * The stock region of the detail sheet: available, on hand, reserved — in that
 * order, because "how much can I still promise" is the question the sheet is
 * usually opened to answer.
 */
export function StockLevelSection({ detail }: { detail: InventoryDetail }) {
  const { t } = useTranslation('inventory');
  const style = STOCK_STATE_STYLE[detail.stockState];

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('detail.stock')}
      </h3>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-1.5">
            <PackageCheck className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">{t('stock.available')}</p>
          </div>
          <p className={cn('mt-1 font-numeric text-lg font-bold tracking-tight', style.text)}>
            {formatNumber(detail.available)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('stock.availableCaption')}</p>
        </div>

        <StockTile
          icon={Boxes}
          tone="neutral"
          label={t('stock.onHand')}
          value={formatNumber(detail.onHand)}
          caption={t('stock.onHandCaption')}
        />

        <StockTile
          icon={Lock}
          tone="reserved"
          label={t('stock.reserved')}
          value={formatNumber(detail.reserved)}
          caption={
            detail.openShipmentCount > 0
              ? t('stock.reservedShipments', { count: detail.openShipmentCount })
              : t('stock.reservedCaption')
          }
        />
      </div>

      {/* The threshold is the vendor's, not ours — say so, or an agency reads a
          "low stock" badge as something it can go and fix itself. */}
      {detail.lowStockThreshold !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t('stock.thresholdHint', { count: detail.lowStockThreshold })}
        </p>
      )}
    </section>
  );
}
