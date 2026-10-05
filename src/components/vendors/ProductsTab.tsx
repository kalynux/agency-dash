import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, MapPin, Package, PackageX, Store, Warehouse, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FilterOptionGroup, FilterSection, SearchFilterBar } from '@/components/common/SearchFilterBar';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { agencyNetworkService } from '@/services/agency-network.service';
import { getApiErrorMessage } from '@/lib/errors';
import { tx } from '@/i18n/tx';
import { cn } from '@/lib/utils';
import { usePageRefresh } from '@/store/pageRefresh.store';
import {
  DELIVERABLE_PRODUCT_STATUSES,
  type DeliverableProduct,
  type DeliverableProductPickup,
  type DeliverableProductSource,
  type DeliverableProductStatus,
  type DeliverableProductStock,
  type DeliverableProductStockDepot,
  type DeliverableProductsMeta,
  type DeliverableProductVendor,
  type ListDeliverableProductsParams,
} from '@/types/agency-network.types';
import type { FileRef } from '@/types/file.types';
import type { ProductCategoryRef } from '@/types/product-category.types';

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 350;
/** The API caps `search` at 100 characters. */
const MAX_SEARCH_CHARS = 100;

type SourceFilter = DeliverableProductSource | 'all';
type StatusFilter = DeliverableProductStatus | 'all';
type SortOption = 'newest' | 'oldest' | 'titleAsc' | 'titleDesc';

const SORTS: Record<SortOption, Pick<ListDeliverableProductsParams, 'sortBy' | 'sortDir'>> = {
  newest: { sortBy: 'createdAt', sortDir: 'desc' },
  oldest: { sortBy: 'createdAt', sortDir: 'asc' },
  titleAsc: { sortBy: 'title', sortDir: 'asc' },
  titleDesc: { sortBy: 'title', sortDir: 'desc' },
};

const STATUS_CLASS: Record<string, string> = {
  active: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800',
  pending_review: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  suspended: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800',
};

const EMPTY_META: DeliverableProductsMeta = { total: 0, page: 1, limit: PAGE_LIMIT, pages: 1, totalPages: 1 };

/** A filter picked by clicking a chip or a vendor name, kept with its label for the pill. */
interface PickedFilter {
  id: string;
  label: string;
}

/** Store name, else the vendor's own display name. `businessName` is `''` without a store. */
function vendorName(vendor: DeliverableProductVendor): string | null {
  return vendor.businessName || vendor.displayName || null;
}

/**
 * Vendors → Products: every physical product we're set up to deliver, either
 * because the vendor picked us on the product (`own_override`) or because we
 * are that vendor's default agency (`vendor_default`). Read-only — both are
 * configured on the vendor side.
 *
 * Search, filters, sorting and paging all run server-side on
 * `GET /agency/products`, and each row names its own vendor.
 */
export function ProductsTab() {
  const { t } = useTranslation(['vendors', 'common']);
  const [products, setProducts] = useState<DeliverableProduct[]>([]);
  const [meta, setMeta] = useState<DeliverableProductsMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [source, setSourceValue] = useState<SourceFilter>('all');
  const [status, setStatusValue] = useState<StatusFilter>('all');
  const [sort, setSortValue] = useState<SortOption>('newest');
  const [category, setCategoryValue] = useState<PickedFilter | null>(null);
  const [vendor, setVendorValue] = useState<PickedFilter | null>(null);
  const [page, setPage] = useState(1);

  // Any change to what's asked for starts back on page 1.
  const setSource = (v: SourceFilter) => { setSourceValue(v); setPage(1); };
  const setStatus = (v: StatusFilter) => { setStatusValue(v); setPage(1); };
  const setSort = (v: SortOption) => { setSortValue(v); setPage(1); };
  const setCategory = (v: PickedFilter | null) => { setCategoryValue(v); setPage(1); };
  const setVendor = (v: PickedFilter | null) => { setVendorValue(v); setPage(1); };

  // Debounce typing into the query the API runs.
  useEffect(() => {
    const next = search.trim().slice(0, MAX_SEARCH_CHARS);
    if (next === appliedSearch) return;
    const timer = setTimeout(() => {
      setAppliedSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, appliedSearch]);

  const params = useMemo<ListDeliverableProductsParams>(
    () => ({
      page,
      limit: PAGE_LIMIT,
      search: appliedSearch || undefined,
      source: source === 'all' ? undefined : source,
      status: status === 'all' ? undefined : status,
      categoryId: category?.id,
      vendorId: vendor?.id,
      ...SORTS[sort],
    }),
    [page, appliedSearch, source, status, category, vendor, sort],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await agencyNetworkService.listProducts(params);
        if (cancelled) return;
        setProducts(res.data);
        setMeta(res.meta);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, reloadKey]);

  const load = useCallback(() => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  usePageRefresh(load, loading);

  // A new query shows its spinner straight away, not after the old rows linger.
  const requestKey = JSON.stringify(params);
  const [shownKey, setShownKey] = useState(requestKey);
  if (shownKey !== requestKey) {
    setShownKey(requestKey);
    setLoading(true);
  }

  const sheetFilterCount = (source === 'all' ? 0 : 1) + (status === 'all' ? 0 : 1) + (sort === 'newest' ? 0 : 1);
  const isFiltered = sheetFilterCount > 0 || !!category || !!vendor || appliedSearch.length > 0;
  const totalPages = Math.max(1, meta.totalPages || 1);

  const sourceOptions = useMemo(
    () => [
      { value: 'all' as const, label: t('products.filters.all') },
      { value: 'own_override' as const, label: t('products.source.own_override') },
      { value: 'vendor_default' as const, label: t('products.source.vendor_default') },
    ],
    [t],
  );
  const statusOptions = useMemo(
    () => [
      { value: 'all' as const, label: t('products.filters.all') },
      ...DELIVERABLE_PRODUCT_STATUSES.map((s) => ({ value: s, label: tx(t, `products.status.${s}`) })),
    ],
    [t],
  );
  const sortOptions = useMemo(
    () =>
      (Object.keys(SORTS) as SortOption[]).map((s) => ({ value: s, label: tx(t, `products.sort.${s}`) })),
    [t],
  );

  const resetSheetFilters = () => {
    setSource('all');
    setStatus('all');
    setSort('newest');
  };
  const clearAll = () => {
    setSearch('');
    setAppliedSearch('');
    resetSheetFilters();
    setCategory(null);
    setVendor(null);
  };

  return (
    <div className="space-y-3">
      <SearchFilterBar
        value={search}
        onChange={setSearch}
        placeholder={t('products.searchPlaceholder')}
        searchLabel={t('products.searchLabel')}
        activeCount={sheetFilterCount}
        onReset={resetSheetFilters}
        filterDescription={t('products.filterDescription')}
        resultCount={meta.total}
        resultNounKey="common:nouns.product"
      >
        <FilterSection label={t('products.filters.source')}>
          <FilterOptionGroup value={source} onChange={setSource} options={sourceOptions} />
        </FilterSection>
        <FilterSection label={t('products.filters.status')}>
          <FilterOptionGroup value={status} onChange={setStatus} options={statusOptions} />
        </FilterSection>
        <FilterSection label={t('products.filters.sort')}>
          <FilterOptionGroup value={sort} onChange={setSort} options={sortOptions} />
        </FilterSection>
      </SearchFilterBar>

      {(category || vendor) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {vendor && (
            <FilterPill
              label={t('products.filters.vendorPill', { name: vendor.label })}
              onRemove={() => setVendor(null)}
              removeLabel={t('products.filters.remove')}
            />
          )}
          {category && (
            <FilterPill
              label={t('products.filters.categoryPill', { name: category.label })}
              onRemove={() => setCategory(null)}
              removeLabel={t('products.filters.remove')}
            />
          )}
        </div>
      )}

      <div className="flex items-center justify-between h-5">
        {!loading && !error && (
          <p className="text-xs text-muted-foreground">{t('products.found', { count: meta.total })}</p>
        )}
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>

      {error ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={load}>
            {t('common:actions.retry')}
          </Button>
        </div>
      ) : loading && products.length === 0 ? (
        <div className="space-y-3 p-1">
          {[1, 2, 3].map((i) => (
            <ProductRowSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-10">
          <PackageX className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {isFiltered ? t('products.emptyFiltered') : t('products.empty')}
          </p>
          {isFiltered && (
            <button type="button" onClick={clearAll} className="mt-2 text-xs text-primary hover:underline">
              {t('browse.clearFilters')}
            </button>
          )}
        </div>
      ) : (
        <ul className={cn('space-y-3 transition-opacity', loading && 'opacity-60')}>
          {products.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              onPickVendor={(v) => setVendor({ id: v.id, label: vendorName(v) ?? t('products.unnamedVendor') })}
              onPickCategory={(c) => setCategory({ id: c.id, label: c.name })}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 && !error && (
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('common:actions.previous')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('common:pagination.pageOf', { page, total: totalPages })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('common:actions.next')}
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterPill({ label, onRemove, removeLabel }: { label: string; onRemove: () => void; removeLabel: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/60 py-0.5 ps-2.5 pe-1 text-xs">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${removeLabel}: ${label}`}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function ProductRow({
  product,
  onPickVendor,
  onPickCategory,
}: {
  product: DeliverableProduct;
  onPickVendor: (vendor: DeliverableProductVendor) => void;
  onPickCategory: (category: ProductCategoryRef) => void;
}) {
  const { t } = useTranslation('vendors');
  const knownStatus = (DELIVERABLE_PRODUCT_STATUSES as readonly string[]).includes(product.status);
  const name = vendorName(product.vendor);
  const logoUrl = product.vendor.logo?.url;

  // A grid rather than a flex row so that on a phone the chips below the header take
  // the card's full width, while from `sm` up they line up under the text column.
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2.5 rounded-xl border-2 border-border bg-card p-3 sm:p-4">
      <div className="sm:row-span-2">
        <ImageStack product={product} />
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 break-words text-sm font-semibold leading-snug line-clamp-2">{product.title}</p>
          <span
            className={cn(
              'text-[11px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0',
              STATUS_CLASS[product.status] ?? 'text-muted-foreground bg-muted border-border',
            )}
          >
            {knownStatus ? tx(t, `products.status.${product.status}`) : product.status}
          </span>
        </div>

        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => onPickVendor(product.vendor)}
            title={t('products.filterByVendor')}
            className="flex min-w-0 items-center gap-1.5 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-4 w-4 flex-shrink-0 rounded-full border object-cover" />
            ) : (
              <Store className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            <span className={cn('truncate', !name && 'italic')}>{name ?? t('products.unnamedVendor')}</span>
          </button>
          <VerifiedBadge verified={product.vendor.verified} className="-ms-0.5 flex-shrink-0" />
          <span aria-hidden className="flex-shrink-0">·</span>
          <span className="truncate">{t(`products.source.${product.source}`)}</span>
        </div>

        <PickupLine pickup={product.pickup} />
      </div>

      <div className="col-span-2 min-w-0 space-y-2 sm:col-span-1 sm:col-start-2">
        <StorageChips stock={product.agencyStock} />
        <CategoryChips categories={product.categories} onPick={onPickCategory} />
      </div>
    </li>
  );
}

/** How many thumbnails the stack shows before collapsing the rest into "+N". */
const STACK_VISIBLE = 3;

/**
 * Product media is public, but `FileRef.url` is nullable (authorized / quota-blocked
 * trees) — skip anything without a public URL rather than render a broken tile.
 */
function viewableImages(product: DeliverableProduct): FileRef[] {
  return (product.images ?? []).filter(
    (img) => !!img.url && img.access !== 'authorized' && img.access !== 'quota_blocked',
  );
}

/** Overlapping thumbnails, first on top; tap to see them large. Package icon without any. */
/**
 * One width for every row's picture column — the full three-image stack (each
 * extra thumbnail peeks out 12px) — so titles line up down the list whether a
 * product has three photos, one, or none.
 */
const STACK_SLOT = 'flex w-[68px] flex-shrink-0 items-center sm:w-[72px]';

function ImageStack({ product }: { product: DeliverableProduct }) {
  const { t } = useTranslation('vendors');
  const [open, setOpen] = useState(false);
  const images = viewableImages(product);

  if (images.length === 0) {
    return (
      <div className={STACK_SLOT}>
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted sm:h-12 sm:w-12">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    );
  }

  // `imageCount` is the full gallery; `images` is capped server-side.
  const total = Math.max(product.imageCount ?? images.length, images.length);
  const visible = images.slice(0, STACK_VISIBLE);
  const extra = total - visible.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('products.images.open', { title: product.title })}
        className={cn(
          STACK_SLOT,
          'relative rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {visible.map((img, i) => (
          <img
            key={img.id}
            src={img.url ?? undefined}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ zIndex: visible.length - i }}
            className={cn(
              'relative h-11 w-11 flex-shrink-0 rounded-lg border-2 border-card bg-muted object-cover shadow-sm sm:h-12 sm:w-12',
              i > 0 && '-ms-8 sm:-ms-9',
            )}
          />
        ))}
        {extra > 0 && (
          <span className="absolute -bottom-1 -end-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold tabular-nums text-background ring-2 ring-card">
            +{extra}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-3 p-4 sm:max-w-xl">
          <DialogHeader className="pe-8 text-start">
            <DialogTitle className="line-clamp-2 break-words text-base">{product.title}</DialogTitle>
            <DialogDescription className="sr-only">{t('products.images.dialogTitle')}</DialogDescription>
          </DialogHeader>
          {/* Swipe on a phone, scroll on desktop — no carousel dependency. */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1">
            {images.map((img) => (
              <img
                key={img.id}
                src={img.url ?? undefined}
                alt=""
                className={cn(
                  'h-72 flex-shrink-0 snap-center rounded-lg border bg-muted object-contain sm:h-96',
                  images.length === 1 ? 'w-full' : 'w-[85%]',
                )}
              />
            ))}
          </div>
          {total > images.length && (
            <p className="text-xs text-muted-foreground">
              {t('products.images.moreHidden', { n: total - images.length })}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Where the courier collects it: the vendor's address, or one of our depots. */
function PickupLine({ pickup }: { pickup: DeliverableProductPickup | null | undefined }) {
  const { t } = useTranslation('vendors');
  // Absent = an older backend that does not send it; say nothing rather than "not set".
  if (pickup === undefined) return null;

  if (pickup === null) {
    return (
      <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs italic text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{t('products.pickup.notSet')}</span>
      </p>
    );
  }

  const isDepot = pickup.source === 'agency_storage';
  const text = pickup.label
    ? t(isDepot ? 'products.pickup.depotNamed' : 'products.pickup.vendorNamed', { label: pickup.label })
    : t(isDepot ? 'products.pickup.depot' : 'products.pickup.vendor');
  const place = pickup.city ?? pickup.state;

  return (
    <p className="mt-1.5 flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
      <MapPin className={cn('mt-px h-3.5 w-3.5 flex-shrink-0', isDepot && 'text-primary')} />
      <span className="min-w-0 break-words">
        {text}
        {place && (
          <>
            {' '}
            {/* The dot travels with the city (`nowrap`, NBSP) — wrapped on its
                own it was left dangling at the end of the line. */}
            <span className="whitespace-nowrap">
              <span aria-hidden>·{' '}</span>
              <span className="text-foreground/80">{place}</span>
            </span>
          </>
        )}
      </span>
    </p>
  );
}

/**
 * Is it on our shelves, and in which depot. One chip per depot, so an agency with
 * several `headquarters_addresses` sees where the goods are.
 *
 * ⚠ An uncounted depot (every row `derived`) is NOT "we hold none" — it renders as a
 * dashed "Not counted yet" chip, never as a 0. See CLAUDE.md, rule 3.
 */
function StorageChips({ stock }: { stock: DeliverableProductStock | null | undefined }) {
  const { t, i18n } = useTranslation('vendors');
  // Absent = an older backend; don't claim "not in your storage" on its behalf.
  if (stock === undefined) return null;

  if (stock === null || stock.depots.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Warehouse className="h-3.5 w-3.5 flex-shrink-0" />
        {t('products.storage.notStored')}
      </p>
    );
  }

  const fmt = (n: number) => new Intl.NumberFormat(i18n.language).format(n);
  const multi = stock.depots.length > 1;
  const anyCounted = stock.counted ?? stock.depots.some((d) => d.counted);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium">
        <Warehouse className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
        {t('products.storage.label')}
      </span>
      {stock.depots.map((d, i) => (
        <DepotChip key={d.id ?? `unassigned-${i}`} depot={d} showName={multi || !!d.label || d.id === null} fmt={fmt} />
      ))}
      {multi && anyCounted && (
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {t('products.storage.total', { qty: fmt(stock.totalOnHand) })}
        </span>
      )}
    </div>
  );
}

function DepotChip({
  depot,
  showName,
  fmt,
}: {
  depot: DeliverableProductStockDepot;
  showName: boolean;
  fmt: (n: number) => string;
}) {
  const { t } = useTranslation('vendors');
  const name = depot.id === null ? t('products.storage.unassigned') : (depot.label ?? depot.city);
  const shownName = showName ? name : null;

  return (
    <span
      title={depot.counted ? undefined : t('products.storage.notCountedHint')}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]',
        !depot.counted
          ? 'border-dashed border-amber-300 bg-amber-50/60 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
          : depot.quantityOnHand > 0
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
            : 'border-border bg-muted text-muted-foreground',
      )}
    >
      {shownName && (
        <>
          <span className="truncate">{shownName}</span>
          <span aria-hidden>·</span>
        </>
      )}
      {depot.counted ? (
        <span className="font-semibold tabular-nums">{fmt(depot.quantityOnHand)}</span>
      ) : (
        <>
          <span className="whitespace-nowrap italic">{t('products.storage.notCounted')}</span>
          <span className="sr-only">{t('products.storage.notCountedHint')}</span>
        </>
      )}
    </span>
  );
}

/** Primary first and emphasised; an empty list reads as "no category", not as missing data. */
function CategoryChips({
  categories,
  onPick,
  className,
}: {
  categories: ProductCategoryRef[];
  onPick: (category: ProductCategoryRef) => void;
  className?: string;
}) {
  const { t } = useTranslation('vendors');

  if (categories.length === 0) {
    return <p className={cn('text-[11px] italic text-muted-foreground', className)}>{t('products.noCategory')}</p>;
  }

  return (
    <ul className={cn('flex flex-wrap gap-1', className)} aria-label={t('products.categoriesLabel')}>
      {categories.map((c, i) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onPick(c)}
            title={t('products.filterByCategory')}
            className={cn(
              'text-[11px] px-2 py-0.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              i === 0
                ? 'bg-primary/10 text-primary font-medium hover:bg-primary/20'
                : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground',
            )}
          >
            {c.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ProductRowSkeleton() {
  return (
    <div className="rounded-xl border p-3 sm:p-4 flex items-start gap-3">
      <Skeleton className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  );
}
