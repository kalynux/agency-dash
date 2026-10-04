import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeftRight,
  ClipboardCheck,
  Clock,
  Loader2,
  MapPin,
  MapPinOff,
  Package,
  PackageMinus,
  PackagePlus,
  Store,
  Truck,
  Warehouse,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { StockOverviewSection, StockSourceBadge } from '@/components/inventory/StockLevels';
import { InfoHint } from '@/components/common/InfoHint';
import { StorageFeePanel } from '@/components/inventory/StorageFeePanel';
import { SuspensionPanel } from '@/components/inventory/SuspensionPanel';
import { DepotMoveDialog } from '@/components/inventory/DepotMoveDialog';
import { MovementLedger } from '@/components/inventory/MovementLedger';
import {
  StockMovementDialog,
  type StockMovementKind,
} from '@/components/inventory/StockMovementDialog';
import { RaiseStockRequestDialog } from '@/components/inventory/RaiseStockRequestDialog';
import { inventoryService } from '@/services/inventory.service';
import { useIsMobile } from '@/hooks/use-mobile';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
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
  /** Which of the four counting verbs is open, if any. */
  const [movementKind, setMovementKind] = useState<StockMovementKind | null>(null);

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
   * Whose goods, and which of our buildings holds them — one card, two rows.
   * The depot's address is resolved live from the magazin, so a correction in
   * Account → Locations shows here immediately; it is printed as ONE line (the
   * full formatted address when there is one) rather than three.
   */
  const renderWhereWhose = (item: InventoryDetail) => {
    const depotName = item.location ? describeDepot(item.location) : null;
    const address = item.locationAddress?.formattedAddress || describeAddress(item.locationAddress);
    return (
      <div className="divide-y rounded-lg border">
        <div className="flex min-w-0 items-center gap-2 px-3 py-2.5 text-sm">
          <Store className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate font-medium" title={item.vendor.businessName ?? undefined}>
            {item.vendor.businessName ?? (
              <span className="italic text-muted-foreground">{t('detail.unnamedVendor')}</span>
            )}
          </span>
          <VerifiedBadge verified={item.vendor.verified} className="-ms-0.5 flex-shrink-0" />
        </div>

        {item.location ? (
          <div className="flex min-w-0 items-start gap-2 px-3 py-2.5">
            <Warehouse className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {depotName ?? (
                  <span className="italic text-muted-foreground">{t('detail.unnamedLocation')}</span>
                )}
                {item.location.isPrimary && (
                  <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                    {t('detail.primaryDepot')}
                  </span>
                )}
              </p>
              {address && <p className="mt-0.5 truncate text-xs text-muted-foreground" title={address}>{address}</p>}
            </div>
          </div>
        ) : (
          // The product names a depot we have since deleted. The goods exist; the
          // platform no longer knows which building — so it is flagged, never
          // silently attributed to the primary depot. Still a warning colour;
          // the explanation sits behind the ⓘ.
          <p className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400">
            <MapPinOff className="h-3.5 w-3.5 flex-shrink-0" />
            {t('detail.unassignedLocation')}
            <InfoHint title={t('detail.unassignedLocation')}>{t('detail.unassignedHint')}</InfoHint>
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
      {/* Header — picture, name, SKU, how the numbers were arrived at */}
      <div className="flex-shrink-0 px-5 pb-2 pe-12 pt-2">
        <div className="flex items-start gap-3">
          {/* `url` is nullable — see FileRef. Product media is public, so this
              falls through to the placeholder only defensively. */}
          {detail.image?.url ? (
            <img
              src={detail.image.url}
              alt=""
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
          {/* FIVE SECTIONS, IN THE ORDER THE QUESTIONS COME: how many (and the
              verbs that change it), what it bills, whose and where, whether it
              is on sale, what it looks like. Explanations live behind the ⓘ on
              each label; what stays on screen is figures, names and buttons. */}

          <StockOverviewSection
            detail={detail}
            onRaiseRequest={() => setRaiseOpen(true)}
            onOpenRequest={(requestId) => {
              onOpenChange(false);
              navigate(`/dashboard/inventory/requests?open=${requestId}`);
            }}
          >
            {/* The four things an operator can say about a shelf, directly under
                the figure each one changes. `Receive` leads on an uncounted row:
                a receipt is the only way a shelf becomes counted at all. */}
            {/* Two by two: four across a 28rem sheet cut "Receive" to "Recei…". */}
            <div className="grid grid-cols-2 gap-2 [&>button]:max-md:h-10">
              <Button
                size="sm"
                variant={detail.source === 'derived' ? 'default' : 'outline'}
                className="gap-1.5 px-2"
                onClick={() => setMovementKind('receipt')}
              >
                <PackagePlus className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{t('movements.receipt.action')}</span>
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 px-2" onClick={() => setMovementKind('count')}>
                <ClipboardCheck className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{t('movements.count.action')}</span>
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 px-2" onClick={() => setMovementKind('return')}>
                <PackageMinus className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{t('movements.return.action')}</span>
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 px-2" onClick={() => setMovementKind('transfer')}>
                <ArrowLeftRight className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{t('movements.transfer.action')}</span>
              </Button>
            </div>

            {/* Why the shelf and the catalogue disagree — opens on demand. */}
            <MovementLedger stockLevelId={detail.id} />
          </StockOverviewSection>

          {/* What this shelf bills — quoted by the API on the counted figure.
              Rendered whenever the block exists, so "we do not warehouse at all"
              is a state the panel can show rather than hide. */}
          {detail.storageFee && <StorageFeePanel fee={detail.storageFee} />}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('detail.whereWhose')}
            </h3>
            {renderWhereWhose(detail)}
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

          <SuspensionPanel detail={detail} onChanged={handleMutated} />

          {/* Every picture of this line, thumbnail first — the fastest way to
              recognise a box on a shelf. */}
          {detail.images.length > 1 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('detail.images')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {/* Skip any picture with no public URL rather than render a
                    broken tile — `FileRef.url` is nullable for the authorized
                    storage trees (api-doc/files/private-files.md). */}
                {detail.images
                  .filter((image) => image.url)
                  .map((image) => (
                    <img
                      key={image.id}
                      src={image.url!}
                      alt=""
                      className="h-16 w-16 rounded-md border object-cover"
                    />
                  ))}
              </div>
            </section>
          )}

          {detail.lastReconciledAt && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 flex-shrink-0" />
              {t('detail.lastReconciled', { when: formatDateTime(detail.lastReconciledAt) })}
            </p>
          )}
        </div>
      </div>

      {/* Sticky footer — the one place to go from a row to the work it drives. */}
      {/* On a phone: two equal thumb-sized halves, lifted clear of the gesture bar. */}
      <div className="grid flex-shrink-0 grid-cols-2 gap-2 border-t px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 md:flex md:flex-wrap md:items-center md:py-4">
        <Button asChild size="sm" variant="outline" className="gap-1.5 max-md:h-10 max-md:min-w-0">
          <Link
            to={`/dashboard/shipments?q=${encodeURIComponent(detail.sku ?? detail.productTitle ?? '')}`}
          >
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{t('detail.viewShipments')}</span>
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost" className="gap-1.5 max-md:h-10 max-md:min-w-0">
          <Link to="/dashboard/vendors/connections">
            <Store className="h-3.5 w-3.5" />
            <span className="truncate">{t('detail.viewVendor')}</span>
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
      {/* Keyed on the row AND the verb: switching from a receipt to a count has
          to clear the quantity box, because the two ask for different numbers
          and carrying "12" across would submit a figure nobody typed for the
          question being asked. */}
      <StockMovementDialog
        key={`movement-${detail.id}-${movementKind ?? 'none'}`}
        detail={detail}
        kind={movementKind}
        onClose={() => setMovementKind(null)}
        onRecorded={handleMutated}
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
          isMobile ? 'h-[90dvh] rounded-t-2xl' : 'w-full sm:max-w-md',
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
