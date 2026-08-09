/**
 * The SKU roster — which SKUs this agency warehouses, and at which depot.
 *
 * ONE ROW IS ONE SKU AT ONE DEPOT: the same variant stored at two depots is two
 * rows. Two quantities are printed per row and never merged — the AGREED figure
 * (`catalogStock`, real, jointly governed) and the COUNTED one (still
 * structurally 0 in Phase 1). See api-doc/agency/inventory.md.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Info, RefreshCw, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { listSurfaceClass, type RenderPageHeader } from '@/components/layout/PageContainer';
import { InventoryCard, InventoryTableRow } from '@/components/inventory/InventoryRow';
import { InventorySummaryCards } from '@/components/inventory/InventorySummaryCards';
import { InventoryDetailSheet } from '@/components/inventory/InventoryDetailSheet';
import { buildDepotOptions } from '@/components/inventory/depot-options';
import { inventoryService } from '@/services/inventory.service';
import { useMagazin } from '@/store/magazin.store';
import { useStockRequests } from '@/store/stockRequests.store';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { toSummaryParams, UNASSIGNED_LOCATION } from '@/types/inventory.types';
import type {
  InventoryListItem,
  InventoryListMeta,
  InventorySummary,
  ListInventoryParams,
} from '@/types/inventory.types';

const PAGE_LIMIT = 20;

/** The backend accepts a 1-character `search`, but a single letter is rarely a real query. */
const MIN_SEARCH_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 350;

const EMPTY_META: InventoryListMeta = {
  total: 0,
  page: 1,
  limit: PAGE_LIMIT,
  totalPages: 1,
};

export function StockTab({ renderHeader }: { renderHeader: RenderPageHeader }) {
  const { t } = useTranslation(['inventory', 'common']);
  // Depot filter options come from the magazin the app already loaded, not from
  // a second endpoint — and it keeps the labels here identical to the ones
  // Account → Locations edits.
  const { data: magazin } = useMagazin();
  // Approving a request writes stock, which changes what this list shows; the
  // badge and this screen therefore refresh together.
  const { refetch: refetchRequests } = useStockRequests();

  const [items, setItems] = useState<InventoryListItem[]>([]);
  const [meta, setMeta] = useState<InventoryListMeta>(EMPTY_META);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [countsAreDerived, setCountsAreDerived] = useState(true);
  const [page, setPage] = useState(1);
  const [locationId, setLocationId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Debounced, server-side: search spans every page of stored stock (SKU and
  // product title), so it is a query parameter, not a filter over the rows
  // already loaded.
  const [appliedQuery, setAppliedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    // ONE filter object, TWO endpoints with different legal parameter sets.
    // `/summary` rejects `page`/`limit`/`sortBy` outright, so it is narrowed
    // rather than handed the same object.
    const filters: ListInventoryParams = {
      search: appliedQuery || undefined,
      locationId: locationId === 'all' ? undefined : locationId,
    };
    try {
      const [list, totals] = await Promise.all([
        inventoryService.list({ ...filters, page, limit: PAGE_LIMIT }),
        inventoryService.summary(toSummaryParams(filters)),
      ]);
      setItems(list.data);
      setMeta(list.meta);
      setCountsAreDerived(list.countsAreDerived);
      setSummary(totals.data);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [appliedQuery, locationId, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce typing into the query the API actually runs, and go back to page 1
  // whenever the search changes — page 3 of the old result set means nothing.
  useEffect(() => {
    const trimmed = searchQuery.trim();
    const next = trimmed.length >= MIN_SEARCH_CHARS ? trimmed.slice(0, 100) : '';
    if (next === appliedQuery) return;
    const timer = setTimeout(() => {
      setAppliedQuery(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery, appliedQuery]);

  const depots = useMemo(() => magazin?.headquartersAddresses ?? [], [magazin]);

  const locationOptions = useMemo(
    () => [
      { value: 'all', label: t('filters.allLocations') },
      ...buildDepotOptions(depots, {
        primary: t('filters.primaryLocation'),
        branch: (number) => t('filters.branch', { number }),
      }).map(({ value, label }) => ({ value, label })),
      // The bucket for rows pointing at a depot that no longer exists. Offered
      // even at zero, because it is where "why is this product homeless" is
      // answered.
      { value: UNASSIGNED_LOCATION, label: t('filters.unassigned') },
    ],
    [depots, t],
  );

  /**
   * Whether we warehouse at all. Read off a row rather than the session policy,
   * so the screen and the API can never disagree about it.
   */
  const storageOffered = items.some((item) => item.storageFee?.storageBasedEnabled);

  const activeFilterCount = locationId === 'all' ? 0 : 1;

  const resetFilters = () => {
    setLocationId('all');
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

  /** A write in the sheet moved stock, a depot or a status — reload both surfaces. */
  const handleMutated = () => {
    load();
    refetchRequests();
  };

  const rangeStart = items.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const rangeEnd = (meta.page - 1) * meta.limit + items.length;

  return (
    <div className="space-y-6">
      {renderHeader(
        <Button
          variant="outline"
          className="gap-2"
          onClick={load}
          disabled={isLoading}
          aria-label={t('page.refresh')}
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          <span className="hidden sm:inline">{t('page.refresh')}</span>
        </Button>,
      )}

      {/* Phase 1: the COUNTED numbers are derived, not counted. Say so once, at
          the top, rather than letting every zero on the screen be read as a stock
          level. The agreed quantity beside them is real, which is why the banner
          names which one it is talking about. */}
      {countsAreDerived && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            <span className="font-medium">{t('derived.bannerTitle')}</span>{' '}
            <span className="text-sky-800 dark:text-sky-300">{t('derived.bannerBody')}</span>
          </p>
        </div>
      )}

      <InventorySummaryCards
        summary={summary}
        depotCount={depots.length}
        storageOffered={storageOffered}
        onShowUnassigned={() => handleLocationChange(UNASSIGNED_LOCATION)}
      />

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
        <FilterSection label={t('filters.location')}>
          <FilterOptionGroup
            value={locationId}
            onChange={handleLocationChange}
            options={locationOptions}
          />
        </FilterSection>
      </SearchFilterBar>

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
                {/* Storing nothing is the normal state for a pickup-only agency,
                    so the empty state explains how a SKU gets here rather than
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
                      {/* Two columns, two headings. Merging them would undo the
                          one distinction this screen has to keep straight. */}
                      <th className="p-4 text-start text-sm font-medium">{t('table.agreed')}</th>
                      <th className="p-4 text-start text-sm font-medium">{t('table.counted')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <InventoryTableRow key={item.id} item={item} onOpen={openDetail} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: cards */}
              <div className="divide-y md:hidden">
                {items.map((item) => (
                  <InventoryCard key={item.id} item={item} onOpen={openDetail} />
                ))}
              </div>
            </>
          )}

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
                  {t('common:pagination.pageOf', {
                    page: meta.page,
                    total: meta.totalPages || 1,
                  })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.totalPages}
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

      <InventoryDetailSheet
        itemId={selectedId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onMutated={handleMutated}
      />
    </div>
  );
}
