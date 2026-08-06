import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownRight,
  ArrowUpRight,
  Barcode,
  Clock,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Scale,
  Store,
  Warehouse,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StockStateBadge } from '@/components/inventory/StockStateBadge';
import { StockLevelSection } from '@/components/inventory/StockLevels';
import { inventoryService } from '@/services/inventory.service';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useIsMobile } from '@/hooks/use-mobile';
import { getApiErrorMessage } from '@/lib/errors';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { tx } from '@/i18n/tx';
import { cn } from '@/lib/utils';
import { describeAddress } from '@/types/shipment.types';
import { describeLocation } from '@/types/inventory.types';
import type { InventoryDetail, InventoryLocationDetail } from '@/types/inventory.types';

export interface InventoryDetailSheetProps {
  /** Line to show. Null closes without a fetch. */
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Full detail for one stored line.
 *
 * A right-side panel on desktop and a bottom sheet on mobile — one body, one
 * container component, two `side` values. Unlike the shipment sheet (a centred
 * modal on desktop) this one deliberately stays at the edge: inventory is read
 * while scanning the list, and a side panel leaves the rows it came from visible
 * so you can move down the list without re-finding your place.
 */
export function InventoryDetailSheet({ itemId, open, onOpenChange }: InventoryDetailSheetProps) {
  const { t } = useTranslation(['inventory', 'common']);
  const isMobile = useIsMobile();
  const [detail, setDetail] = useState<InventoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Our own storage pricing, for the "what this line costs the vendor" line.
  // It is already on the session, so showing it costs no extra request.
  const storagePricing = useOnboarding().session?.role_entity?.policies?.pricing?.storage_based;

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
   * One location row. `quantity` is what sits *here*; the sheet's top-level
   * figures are the sum across every row, so a single-location line reads the
   * same either way and a split one is obvious at a glance.
   */
  const renderLocation = (location: InventoryLocationDetail) => {
    const name = describeLocation(location);
    const line = describeAddress(location.address);
    return (
      <div key={location.locationId} className="rounded-lg border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <Warehouse className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {name ?? (
                  <span className="italic text-muted-foreground">{t('detail.unnamedLocation')}</span>
                )}
              </p>
              {line && <p className="mt-0.5 text-xs text-muted-foreground">{line}</p>}
              {location.address?.formattedAddress && (
                <p className="mt-0.5 text-xs text-muted-foreground/80">
                  {location.address.formattedAddress}
                </p>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 text-end">
            <p className="font-numeric text-base font-semibold">
              {formatNumber(location.quantity)}
            </p>
            <p className="text-xs text-muted-foreground">{t('detail.units')}</p>
          </div>
        </div>
        {location.lastMovementAt && (
          <p className="mt-2 flex items-center gap-1 border-t pt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 flex-shrink-0" />
            {t('detail.lastMoved', { when: formatDateTime(location.lastMovementAt) })}
          </p>
        )}
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
      {/* Header — picture, name, SKU, state */}
      <div className="flex-shrink-0 px-5 pb-2 pr-12 pt-2">
        <div className="flex items-start gap-3">
          {detail.image ? (
            <img
              src={detail.image.url}
              alt=""
              crossOrigin="use-credentials"
              className="h-14 w-14 flex-shrink-0 rounded-md border object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md border bg-muted">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base leading-tight">
              {detail.title ?? (
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
              <StockStateBadge state={detail.stockState} />
              {/* A line we still hold whose vendor has archived the product is
                  dead stock — it will never be ordered again, but it keeps
                  occupying a shelf and accruing the per-SKU storage fee. */}
              {detail.productStatus === 'archived' && (
                <Badge variant="outline" className="border-destructive/30 text-destructive">
                  {t('detail.archivedProduct')}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <Separator className="flex-shrink-0" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-5 px-5 py-4">
          <StockLevelSection detail={detail} />

          {/* Where it is — the question this screen exists to answer. */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('detail.locations')}
            </h3>
            {detail.locations.length > 0 ? (
              <div className="space-y-2">{detail.locations.map(renderLocation)}</div>
            ) : (
              // Reachable: a line we hold zero of still exists on the list (the
              // vendor's stock ran out), and no location holds a unit of it.
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {t('detail.noLocations')}
              </p>
            )}
            <Link
              to="/dashboard/account/locations"
              className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              {t('detail.manageLocations')}
            </Link>
          </section>

          {/* Whose goods these are. Warehousing someone else's stock means the
              phone number matters as much as the count. */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('detail.vendor')}
            </h3>
            <div className="space-y-1 rounded-lg bg-muted/50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Store className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate" title={detail.vendor.businessName}>
                  {detail.vendor.businessName}
                </span>
              </p>
              {detail.vendor.phone && (
                <a
                  href={`tel:${detail.vendor.phone}`}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  <Phone className="h-3 w-3 flex-shrink-0" />
                  {detail.vendor.phone}
                </a>
              )}
              {detail.vendor.email && (
                <a
                  href={`mailto:${detail.vendor.email}`}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <span className="min-w-0 truncate">{detail.vendor.email}</span>
                </a>
              )}
            </div>
          </section>

          {/* What holding this line is worth to us. `monthly_storage_fee_per_sku`
              is charged per SKU per month, so one line = one charge regardless of
              how many units or how many locations it is spread across. */}
          {storagePricing?.enabled && storagePricing.monthly_storage_fee_per_sku > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('detail.storageFee')}
              </h3>
              <div className="rounded-lg border border-dashed p-3">
                <p className="font-numeric text-base font-semibold">
                  {t('detail.storageFeeAmount', {
                    amount: formatCurrency(storagePricing.monthly_storage_fee_per_sku),
                  })}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('detail.storageFeeCaption')}
                </p>
              </div>
            </section>
          )}

          {/* Product facts a picker needs at the shelf. */}
          {(detail.category || detail.weightGrams !== null || detail.barcode || detail.storedSince) && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('detail.product')}
              </h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {detail.category && (
                  <>
                    <dt className="text-muted-foreground">{t('detail.category')}</dt>
                    <dd className="text-end">{detail.category}</dd>
                  </>
                )}
                {detail.weightGrams !== null && (
                  <>
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <Scale className="h-3.5 w-3.5 flex-shrink-0" />
                      {t('detail.weight')}
                    </dt>
                    <dd className="text-end font-numeric">
                      {t('detail.weightGrams', { grams: formatNumber(detail.weightGrams) })}
                    </dd>
                  </>
                )}
                {detail.barcode && (
                  <>
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <Barcode className="h-3.5 w-3.5 flex-shrink-0" />
                      {t('detail.barcode')}
                    </dt>
                    <dd className="text-end font-mono text-xs">{detail.barcode}</dd>
                  </>
                )}
                {detail.storedSince && (
                  <>
                    <dt className="text-muted-foreground">{t('detail.storedSince')}</dt>
                    <dd className="text-end">{formatDate(detail.storedSince)}</dd>
                  </>
                )}
              </dl>
            </section>
          )}

          {/* Why the count is what it is. Read top-down, this is the reconciliation
              trail between the last physical count and today's number. */}
          {detail.movements.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('detail.movements')}
              </h3>
              <div className="space-y-2.5">
                {detail.movements.map((movement) => {
                  const isInbound = movement.delta > 0;
                  return (
                    <div key={movement.id} className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full',
                          isInbound
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-destructive/10 text-destructive',
                        )}
                      >
                        {isInbound ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm">
                            {tx(t, `inventory:movement.${movement.operation}`)}
                          </span>
                          <span
                            className={cn(
                              'flex-shrink-0 font-numeric text-sm font-semibold',
                              isInbound
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-destructive',
                            )}
                          >
                            {isInbound ? '+' : ''}
                            {formatNumber(movement.delta)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(movement.occurredAt)}
                          {movement.metadata?.reason ? ` · ${movement.metadata.reason}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Sticky footer — the one place to go from a line to the work it drives. */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-t px-5 py-4">
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to={`/dashboard/shipments?q=${encodeURIComponent(detail.sku ?? detail.title ?? '')}`}>
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
