/**
 * How a stored row's quantities are printed — and, in Phase 1, deliberately not
 * printed.
 *
 * TWO DIFFERENT QUANTITIES, TWO DIFFERENT COMPONENTS. That separation is the
 * whole point of this file:
 *
 *   `CatalogStockCell` / `CatalogStockSection`  the AGREED quantity. Real, jointly
 *                                               governed, what the fee is quoted
 *                                               against.
 *   `StockLevelCell` / `StockLevelSection`      the COUNTED quantity. Structurally
 *                                               0 in Phase 1.
 *
 * A `derived` row's `quantityOnHand`/`quantityReserved` are `0` because nobody
 * counted a shelf, no order decrements them and no return restores them. So
 * rendering "0" would be a lie the agency can act on — it reads as "we hold none
 * of this" when the truth is "we agreed to store this and have never counted it".
 * Derived rows therefore show no counted number at all; `counted` rows get the
 * real three-figure treatment, and that switch is the only thing that has to
 * change when counting lands.
 *
 * Merging the two into one "stock" column would resurrect exactly the confusion
 * both the API and this file are shaped to prevent.
 *
 * See api-doc/agency/inventory.md.
 */

import { useTranslation } from 'react-i18next';
import { Boxes, HelpCircle, Infinity as InfinityIcon, Lock, PackageCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { InventoryDetail, InventoryListItem } from '@/types/inventory.types';

// ─── Source badge ─────────────────────────────────────────────────────────────

/**
 * "Agreed to store" — the honest label for a derived row. A counted row needs no
 * badge: its numbers speak for themselves.
 */
export function StockSourceBadge({
  source,
  className,
}: {
  source: InventoryListItem['source'];
  className?: string;
}) {
  const { t } = useTranslation('inventory');
  if (source !== 'derived') return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-400',
        className,
      )}
    >
      {t('derived.badge')}
    </Badge>
  );
}

// ─── List row ─────────────────────────────────────────────────────────────────

/**
 * Compact stock figures for a list row: the available count, with the reserved
 * count beneath it only when something is actually reserved — a "0 reserved"
 * line on every row is chrome, not information.
 */
export function StockLevelCell({
  item,
  className,
}: {
  item: InventoryListItem;
  className?: string;
}) {
  const { t } = useTranslation('inventory');

  if (item.source === 'derived') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex cursor-help items-center gap-1.5 text-sm text-muted-foreground',
              className,
            )}
          >
            <HelpCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {t('derived.notCounted')}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[18rem] space-y-1">
          <p className="font-medium">{t('derived.tooltipTitle')}</p>
          <p>{t('derived.tooltipBody')}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={cn('flex flex-col items-start gap-x-3 gap-y-0.5', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help font-numeric text-base font-semibold">
            {formatNumber(item.quantityAvailable)}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[16rem] space-y-1">
          <p className="font-medium">{t('stock.availableTitle')}</p>
          <p>{t('stock.availableHint')}</p>
        </TooltipContent>
      </Tooltip>

      {item.quantityReserved > 0 ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3 flex-shrink-0" />
          {t('stock.reservedOfOnHand', {
            reserved: formatNumber(item.quantityReserved),
            onHand: formatNumber(item.quantityOnHand),
          })}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          {t('stock.onHandShort', { count: item.quantityOnHand })}
        </span>
      )}
    </div>
  );
}

// ─── Agreed quantity (`catalogStock`) ─────────────────────────────────────────

/**
 * The AGREED quantity for a list row.
 *
 * This is `ProductVariant.stock` — a real number, unlike the counted pair above,
 * and the one the storage fee is quoted against. Neither we nor the vendor can
 * move it alone any more, which is why a pending request is surfaced right here:
 * the number on screen is a *claim under negotiation*, and hiding that would let
 * an agency read a figure the vendor has already asked to change.
 */
export function CatalogStockCell({
  item,
  className,
}: {
  item: InventoryListItem;
  className?: string;
}) {
  const { t } = useTranslation('inventory');
  const { quantity, isInfinite, pendingRequest } = item.catalogStock;

  return (
    <div className={cn('flex flex-col items-start gap-y-0.5', className)}>
      {isInfinite ? (
        // Only reachable on a legacy or suspended row — unlimited stock blocks
        // activation for a warehoused product. Flagged rather than printed as a
        // number, because there is no number to print.
        <span className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
          <InfinityIcon className="h-3.5 w-3.5 flex-shrink-0" />
          {t('catalogStock.unlimited')}
        </span>
      ) : quantity == null ? (
        <span className="text-sm text-muted-foreground">{t('catalogStock.unknown')}</span>
      ) : (
        <span className="font-numeric text-base font-semibold">{formatNumber(quantity)}</span>
      )}

      {pendingRequest && (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs',
            pendingRequest.awaitingMyDecision
              ? 'font-medium text-amber-600 dark:text-amber-400'
              : 'text-muted-foreground',
          )}
        >
          {t('catalogStock.pendingChange', {
            quantity: formatNumber(pendingRequest.requestedQuantity),
          })}
        </span>
      )}
    </div>
  );
}

/**
 * The agreed-quantity region of the detail sheet.
 *
 * Sits ABOVE the counted section deliberately: it is the figure that is real
 * today, so it should not read as a footnote to three zeroes.
 */
export function CatalogStockSection({
  detail,
  onRaiseRequest,
  onOpenRequest,
}: {
  detail: InventoryDetail;
  /** Propose a new absolute quantity. Absent while another request is open. */
  onRaiseRequest?: () => void;
  /** Jump to the open request. */
  onOpenRequest?: (requestId: string) => void;
}) {
  const { t } = useTranslation('inventory');
  const { quantity, isInfinite, pendingRequest } = detail.catalogStock;

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('catalogStock.title')}
      </h3>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{t('catalogStock.label')}</p>
            {isInfinite ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-lg font-bold text-amber-600 dark:text-amber-400">
                <InfinityIcon className="h-4 w-4 flex-shrink-0" />
                {t('catalogStock.unlimited')}
              </p>
            ) : (
              <p className="mt-1 font-numeric text-2xl font-bold tracking-tight">
                {quantity == null ? '—' : formatNumber(quantity)}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{t('catalogStock.caption')}</p>
          </div>
        </div>

        {pendingRequest ? (
          <button
            type="button"
            onClick={() => onOpenRequest?.(pendingRequest.id)}
            className="mt-3 flex w-full items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-start text-xs text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                {pendingRequest.awaitingMyDecision
                  ? t('catalogStock.pendingYours')
                  : t('catalogStock.pendingTheirs')}
              </span>
              <span className="block">
                {t('catalogStock.pendingDetail', {
                  from: quantity == null ? '—' : formatNumber(quantity),
                  to: formatNumber(pendingRequest.requestedQuantity),
                })}
              </span>
            </span>
          </button>
        ) : (
          onRaiseRequest && (
            <button
              type="button"
              onClick={onRaiseRequest}
              className="mt-3 text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              {t('catalogStock.propose')}
            </button>
          )
        )}
      </div>
    </section>
  );
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

/** One of the three figures on the detail sheet. */
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
  tone: 'primary' | 'neutral' | 'reserved';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        tone === 'primary' && 'border-primary/30 bg-primary/5',
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
 * The stock region of the detail sheet. For a derived row this is a single
 * explanatory panel rather than three zeroes; for a counted one it is available,
 * on hand, reserved — in that order, because "how much can I still promise" is
 * the question the sheet is usually opened to answer.
 */
export function StockLevelSection({ detail }: { detail: InventoryDetail }) {
  const { t } = useTranslation('inventory');

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('detail.stock')}
      </h3>

      {detail.source === 'derived' ? (
        <div className="rounded-lg border border-dashed p-3">
          <p className="text-sm font-medium">{t('derived.tooltipTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('derived.detailBody')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StockTile
            icon={PackageCheck}
            tone="primary"
            label={t('stock.available')}
            value={formatNumber(detail.quantityAvailable)}
            caption={t('stock.availableCaption')}
          />
          <StockTile
            icon={Boxes}
            tone="neutral"
            label={t('stock.onHand')}
            value={formatNumber(detail.quantityOnHand)}
            caption={t('stock.onHandCaption')}
          />
          <StockTile
            icon={Lock}
            tone="reserved"
            label={t('stock.reserved')}
            value={formatNumber(detail.quantityReserved)}
            caption={t('stock.reservedCaption')}
          />
        </div>
      )}
    </section>
  );
}
