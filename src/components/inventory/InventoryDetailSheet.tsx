import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, Loader2, MapPin, MapPinOff, Package, Store, Truck, Warehouse } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  CatalogStockSection,
  StockLevelSection,
  StockSourceBadge,
} from '@/components/inventory/StockLevels';
import { StorageFeePanel } from '@/components/inventory/StorageFeePanel';
import { SuspensionPanel } from '@/components/inventory/SuspensionPanel';
import { DepotMoveDialog } from '@/components/inventory/DepotMoveDialog';
import { RaiseStockRequestDialog } from '@/components/inventory/RaiseStockRequestDialog';
import { inventoryService } from '@/services/inventory.service';
import { useIsMobile } from '@/hooks/use-mobile';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { describeAddress } from '@/types/shipment.types';
import { describeDepot } from '@/types/inventory.types';
import type { InventoryDetail } from '@/types/inventory.types';

export interface InventoryDetailSheetProps {
  /** Stock-level ROW id to show — not a variant id. Null closes without a fetch. */
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * A write here changed something the list is showing — a depot, a status, or a
   * pending request. The list reloads rather than patching a row, because a depot
   * move retires the row and creates a new one with a different id.
   */
  onMutated?: () => void;
}

/**
 * Full detail for one stored row — one SKU at one depot.
 *
 * A right-side panel on desktop and a bottom sheet on mobile — one body, one
 * container component, two `side` values. Unlike the shipment sheet (a centred
 * modal on desktop) this one deliberately stays at the edge: inventory is read
 * while scanning the list, and a side panel leaves the rows it came from visible
 * so you can move down the list without re-finding your place.
 */
export function InventoryDetailSheet({
  itemId,
  open,
  onOpenChange,
  onMutated,
}: InventoryDetailSheetProps) {
  const { t } = useTranslation(['inventory', 'common']);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<InventoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [depotOpen, setDepotOpen] = useState(false);
  const [raiseOpen, setRaiseOpen] = useState(false);

  const load = useCallback(async (id: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await inventoryService.getById(id);
      setDetail(data);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && itemId) load(itemId);
    if (!open) {
      setDetail(null);
      setLoadError(null);
    }
  }, [open, itemId, load]);

  /**
   * A write landed and THIS ROW SURVIVED it — a suspension, an unsuspension, a
   * raised stock request. Re-read the row and tell the list.
   *
   * A storage-suspended product deliberately keeps its rows: the goods are still
   * in the building, and the unsuspend button lives on this screen.
   */
  const handleMutated = () => {
    if (itemId) load(itemId);
    onMutated?.();
  };

  /**
   * A depot move, which RETIRES this row and creates a new one under a different
   * id (api-doc/agency/inventory.md §6). So the sheet closes rather than
   * re-reading `itemId` — that fetch would 404 with
   * `INVENTORY_STOCK_LEVEL_NOT_FOUND` and show the agency an error for a move
   * that actually succeeded.
   */
  const handleRowRetired = () => {
    onOpenChange(false);
    onMutated?.();
  };

  /**
   * The depot this row sits at, with the address resolved live from the magazin
   * — so an address corrected in Account → Locations shows here immediately.
   */
  const renderDepot = (item: InventoryDetail) => {
    if (!item.location) {
      // The product names a depot we have since deleted. The goods exist; the
      // platform no longer knows which building — which is exactly why this is
      // flagged instead of silently attributed to the primary depot.
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
            <MapPinOff className="h-3.5 w-3.5 flex-shrink-0" />
            {t('detail.unassignedLocation')}
          </p>
          <p className="mt-1 text-xs text-amber-700/90 dark:text-amber-400/90">
            {t('detail.unassignedHint')}
          </p>
        </div>
      );
    }

    const name = describeDepot(item.location);
    const line = describeAddress(item.locationAddress);
    return (
      <div className="rounded-lg border p-3">
        <div className="flex min-w-0 items-start gap-2">
          <Warehouse className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {name ?? (
                <span className="italic text-muted-foreground">{t('detail.unnamedLocation')}</span>
              )}
              {item.location.isPrimary && (
                <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                  {t('detail.primaryDepot')}
                </span>
              )}
            </p>
            {line && <p className="mt-0.5 text-xs text-muted-foreground">{line}</p>}
            {item.locationAddress?.formattedAddress && (
              <p className="mt-0.5 text-xs text-muted-foreground/80">
                {item.locationAddress.formattedAddress}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const body = isLoading ? (
    <>
      <SheetTitle className="sr-only">{t('detail.srTitle')}</SheetTitle>
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('detail.loading')}
      </div>
    </>
  ) : loadError ? (
    <>
      <SheetTitle className="sr-only">{t('detail.srTitle')}</SheetTitle>
      <div className="py-16 text-center">
        <p className="mb-4 text-sm text-muted-foreground">{loadError}</p>
        <Button variant="outline" onClick={() => itemId && load(itemId)}>
          {t('common:actions.retry')}
        </Button>
      </div>
    </>
  ) : detail ? (
    <>
      {/* Header — picture, name, SKU, how the numbers were arrived at */}
      <div className="flex-shrink-0 px-5 pb-2 pr-12 pt-2">
        <div className="flex items-start gap-3">
          {detail.image ? (
            <img
              src={detail.image.url}
              alt=""
              crossOrigin="anonymous"
              className="h-14 w-14 flex-shrink-0 rounded-md border object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md border bg-muted">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base leading-tight">
              {detail.productTitle ?? (
                <span className="italic text-muted-foreground">{t('detail.unnamedProduct')}</span>
              )}
            </SheetTitle>
            {detail.variantTitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{detail.variantTitle}</p>
            )}
            {detail.sku && (
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">{detail.sku}</p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StockSourceBadge source={detail.source} />
            </div>
          </div>
        </div>
      </div>

      <Separator className="flex-shrink-0" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-5 px-5 py-4">
          {/* The AGREED quantity first: it is the figure that is real today, so it
              must not read as a footnote to the counted section's zeroes. */}
          <CatalogStockSection
            detail={detail}
            onRaiseRequest={() => setRaiseOpen(true)}
            onOpenRequest={(requestId) => {
              onOpenChange(false);
              navigate(`/dashboard/inventory/requests?open=${requestId}`);
            }}
          />

          <StockLevelSection detail={detail} />

          <SuspensionPanel detail={detail} onChanged={handleMutated} />

          {/* Where it is — the question this screen exists to answer. */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('detail.location')}
            </h3>
            {renderDepot(detail)}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDepotOpen(true)}>
                <Truck className="h-3.5 w-3.5" />
                {t('depot.moveAction')}
              </Button>
              <Link
                to="/dashboard/account/locations"
                className="text-xs font-medium text-primary hover:underline"
              >
                {t('detail.manageLocations')}
              </Link>
            </div>
          </section>

          {/* Whose goods these are. Warehousing someone else's stock means the
              vendor is who you call about it. */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('detail.vendor')}
            </h3>
            <p className="flex items-center gap-1.5 rounded-lg bg-muted/50 p-3 text-sm font-medium">
              <Store className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate" title={detail.vendor.businessName ?? undefined}>
                {detail.vendor.businessName ?? (
                  <span className="italic text-muted-foreground">{t('detail.unnamedVendor')}</span>
                )}
              </span>
            </p>
          </section>

          {/* Every picture of this line, thumbnail first — the fastest way to
              recognise a box on a shelf. */}
          {detail.images.length > 1 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('detail.images')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {detail.images.map((image) => (
                  <img
                    key={image.id}
                    src={image.url}
                    alt=""
                    crossOrigin="anonymous"
                    className="h-16 w-16 rounded-md border object-cover"
                  />
                ))}
              </div>
            </section>
          )}

          {/* What holding this line is worth to us — quoted by the API against
              the AGREED quantity, not recomputed here from the session's policy
              blob. Rendered whenever the block exists, so "we do not warehouse at
              all" is a state the panel can show rather than one it hides behind a
              falsy rate. */}
          {detail.storageFee && <StorageFeePanel fee={detail.storageFee} />}

          {detail.lastReconciledAt && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 flex-shrink-0" />
              {t('detail.lastReconciled', { when: formatDateTime(detail.lastReconciledAt) })}
            </p>
          )}
        </div>
      </div>

      {/* Sticky footer — the one place to go from a row to the work it drives. */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-t px-5 py-4">
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link
            to={`/dashboard/shipments?q=${encodeURIComponent(detail.sku ?? detail.productTitle ?? '')}`}
          >
            <MapPin className="h-3.5 w-3.5" />
            {t('detail.viewShipments')}
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost" className="gap-1.5">
          <Link to="/dashboard/vendors/connections">
            <Store className="h-3.5 w-3.5" />
            {t('detail.viewVendor')}
          </Link>
        </Button>
      </div>

      {/* Both act on `detail.productId` / `detail.variantId`, which is why they
          are mounted here and not on a list row — only the detail carries those.
          Keyed on the row so opening the sheet on a DIFFERENT SKU remounts them:
          each seeds its initial state from `detail` once, and without the key the
          depot radio and the quantity box would still hold the previous row's. */}
      <DepotMoveDialog
        key={`depot-${detail.id}`}
        detail={detail}
        open={depotOpen}
        onOpenChange={setDepotOpen}
        onMoved={handleRowRetired}
      />
      <RaiseStockRequestDialog
        key={`raise-${detail.id}`}
        detail={detail}
        open={raiseOpen}
        onOpenChange={setRaiseOpen}
        onRaised={handleMutated}
      />
    </>
  ) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        aria-describedby={undefined}
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0',
          // A bottom sheet with `h-auto` gives the flex body no bounded height to
          // scroll within, so the header/footer would not pin. Both sides get a
          // definite height for the same reason.
          isMobile ? 'h-[90vh] rounded-t-2xl' : 'w-full sm:max-w-md',
        )}
      >
        {isMobile && (
          <div className="mx-auto mb-1 mt-2 h-1 w-10 flex-shrink-0 rounded-full bg-muted" />
        )}
        {body}
      </SheetContent>
    </Sheet>
  );
}
