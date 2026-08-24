/**
 * The stock-request inbox — both directions of the two-signature stock flow.
 *
 * NO FILTER RETURNS EVERY STATUS, terminal rows included. That is deliberate
 * server-side: a live-only default would make a SKU's negotiation history
 * impossible to fetch, and this list is the only place the id of a request we
 * raised ourselves is exposed. So the default view here is "everything", and
 * narrowing is an explicit act.
 *
 * `?open=<id>` opens a request directly. That is what the backend's
 * `stock-requests/{requestId}` notification deep-link redirects into (see
 * App.tsx), so it has to survive a cold page load, not just an in-app click.
 *
 * See api-doc/agency/stock-requests.md §2.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { listSurfaceClass, type RenderPageHeader } from '@/components/layout/PageContainer';
import { StockRequestCard } from '@/components/inventory/requests/StockRequestCard';
import { StockRequestSheet } from '@/components/inventory/requests/StockRequestSheet';
import { stockRequestsService } from '@/services/stock-requests.service';
import { useStockRequests } from '@/store/stockRequests.store';
import { getApiErrorMessage } from '@/lib/errors';
import type {
  ListStockRequestsParams,
  StockRequest,
  StockRequestDirection,
  StockRequestListMeta,
  StockRequestStatus,
} from '@/types/stock-request.types';

const PAGE_LIMIT = 20;

const EMPTY_META: StockRequestListMeta = { total: 0, page: 1, limit: PAGE_LIMIT, totalPages: 1 };

const STATUSES: StockRequestStatus[] = ['pending', 'approved', 'rejected', 'withdrawn'];
const DIRECTIONS: StockRequestDirection[] = ['awaiting_me', 'raised_by_me'];

export function StockRequestsTab({ renderHeader }: { renderHeader: RenderPageHeader }) {
  const { t } = useTranslation(['inventory', 'common']);
  const { refetch: refetchBadge } = useStockRequests();
  const [searchParams, setSearchParams] = useSearchParams();

  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [meta, setMeta] = useState<StockRequestListMeta>(EMPTY_META);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('all');
  const [direction, setDirection] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // The deep-linked id lives in the URL, not in state, so a pasted link and an
  // in-app click take exactly the same path.
  const openId = searchParams.get('open');

  useEffect(() => {
    if (openId) setSheetOpen(true);
  }, [openId]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const params: ListStockRequestsParams = {
      page,
      limit: PAGE_LIMIT,
      ...(status !== 'all' ? { status: status as StockRequestStatus } : {}),
      ...(direction !== 'all' ? { direction: direction as StockRequestDirection } : {}),
    };
    try {
      const res = await stockRequestsService.list(params);
      setRequests(res.data);
      setMeta(res.meta);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, status, direction]);

  useEffect(() => {
    load();
  }, [load]);

  /** An action resolved a request: the list, the badge and the sheet all move. */
  const handleResolved = () => {
    load();
    refetchBadge();
  };

  // Both build a fresh `URLSearchParams` rather than mutating the one `useSearchParams`
  // handed back — that object is shared across renders, so mutating it edits state
  // in place and a later read can see a change React was never told about.
  const closeSheet = (next: boolean) => {
    setSheetOpen(next);
    if (!next && openId) {
      // Drop `?open=` so a refresh does not silently reopen a sheet the user
      // deliberately closed.
      const params = new URLSearchParams(searchParams);
      params.delete('open');
      setSearchParams(params, { replace: true });
    }
  };

  const openRequest = (request: StockRequest) => {
    const params = new URLSearchParams(searchParams);
    params.set('open', request.id);
    setSearchParams(params, { replace: true });
    setSheetOpen(true);
  };

  const activeFilterCount = (status !== 'all' ? 1 : 0) + (direction !== 'all' ? 1 : 0);

  const resetFilters = () => {
    setStatus('all');
    setDirection('all');
    setPage(1);
  };

  const changeDirection = (value: string) => {
    setDirection(value);
    setPage(1);
  };

  const rangeStart = requests.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const rangeEnd = (meta.page - 1) * meta.limit + requests.length;

  return (
    <div className="space-y-6">
      {renderHeader([
        { id: 'refresh', label: t('page.refresh'), icon: RefreshCw, onSelect: load, busy: isLoading },
      ])}

      <SearchFilterBar
        activeCount={activeFilterCount}
        onReset={resetFilters}
        filterDescription={t('requests.filterDescription')}
        resultCount={meta.total}
        resultNounKey="common:nouns.item"
      >
        <FilterSection label={t('requests.filterDirection')}>
          <FilterOptionGroup
            value={direction}
            onChange={changeDirection}
            options={[
              { value: 'all', label: t('requests.directions.all') },
              ...DIRECTIONS.map((d) => ({ value: d, label: t(`requests.directions.${d}`) })),
            ]}
          />
        </FilterSection>
        <FilterSection label={t('requests.filterStatus')}>
          <FilterOptionGroup
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: 'all', label: t('requests.statuses.all') },
              ...STATUSES.map((s) => ({ value: s, label: t(`requests.statuses.${s}`) })),
            ]}
          />
        </FilterSection>
      </SearchFilterBar>

      <Card className={listSurfaceClass}>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : loadError ? (
            <div className="p-8 text-center">
              <p className="mb-4 text-muted-foreground">{loadError}</p>
              <Button variant="outline" onClick={load}>
                {t('common:actions.retry')}
              </Button>
            </div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <Inbox className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {activeFilterCount > 0 ? t('requests.emptyNoMatch') : t('requests.empty')}
                </p>
                {activeFilterCount === 0 && (
                  <p className="max-w-md text-sm text-muted-foreground">{t('requests.emptyHint')}</p>
                )}
                {activeFilterCount > 0 && (
                  <Button variant="outline" onClick={resetFilters}>
                    {t('page.clearFilters')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {requests.map((request) => (
                <StockRequestCard key={request.id} request={request} onOpen={openRequest} />
              ))}
            </div>
          )}

          {/* A pager under a list that fits on one page is three controls that
              cannot do anything and a count the list already shows. */}
          {!isLoading && !loadError && meta.totalPages > 1 && (
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

      <StockRequestSheet
        requestId={openId}
        open={sheetOpen}
        onOpenChange={closeSheet}
        onResolved={handleResolved}
      />
    </div>
  );
}

/**
 * "Waiting on you", as one tap.
 *
 * The same `direction=awaiting_me` the filter sheet offers, promoted out of it
 * because it is the reason anyone opens this screen — and because the badge in
 * the sidebar counts exactly this, so a user who followed the badge here should
 * not have to open a sheet to see what it was counting.
 *
 * Its count comes from the store, not from `meta.total`: the store counts
 * `awaiting_me` regardless of what the list is currently filtered to, so the
 * number on the chip and the number on the sidebar badge can never disagree.
 */

