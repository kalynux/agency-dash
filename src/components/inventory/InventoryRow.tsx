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
import { Ban, ChevronRight, Clock3, MapPinOff, Package, Store, Warehouse } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CatalogStockCell, StockLevelCell } from '@/components/inventory/StockLevels';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { cn } from '@/lib/utils';
import { describeDepot, isSuspended } from '@/types/inventory.types';
import type { InventoryListItem } from '@/types/inventory.types';

/** Product identity — picture, name, variant, SKU. Shared by both layouts. */
export function ProductCell({ item }: { item: InventoryListItem }) {
  const { t } = useTranslation('inventory');
  return (
    <div className="flex items-start gap-3">
      {/* `image.url` is nullable (an authorized storage tree has no public URL).
          Product media is public, so this only ever falls through defensively —
          to the same placeholder a picture-less SKU gets. */}
      {item.image?.url ? (
        <img
          src={item.image.url}
          alt=""
          className="h-10 w-10 flex-shrink-0 rounded-md border object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border bg-muted">
          <Package className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0">
        <div className="max-w-[14rem] truncate font-medium" title={item.productTitle ?? undefined}>
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
        <span className="block max-w-[10rem] truncate text-sm" title={name}>
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
      <div className="flex min-w-0 max-w-[10rem] items-center gap-1 text-sm font-medium">
        <span className="truncate" title={item.vendor.businessName ?? undefined}>
          {item.vendor.businessName ?? (
            <span className="italic text-muted-foreground">{t('table.unnamedVendor')}</span>
          )}
        </span>
        <VerifiedBadge verified={item.vendor.verified} />
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
      <td className="px-4 py-3">
        <ProductCell item={item} />
        <RowBadges item={item} className="mt-1.5" />
      </td>
      <td className="px-4 py-3">
        <VendorCell item={item} />
      </td>
      {/* Which of OUR depots holds it — the column this screen exists for. */}
      <td className="px-4 py-3">
        <DepotCell item={item} />
      </td>
      {/* The two quantities, deliberately in two columns. */}
      <td className="px-4 py-3">
        <CatalogStockCell item={item} />
      </td>
      <td className="px-4 py-3">
        <StockLevelCell item={item} />
      </td>
    </tr>
  );
}

/**
 * Mobile card — designed for the phone first, not a table row folded up.
 *
 * Three bands, read top to bottom in the order the questions come:
 *
 *   1. WHAT is it — picture, a two-line name, variant and SKU, and any state
 *      that needs attention (suspended, a change awaiting you).
 *   2. HOW MANY — the two quantities side by side in one panel, each under its
 *      own label and never merged.
 *   3. WHOSE and WHERE — vendor and depot, one line each, so a long business
 *      name or depot label truncates within the screen instead of pushing the
 *      card (and the whole page) sideways.
 *
 * No "Agreed to store" badge here: on a phone it competed with the name for the
 * top line, and the "Not counted" figure in band 2 already says the same thing.
 * The detail sheet still carries it.
 */
export function InventoryCard({
  item,
  onOpen,
}: {
  item: InventoryListItem;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation('inventory');
  const subline = [item.variantTitle, item.sku].filter(Boolean);

  return (
    <div
      role="button"
      tabIndex={0}
      className="cursor-pointer px-4 py-3.5 transition-colors hover:bg-muted/40 active:bg-muted/60 focus-visible:bg-muted/50 focus-visible:outline-none md:rounded-xl md:border"
      onClick={() => onOpen(item.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(item.id);
        }
      }}
    >
      {/* 1 — identity */}
      <div className="flex items-start gap-3">
        <ProductThumb item={item} className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[15px] font-medium leading-snug">
            {item.productTitle ?? (
              <span className="italic text-muted-foreground">{t('table.unnamedProduct')}</span>
            )}
          </p>
          {subline.length > 0 && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {item.variantTitle}
              {item.variantTitle && item.sku && <span className="mx-1">·</span>}
              {item.sku && <span className="font-mono">{item.sku}</span>}
            </p>
          )}
          <RowBadges item={item} className="mt-1.5" />
        </div>
        <ChevronRight
          aria-hidden
          className="mt-3 h-4 w-4 flex-shrink-0 text-muted-foreground/60 rtl:-scale-x-100"
        />
      </div>

      {/* 2 — the two quantities */}
      <div className="mt-3 grid grid-cols-2 divide-x rounded-lg bg-muted/50 py-2 rtl:divide-x-reverse">
        <div className="min-w-0 px-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('table.agreed')}
          </p>
          <CatalogStockCell item={item} className="mt-0.5" />
        </div>
        <div className="min-w-0 px-3">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('table.counted')}
          </p>
          <StockLevelCell item={item} className="mt-0.5" />
        </div>
      </div>

      {/* 3 — whose, and where */}
      <div className="mt-2.5 space-y-1 text-xs text-muted-foreground">
        <p className="flex min-w-0 items-center gap-1.5">
          <Store className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">
            {item.vendor.businessName ?? (
              <span className="italic">{t('table.unnamedVendor')}</span>
            )}
          </span>
          <VerifiedBadge verified={item.vendor.verified} className="-ms-0.5 flex-shrink-0" />
        </p>
        {item.location ? (
          <p className="flex min-w-0 items-center gap-1.5">
            <Warehouse className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">
              {describeDepot(item.location) ?? t('table.unnamedLocation')}
            </span>
            {item.location.isPrimary && (
              <span className="flex-shrink-0 rounded bg-muted px-1.5 py-px text-[10px] font-medium">
                {t('table.primaryDepot')}
              </span>
            )}
          </p>
        ) : (
          // A deleted depot is a problem to fix, so it keeps its warning colour.
          <p className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
            <MapPinOff className="h-3.5 w-3.5 flex-shrink-0" />
            {t('table.unassignedLocation')}
          </p>
        )}
      </div>
    </div>
  );
}

/** The row's picture, or the placeholder a picture-less SKU gets. */
function ProductThumb({ item, className }: { item: InventoryListItem; className?: string }) {
  return item.image?.url ? (
    <img
      src={item.image.url}
      alt=""
      className={cn('flex-shrink-0 rounded-lg border object-cover', className)}
    />
  ) : (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-lg border bg-muted',
        className,
      )}
    >
      <Package className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}
