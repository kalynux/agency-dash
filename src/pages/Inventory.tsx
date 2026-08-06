import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Package,
  RefreshCw,
  Store,
  TriangleAlert,
  Warehouse,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { listSurfaceClass } from '@/components/layout/PageContainer';
import { StockStateBadge } from '@/components/inventory/StockStateBadge';
import { StockLevelCell } from '@/components/inventory/StockLevels';
import { InventoryDetailSheet } from '@/components/inventory/InventoryDetailSheet';
import { STOCK_STATE_FILTER_VALUES } from '@/components/inventory/stock-state';
import { inventoryService } from '@/services/inventory.service';
import { useMagazin } from '@/store/magazin.store';
import { getApiErrorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { describeLocation } from '@/types/inventory.types';
import type {
  InventoryListItem,
  InventoryListMeta,
  StockStateFilter,
} from '@/types/inventory.types';

const PAGE_LIMIT = 20;

/** The backend ignores anything shorter, so we don't send it either. */
const MIN_SEARCH_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 350;

const EMPTY_META: InventoryListMeta = {
  total: 0,
  page: 1,
  limit: PAGE_LIMIT,
  pages: 1,
  summary: { skuCount: 0, unitCount: 0, lowStockCount: 0, outOfStockCount: 0, vendorCount: 0 },
};

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <Card className="py-0 md:py-6">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p
            className={cn(
              'mt-1 font-numeric text-2xl font-bold',
              tone === 'warning' && 'text-amber-600 dark:text-amber-400',
            )}
          >
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
            tone === 'warning' ? 'bg-amber-500/15' : 'bg-primary/10',
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4',
              tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-primary',
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Inventory — the vendor stock this agency physically warehouses, and where in
 * our network each line is sitting.
 *
 * One row per stored variant. The row answers "what, whose, where, how many";
 * the detail sheet answers everything else. See api-doc/agency/inventory.md.
 */
export function Inventory() {
  const { t } = useTranslation(['inventory', 'common']);
  // Location filter options come from the magazin the app already loaded, not
  // from a second endpoint — and it keeps the labels here identical to the ones
  // Account → Locations edits.
  const { data: magazin } = useMagazin();

  const [items, setItems] = useState<InventoryListItem[]>([]);
  const [meta, setMeta] = useState<InventoryListMeta>(EMPTY_META);
  const [page, setPage] = useState(1);
  const [stockState, setStockState] = useState<StockStateFilter>('all');
  const [locationId, setLocationId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Debounced, server-side: search spans every page of stored stock (title,
  // variant, SKU, vendor name), so it is a query parameter, not a filter over
  // the rows already loaded.
  const [appliedQuery, setAppliedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, meta: m } = await inventoryService.list({
        q: appliedQuery || undefined,
        stockState: stockState === 'all' ? undefined : stockState,
        locationId: locationId === 'all' ? undefined : locationId,
        page,
        limit: PAGE_LIMIT,
      });
      setItems(data);
      setMeta(m);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [appliedQuery, stockState, locationId, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce typing into the query the API actually runs, and go back to page 1
  // whenever the search changes — page 3 of the old result set means nothing.
  useEffect(() => {
    const trimmed = searchQuery.trim();
    const next = trimmed.length >= MIN_SEARCH_CHARS ? trimmed : '';
    if (next === appliedQuery) return;
    const timer = setTimeout(() => {
      setAppliedQuery(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery, appliedQuery]);

  const stockStateOptions = useMemo(
    () =>
      STOCK_STATE_FILTER_VALUES.map((value) => ({
        value: value as StockStateFilter,
        label:
          value === 'all'
            ? t('filters.allStates')
            : t(`stockState.${value}` as 'stockState.in_stock'),
      })),
    [t],
  );

  const locationOptions = useMemo(() => {
    const entries = magazin?.headquartersAddresses ?? [];
    return [
      { value: 'all', label: t('filters.allLocations') },
      // Index is taken BEFORE filtering so "Branch 2" keeps naming the second
      // address the user actually saved, not the second one that happens to
      // carry an `_id`.
      ...entries
        .map((entry, index) => ({
          value: entry._id,
          // Legacy entries predate labels; fall back the way the magazin docs
          // prescribe rather than showing a blank pill. `join` yields '' (not
          // null) when both parts are missing, so this chain uses `||`.
          label:
            entry.label ||
            [entry.city, entry.region].filter(Boolean).join(', ') ||
            (index === 0 ? t('filters.primaryLocation') : t('filters.branch', { number: index })),
        }))
        // An entry the backend never assigned an `_id` cannot be filtered on.
        .filter((option): option is { value: string; label: string } => Boolean(option.value)),
    ];
  }, [magazin, t]);

  const activeFilterCount = (stockState === 'all' ? 0 : 1) + (locationId === 'all' ? 0 : 1);

  const resetFilters = () => {
    setStockState('all');
    setLocationId('all');
    setPage(1);
  };

  const handleStockStateChange = (value: StockStateFilter) => {
    setStockState(value);
    setPage(1);
  };

  const handleLocationChange = (value: string) => {
    setLocationId(value);
    setPage(1);
  };

  const openDetail = (id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
  };

  const rangeStart = items.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const rangeEnd = (meta.page - 1) * meta.limit + items.length;

  /** "Douala HQ" — or "Douala HQ +2" when a line is split across our network. */
  const locationLabel = (item: InventoryListItem): string | null => {
    if (item.locations.length === 0) return null;
    const first = describeLocation(item.locations[0]) ?? t('table.unnamedLocation');
    return item.locations.length > 1
      ? t('table.extraLocations', { place: first, count: item.locations.length - 1 })
      : first;
  };

  /** Product identity cell — picture, name, variant, SKU. Shared by both layouts. */
  const renderProduct = (item: InventoryListItem) => (
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
        <div className="max-w-[16rem] truncate font-medium" title={item.title ?? undefined}>
          {item.title ?? (
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

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('page.title')}</h1>
          <p className="text-muted-foreground">{t('page.description')}</p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={load}
          disabled={isLoading}
          aria-label={t('page.refresh')}
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          <span className="hidden sm:inline">{t('page.refresh')}</span>
        </Button>
      </div>

      {/* Totals for the whole filtered set, not just this page. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Boxes}
          label={t('summary.skus')}
          value={formatNumber(meta.summary.skuCount)}
          hint={t('summary.skusHint')}
        />
        <StatCard
          icon={Warehouse}
          label={t('summary.units')}
          value={formatNumber(meta.summary.unitCount)}
          hint={t('summary.unitsHint')}
        />
        <StatCard
          icon={Store}
          label={t('summary.vendors')}
          value={formatNumber(meta.summary.vendorCount)}
          hint={t('summary.vendorsHint')}
        />
        <StatCard
          icon={TriangleAlert}
          tone={meta.summary.lowStockCount + meta.summary.outOfStockCount > 0 ? 'warning' : 'default'}
          label={t('summary.needsAttention')}
          value={formatNumber(meta.summary.lowStockCount + meta.summary.outOfStockCount)}
          hint={t('summary.needsAttentionHint', { count: meta.summary.outOfStockCount })}
        />
      </div>

      {/* Filters & Search */}
      <SearchFilterBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t('page.searchPlaceholder')}
        searchLabel={t('page.searchLabel')}
        activeCount={activeFilterCount}
        onReset={resetFilters}
        filterDescription={t('page.filterDescription')}
        resultCount={meta.total}
        resultNounKey="common:nouns.item"
        hint={
          searchQuery.trim().length === 1
            ? t('page.searchHint', { count: MIN_SEARCH_CHARS })
            : undefined
        }
      >
        <FilterSection label={t('filters.stockState')}>
          <FilterOptionGroup
            value={stockState}
            onChange={handleStockStateChange}
            options={stockStateOptions}
          />
        </FilterSection>
        {/* Only worth a section once there is more than one place to choose. */}
        {locationOptions.length > 2 && (
          <FilterSection label={t('filters.location')}>
            <FilterOptionGroup
              value={locationId}
              onChange={handleLocationChange}
              options={locationOptions}
            />
          </FilterSection>
        )}
      </SearchFilterBar>

      {/* Inventory list */}
      <Card className={listSurfaceClass}>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : loadError ? (
            <div className="p-8 text-center">
              <p className="mb-4 text-muted-foreground">{loadError}</p>
              <Button variant="outline" onClick={load}>
                {t('common:actions.retry')}
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <Warehouse className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {appliedQuery || activeFilterCount > 0
                    ? t('page.emptyNoMatch')
                    : t('page.emptyNoStock')}
                </p>
                {/* Holding nothing is the normal state for a pickup-only agency,
                    so the empty state explains how stock gets here rather than
                    implying something is broken. */}
                {!appliedQuery && activeFilterCount === 0 && (
                  <p className="max-w-md text-sm text-muted-foreground">
                    {t('page.emptyNoStockHint')}
                  </p>
                )}
                {(searchQuery || activeFilterCount > 0) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      resetFilters();
                    }}
                  >
                    {t('page.clearFilters')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Desktop / tablet: table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-4 text-start text-sm font-medium">{t('table.product')}</th>
                      <th className="p-4 text-start text-sm font-medium">{t('table.vendor')}</th>
                      <th className="p-4 text-start text-sm font-medium">{t('table.location')}</th>
                      <th className="p-4 text-start text-sm font-medium">{t('table.available')}</th>
                      <th className="p-4 text-start text-sm font-medium">{t('table.state')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="cursor-pointer border-b transition-colors hover:bg-muted/50"
                        onClick={() => openDetail(item.id)}
                      >
                        <td className="p-4">{renderProduct(item)}</td>
                        <td className="p-4">
                          <div className="flex items-start gap-2">
                            <Store className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <div
                                className="max-w-[12rem] truncate text-sm font-medium"
                                title={item.vendor.businessName}
                              >
                                {item.vendor.businessName}
                              </div>
                              {item.vendor.phone && (
                                <a
                                  href={`tel:${item.vendor.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-muted-foreground hover:text-primary hover:underline"
                                >
                                  {item.vendor.phone}
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Which of OUR addresses holds it — the column this
                            screen exists for. */}
                        <td className="p-4">
                          {locationLabel(item) ? (
                            <div className="flex items-start gap-2">
                              <Warehouse className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                              <span
                                className="max-w-[12rem] truncate text-sm"
                                title={locationLabel(item) ?? undefined}
                              >
                                {locationLabel(item)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {t('table.noLocation')}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <StockLevelCell item={item} />
                        </td>
                        <td className="p-4">
                          <StockStateBadge state={item.stockState} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: cards */}
              <div className="divide-y md:hidden">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="cursor-pointer p-4 transition-colors hover:bg-muted/50 active:bg-muted/50"
                    onClick={() => openDetail(item.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {renderProduct(item)}
                      <StockStateBadge state={item.stockState} className="flex-shrink-0" />
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                        <Store className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{item.vendor.businessName}</span>
                      </span>
                      {locationLabel(item) && (
                        <>
                          <span className="flex-shrink-0 text-muted-foreground">·</span>
                          <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                            <Warehouse className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{locationLabel(item)}</span>
                          </span>
                        </>
                      )}
                    </div>

                    <StockLevelCell
                      item={item}
                      className="mt-2 flex-row flex-wrap items-baseline"
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {!isLoading && !loadError && (
            <div className="flex items-center justify-between gap-2 border-t p-4">
              <p className="text-xs text-muted-foreground sm:text-sm">
                {t('common:pagination.showingRange', {
                  from: rangeStart,
                  to: rangeEnd,
                  total: meta.total,
                })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label={t('common:pagination.previous')}
                >
                  <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
                </Button>
                <span className="whitespace-nowrap px-1 text-xs text-muted-foreground sm:px-2 sm:text-sm">
                  {t('common:pagination.pageOf', { page: meta.page, total: meta.pages || 1 })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.pages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label={t('common:pagination.next')}
                >
                  <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <InventoryDetailSheet itemId={selectedId} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
