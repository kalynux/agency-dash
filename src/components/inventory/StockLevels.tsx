/**
 * How a stored row's quantities are printed.
 *
 * TWO DIFFERENT QUANTITIES, NEVER MERGED:
 *
 *   `CatalogStockCell`  the AGREED quantity — the vendor's catalogue figure,
 *                       jointly governed (one proposes, the other approves).
 *   `StockLevelCell`    the COUNTED quantity — what is physically on our shelf,
 *                       moved by receipts, returns, counts and sales. Rent is
 *                       billed on this one.
 *
 * `StockOverviewSection` puts the two side by side on the detail sheet.
 *
 * A `derived` row has never been counted: its `quantityOnHand`/`quantityReserved`
 * are `0` because nobody has said, not because the shelf is empty. Rendering
 * "0" would be a claim the agency could act on, so a derived row shows "Not
 * counted" instead of a number.
 *
 * See api-doc/agency/inventory.md.
 */

import { useTranslation } from 'react-i18next';
import { Infinity as InfinityIcon, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { InfoHint } from '@/components/common/InfoHint';
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
 * Compact stock figures for a list row, under the "Counted on hand" heading — so
 * the headline IS `quantityOnHand`, never the available figure. What is free to
 * sell joins it beneath only when something is actually reserved: a "0 reserved"
 * line on every row is chrome, not information.
 *
 * On hand can go NEGATIVE (more sold than was ever booked in — the order path
 * does not refuse a checkout over our paperwork). That is printed as the real
 * number, in amber, with the fix behind the ⓘ: record a count.
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
    // Not a tooltip: a hover tooltip never opens from a tap, and a phone or a
    // tablet is where this list is read most. The ⓘ opens a sheet there.
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground',
          className,
        )}
      >
        {t('derived.notCounted')}
        <InfoHint title={t('derived.tooltipTitle')} label={t('derived.tooltipTitle')}>
          {t('derived.tooltipBody')}
        </InfoHint>
      </span>
    );
  }

  return (
    <div className={cn('flex flex-col items-start gap-y-0.5', className)}>
      <OnHandFigure onHand={item.quantityOnHand} className="text-base" />
      <ReservedLine available={item.quantityAvailable} reserved={item.quantityReserved} />
    </div>
  );
}

/** The counted figure itself — amber, with the remedy behind an ⓘ, when negative. */
function OnHandFigure({ onHand, className }: { onHand: number; className?: string }) {
  const { t } = useTranslation('inventory');
  if (onHand >= 0) {
    return <span className={cn('font-numeric font-semibold', className)}>{formatNumber(onHand)}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('font-numeric font-semibold text-amber-600 dark:text-amber-400', className)}>
        {formatNumber(onHand)}
      </span>
      <InfoHint title={t('stock.negativeTitle')} label={t('stock.negativeTitle')}>
        {t('stock.negativeHint')}
      </InfoHint>
    </span>
  );
}

/** "78 available · 6 reserved" — only when checkouts are actually holding some. */
function ReservedLine({ available, reserved }: { available: number; reserved: number }) {
  const { t } = useTranslation('inventory');
  if (reserved <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Lock className="h-3 w-3 flex-shrink-0" />
      {t('stock.availableReserved', {
        available: formatNumber(available),
        reserved: formatNumber(reserved),
      })}
    </span>
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

// ─── Detail sheet ─────────────────────────────────────────────────────────────

/**
 * The one Stock region of the detail sheet: the AGREED and the COUNTED figure
 * side by side — never merged, each under its own label — with the shelf's
 * verbs passed in as `children` directly beneath, because each verb exists to
 * change exactly the counted figure.
 *
 * It used to be two sections, three tiles and three paragraphs. The
 * explanations now live behind each label's ⓘ; what stays on screen is the two
 * numbers, the one line that qualifies each, and the pending change if there is
 * one — the figure on screen is a claim under negotiation, so that is never
 * hidden.
 */
export function StockOverviewSection({
  detail,
  onRaiseRequest,
  onOpenRequest,
  children,
}: {
  detail: InventoryDetail;
  /** Propose a new absolute quantity. Absent while another request is open. */
  onRaiseRequest?: () => void;
  /** Jump to the open request. */
  onOpenRequest?: (requestId: string) => void;
  /** The movement verbs and the ledger toggle. */
  children?: React.ReactNode;
}) {
  const { t } = useTranslation('inventory');
  const { quantity, isInfinite, pendingRequest } = detail.catalogStock;
  const uncounted = detail.source === 'derived';

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('stock.sectionTitle')}
      </h3>

      <div className="grid grid-cols-2 divide-x rounded-lg border rtl:divide-x-reverse">
        {/* Agreed — the vendor's catalogue figure, changed only by a request. */}
        <div className="min-w-0 p-3">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <span className="truncate">{t('table.agreed')}</span>
            <InfoHint label={t('catalogStock.title')} title={t('catalogStock.title')}>
              {t('catalogStock.caption')}
            </InfoHint>
          </p>
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
          {!pendingRequest && onRaiseRequest && (
            <button
              type="button"
              onClick={onRaiseRequest}
              className="mt-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              {t('catalogStock.proposeShort')}
            </button>
          )}
        </div>

        {/* Counted — what is physically on this shelf. */}
        <div className="min-w-0 p-3">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <span className="truncate">{t('table.counted')}</span>
            {uncounted && (
              <InfoHint label={t('derived.tooltipTitle')} title={t('derived.tooltipTitle')}>
                {t('derived.detailBody')}
              </InfoHint>
            )}
          </p>
          {uncounted ? (
            <p className="mt-1.5 text-sm font-medium text-muted-foreground">{t('derived.notCounted')}</p>
          ) : (
            <div className="mt-1 flex flex-col items-start gap-0.5">
              <OnHandFigure onHand={detail.quantityOnHand} className="text-2xl tracking-tight" />
              <ReservedLine available={detail.quantityAvailable} reserved={detail.quantityReserved} />
            </div>
          )}
        </div>
      </div>

      {pendingRequest && (
        <button
          type="button"
          onClick={() => onOpenRequest?.(pendingRequest.id)}
          className="mt-2 flex w-full items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-start text-xs text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950"
        >
          <span className="min-w-0 font-medium">
            {pendingRequest.awaitingMyDecision
              ? t('catalogStock.pendingYours')
              : t('catalogStock.pendingTheirs')}
          </span>
          <span className="flex-shrink-0 font-numeric">
            {t('catalogStock.pendingArrow', {
              from: quantity == null ? '—' : formatNumber(quantity),
              to: formatNumber(pendingRequest.requestedQuantity),
            })}
          </span>
        </button>
      )}

      {children && <div className="mt-3 space-y-2">{children}</div>}
    </section>
  );
}
