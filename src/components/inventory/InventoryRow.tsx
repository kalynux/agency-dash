/**
 * One stored row, in both layouts.
 *
 * WHAT A ROW CAN AND CANNOT DO. The list response carries no `productId` (only the
 * detail does — see `InventoryDetail`), and all four write actions are keyed on
 * it. So a row cannot suspend, unsuspend, move a depot or raise a stock request;
 * it opens the sheet, which has the id, the room for the in-flight-redirect
 * warning and the room for the unsuspend blocker checklist.
 *
 * What a row CAN do for free is signpost. `catalogStock.pendingRequest.id`,
 * `productStatus` and `suspension` are all on the row, so the pending badge links
 * straight to the request and the suspended badge needs no fetch at all.
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Ban, Clock3, MapPinOff, Package, Store, Warehouse } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CatalogStockCell, StockLevelCell, StockSourceBadge } from '@/components/inventory/StockLevels';
import { cn } from '@/lib/utils';
import { describeDepot, isSuspended } from '@/types/inventory.types';
import type { InventoryListItem } from '@/types/inventory.types';

/** Product identity — picture, name, variant, SKU. Shared by both layouts. */
export function ProductCell({ item }: { item: InventoryListItem }) {
  const { t } = useTranslation('inventory');
  return (
    <div className="flex items-start gap-3">
      {item.image ? (
        <img
          src={item.image.url}
          alt=""
          crossOrigin="use-credentials"
          className="h-10 w-10 flex-shrink-0 rounded-md border object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border bg-muted">
          <Package className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0">
        <div className="max-w-[16rem] truncate font-medium" title={item.productTitle ?? undefined}>
          {item.productTitle ?? (
            <span className="italic text-muted-foreground">{t('table.unnamedProduct')}</span>
          )}
        </div>
        {item.variantTitle && (
          <div className="truncate text-sm text-muted-foreground">{item.variantTitle}</div>
        )}
        {item.sku && <div className="truncate font-mono text-xs text-muted-foreground">{item.sku}</div>}
      </div>
    </div>
  );
}

/**
 * Which of OUR buildings holds it. A null depot is not "no location" — it is a
 * depot we deleted out from under the product, so it is flagged rather than left
 * blank.
 */
export function DepotCell({ item }: { item: InventoryListItem }) {
  const { t } = useTranslation('inventory');

  if (!item.location) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
        <MapPinOff className="h-3.5 w-3.5 flex-shrink-0" />
        {t('table.unassignedLocation')}
      </span>
    );
  }

  const name = describeDepot(item.location) ?? t('table.unnamedLocation');
  return (
    <span className="flex min-w-0 items-start gap-2">
      <Warehouse className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block max-w-[12rem] truncate text-sm" title={name}>
          {name}
        </span>
        {item.location.isPrimary && (
          <span className="block text-xs text-muted-foreground">{t('table.primaryDepot')}</span>
        )}
      </span>
    </span>
  );
}

export function VendorCell({ item }: { item: InventoryListItem }) {
  const { t } = useTranslation('inventory');
  return (
    <div className="flex items-start gap-2">
      <Store className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <div
        className="min-w-0 max-w-[12rem] truncate text-sm font-medium"
        title={item.vendor.businessName ?? undefined}
      >
        {item.vendor.businessName ?? (
          <span className="italic text-muted-foreground">{t('table.unnamedVendor')}</span>
        )}
      </div>
    </div>
  );
}

/**
 * State flags a row can raise on its own.
 *
 * Both come off fields the list already carries, so neither costs a fetch. The
 * pending badge is a `Link` rather than a button precisely because it can be:
 * `pendingRequest.id` is on the row.
 */
export function RowBadges({ item, className }: { item: InventoryListItem; className?: string }) {
  const { t } = useTranslation('inventory');
  const pending = item.catalogStock.pendingRequest;
  const suspended = isSuspended(item);

  if (!pending && !suspended) return null;

  return (
    <span className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {suspended && (
        <Badge
          variant="outline"
          className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
        >
          <Ban className="h-3 w-3" />
          {t('table.suspendedBadge')}
        </Badge>
      )}
      {pending && (
        <Link
          to={`/dashboard/inventory/requests?open=${pending.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex"
        >
          <Badge
            variant="outline"
            className={cn(
              'gap-1 transition-colors',
              pending.awaitingMyDecision
                ? 'border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                : 'hover:bg-muted',
            )}
          >
            <Clock3 className="h-3 w-3" />
            {pending.awaitingMyDecision
              ? t('table.awaitingYouBadge')
              : t('table.pendingBadge')}
          </Badge>
        </Link>
      )}
    </span>
  );
}

/** Desktop table row. */
export function InventoryTableRow({
  item,
  onOpen,
}: {
  item: InventoryListItem;
  onOpen: (id: string) => void;
}) {
  return (
    <tr
      className="cursor-pointer border-b transition-colors hover:bg-muted/50"
      onClick={() => onOpen(item.id)}
    >
      <td className="p-4">
        <ProductCell item={item} />
        <RowBadges item={item} className="mt-1.5" />
      </td>
      <td className="p-4">
        <VendorCell item={item} />
      </td>
      {/* Which of OUR depots holds it — the column this screen exists for. */}
      <td className="p-4">
        <DepotCell item={item} />
      </td>
      {/* The two quantities, deliberately in two columns. */}
      <td className="p-4">
        <CatalogStockCell item={item} />
      </td>
      <td className="p-4">
        <StockLevelCell item={item} />
      </td>
    </tr>
  );
}

/** Mobile card. */
export function InventoryCard({
  item,
  onOpen,
}: {
  item: InventoryListItem;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation('inventory');
  return (
    <div
      className="cursor-pointer p-4 transition-colors hover:bg-muted/50 active:bg-muted/50"
      onClick={() => onOpen(item.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <ProductCell item={item} />
        <StockSourceBadge source={item.source} className="flex-shrink-0" />
      </div>

      <RowBadges item={item} className="mt-2" />

      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <Store className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{item.vendor.businessName ?? t('table.unnamedVendor')}</span>
        </span>
        <span className="flex-shrink-0 text-muted-foreground">·</span>
        <DepotCell item={item} />
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-1">
        <div>
          <p className="text-xs text-muted-foreground">{t('table.agreed')}</p>
          <CatalogStockCell item={item} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('table.counted')}</p>
          <StockLevelCell item={item} />
        </div>
      </div>
    </div>
  );
}
