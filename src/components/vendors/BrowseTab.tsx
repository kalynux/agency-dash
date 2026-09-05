import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { SearchFilterBar } from '@/components/common/SearchFilterBar';
import { VendorCard, VendorCardSkeleton } from '@/components/vendors/VendorCard';
import { VendorDetailSheet } from '@/components/vendors/VendorDetailSheet';
import { VendorFiltersPanel } from '@/components/vendors/VendorFiltersPanel';
import { countActiveVendorFilters, INITIAL_VENDOR_FILTERS, type VendorFilters } from '@/components/vendors/vendorFilters';
import { useVendorConnectionActions } from '@/hooks/useVendorConnectionActions';
import { useIsMobile } from '@/hooks/use-mobile';
import { vendorConnectionsService } from '@/services/vendor-connections.service';
import { getApiErrorMessage } from '@/lib/errors';
import type { ConnectionDto, VendorBrowseItemDto, VendorConnectionListMeta } from '@/types/vendor-connection.types';

// ─── Per-card action slot ───────────────────────────────────────────────────────
// `browse` only annotates { id, status } — pending/paused_reapproval need the full
// ConnectionDto (requesterRole / reapprovalRequiredFrom) to know which action is
// ours to take. That's fetched lazily, only when the agency interacts with the card.

/**
 * `size="sm"` is 32px tall — fine as a trailing control on a desktop row, under
 * the touch-target minimum once these drop onto the card's own action bar on a
 * phone. See the `max-md:` restack in `VendorCard`.
 */
const ACTION_BUTTON = 'max-md:h-10 max-md:px-4';

function ConnectionActionSlot({
  vendor,
  actions,
  onConnectionChange,
}: {
  vendor: VendorBrowseItemDto;
  actions: ReturnType<typeof useVendorConnectionActions>;
  onConnectionChange?: (vendorId: string, dto: ConnectionDto) => void;
}) {
  const { t } = useTranslation('vendors');
  const [detail, setDetail] = useState<ConnectionDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);

  const connection = vendor.connection;

  // Reset cached detail if the connection identity/status changed underneath us.
  useEffect(() => {
    setDetail(null);
  }, [connection?.id, connection?.status]);

  const loadDetail = useCallback(async () => {
    if (!connection) return;
    setLoadingDetail(true);
    try {
      const { data } = await vendorConnectionsService.getById(connection.id);
      setDetail(data);
    } catch {
      // best-effort — keep showing the generic status badge
    } finally {
      setLoadingDetail(false);
    }
  }, [connection]);

  const handleChange = (dto: ConnectionDto | null) => {
    if (dto) onConnectionChange?.(vendor.id, dto);
  };

  if (!connection) {
    const key = `request:${vendor.id}`;
    return (
      <Button
        size="sm"
        variant="outline"
        className={ACTION_BUTTON}
        disabled={actions.pendingKey === key}
        onClick={() => actions.request(vendor.id).then(handleChange)}
      >
        {actions.pendingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('actions.request')}
      </Button>
    );
  }

  if (connection.status === 'active') {
    return (
      <Badge variant="secondary" className="text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800">
        {t('actions.connected')}
      </Badge>
    );
  }

  if (connection.status === 'rejected' || connection.status === 'withdrawn' || connection.status === 'terminated') {
    const key = `request:${vendor.id}`;
    return (
      <Button
        size="sm"
        variant="outline"
        className={ACTION_BUTTON}
        disabled={actions.pendingKey === key}
        onClick={() => actions.request(vendor.id).then(handleChange)}
      >
        {actions.pendingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('actions.requestAgain')}
      </Button>
    );
  }

  // pending / paused_reapproval — need the full detail to know whose turn it is
  if (!detail) {
    return (
      <Button size="sm" variant="ghost" className={ACTION_BUTTON} disabled={loadingDetail} onClick={loadDetail}>
        {loadingDetail ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : connection.status === 'pending' ? (
          t('actions.pendingEllipsis')
        ) : (
          t('actions.reapprovalNeeded')
        )}
      </Button>
    );
  }

  if (connection.status === 'pending') {
    if (detail.requesterRole === 'agency') {
      const key = `withdraw:${connection.id}`;
      return (
        <Button
          size="sm"
          variant="outline"
          className={ACTION_BUTTON}
          disabled={actions.pendingKey === key}
          onClick={() => actions.withdraw(vendor.id, connection.id).then(handleChange)}
        >
          {actions.pendingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('actions.withdraw')}
        </Button>
      );
    }
    const approveKey = `approve:${connection.id}`;
    const rejectKey = `reject:${connection.id}`;
    return (
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          className={ACTION_BUTTON}
          disabled={actions.pendingKey === approveKey}
          onClick={() => actions.approve(vendor.id, connection.id).then(handleChange)}
        >
          {actions.pendingKey === approveKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('actions.approve')}
        </Button>
        <Popover open={rejectOpen} onOpenChange={setRejectOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className={ACTION_BUTTON}>{t('actions.reject')}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-2" align="end">
            <p className="text-xs font-medium">{t('actions.rejectConfirmTitle')}</p>
            <Textarea
              placeholder={t('actions.reasonOptional')}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="text-xs min-h-16"
            />
            <Button
              size="sm"
              variant="destructive"
              className="w-full"
              disabled={actions.pendingKey === rejectKey}
              onClick={() =>
                actions.reject(vendor.id, connection.id, rejectReason || undefined).then((dto) => {
                  handleChange(dto);
                  if (dto) setRejectOpen(false);
                })
              }
            >
              {actions.pendingKey === rejectKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('actions.confirmReject')}
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // paused_reapproval
  if (detail.reapprovalRequiredFrom === 'agency') {
    const key = `approve:${connection.id}`;
    return (
      <Button
        size="sm"
        disabled={actions.pendingKey === key}
        onClick={() => actions.approve(vendor.id, connection.id).then(handleChange)}
      >
        {actions.pendingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('actions.reapprove')}
      </Button>
    );
  }
  return <Badge variant="secondary">{t('actions.awaitingVendor')}</Badge>;
}

// ─── Browser ────────────────────────────────────────────────────────────────────

export interface BrowseTabProps {
  /** Called after any successful connection mutation (request/approve/reject/withdraw). */
  onConnectionChange?: (vendorId: string, dto: ConnectionDto) => void;
}

/** Vendors → Browse tab: search + filter + paginated vendor list, each card driven by its connection state. */
export function BrowseTab({ onConnectionChange }: BrowseTabProps) {
  const { t } = useTranslation(['vendors', 'common']);
  const isMobile = useIsMobile();
  const [vendors, setVendors] = useState<VendorBrowseItemDto[]>([]);
  const [meta, setMeta] = useState<VendorConnectionListMeta | null>(null);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [detailVendor, setDetailVendor] = useState<VendorBrowseItemDto | null>(null);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<VendorFilters>(INITIAL_VENDOR_FILTERS);
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<VendorFilters>(INITIAL_VENDOR_FILTERS);
  const [page, setPage] = useState(1);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actions = useVendorConnectionActions({
    onChanged: (vendorId, dto) => {
      setVendors((prev) =>
        prev.map((v) => (v.id === vendorId ? { ...v, connection: { id: dto.id, status: dto.status } } : v)),
      );
      onConnectionChange?.(vendorId, dto);
    },
  });

  const loadVendors = useCallback(async (
    currentFilters: VendorFilters,
    currentSearch: string,
    currentPage: number,
  ) => {
    setLoadingVendors(true);
    setFetchError(null);
    try {
      const params: Parameters<typeof vendorConnectionsService.browse>[0] = { page: currentPage };
      if (currentSearch) params.search = currentSearch;
      if (currentFilters.city) params.city = currentFilters.city;
      if (currentFilters.state) params.state = currentFilters.state;
      if (currentFilters.returnEligible) params.return_eligible = true;
      if (currentFilters.cancellable) params.cancellable = true;

      const res = await vendorConnectionsService.browse(params);
      setVendors(res.data ?? []);
      setMeta(res.meta ?? null);
    } catch (err) {
      setFetchError(getApiErrorMessage(err));
    } finally {
      setLoadingVendors(false);
    }
  }, []);

  useEffect(() => {
    loadVendors(appliedFilters, appliedSearch, page);
  }, [appliedFilters, appliedSearch, page, loadVendors]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setAppliedSearch(value);
      setPage(1);
    }, 400);
  };

  const handleFilterChange = (key: keyof VendorFilters, value: string | boolean) => {
    const next = { ...filters, [key]: value };
    setFilters(next);

    const isTextField = key === 'city' || key === 'state';
    if (isTextField) {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
      filterDebounceRef.current = setTimeout(() => {
        setAppliedFilters(next);
        setPage(1);
      }, 400);
    } else {
      setAppliedFilters(next);
      setPage(1);
    }
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_VENDOR_FILTERS);
    setAppliedFilters(INITIAL_VENDOR_FILTERS);
    setPage(1);
  };

  const activeFilterCount = countActiveVendorFilters(appliedFilters);

  // Shared by both branches below so the mobile/desktop split is only about the
  // scroll container, never about what the list renders.
  const vendorCards = vendors.map((vendor) => (
    <VendorCard
      key={vendor.id}
      vendor={vendor}
      onInfo={() => setDetailVendor(vendor)}
      rightSlot={
        <ConnectionActionSlot vendor={vendor} actions={actions} onConnectionChange={onConnectionChange} />
      }
    />
  ));

  return (
    <div className="space-y-3">
      <SearchFilterBar
        value={search}
        onChange={handleSearchChange}
        placeholder={t('browse.searchPlaceholder')}
        activeCount={activeFilterCount}
        onReset={handleClearFilters}
        filterDescription={t('browse.filterDescription')}
        resultCount={meta?.total}
        resultNounKey="common:nouns.vendor"
      >
        <VendorFiltersPanel filters={filters} onChange={handleFilterChange} />
      </SearchFilterBar>

      <div className="flex items-center justify-between h-5">
        {!loadingVendors && meta && (
          <p className="text-xs text-muted-foreground">
            {t('browse.found', { count: meta.total })}
          </p>
        )}
        {loadingVendors && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>

      {fetchError ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">{fetchError}</p>
          <Button variant="outline" onClick={() => loadVendors(appliedFilters, appliedSearch, page)}>
            {t('common:actions.retry')}
          </Button>
        </div>
      ) : loadingVendors && vendors.length === 0 ? (
        <div className="space-y-3 p-1">
          {[1, 2, 3].map((i) => <VendorCardSkeleton key={i} />)}
        </div>
      ) : vendors.length === 0 ? (
        <div className="text-center py-10">
          <Store className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {activeFilterCount > 0 || appliedSearch
              ? t('browse.emptyFiltered')
              : t('browse.empty')}
          </p>
          {(activeFilterCount > 0 || appliedSearch) && (
            <button
              type="button"
              onClick={() => { handleSearchChange(''); handleClearFilters(); }}
              className="mt-2 text-xs text-primary hover:underline"
            >
              {t('browse.clearFilters')}
            </button>
          )}
        </div>
      ) : isMobile ? (
        // No ScrollArea on phones. Radix renders its viewport's content wrapper
        // as an inline `display: table` box — shrink-to-fit, so it grows to the
        // widest card — while the viewport itself is `overflow-x: hidden`
        // (ui/scroll-area.tsx mounts no horizontal ScrollBar). Anything wider
        // than the phone is therefore clipped and unreachable, which is how the
        // Request button ended up sliced off the right edge. Here the page
        // scrolls instead, and nothing above the cards is shrink-to-fit.
        <div className="space-y-3">{vendorCards}</div>
      ) : (
        <ScrollArea className="h-[52vh] min-h-[220px]">
          <div className="space-y-3 pr-3">{vendorCards}</div>
        </ScrollArea>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || loadingVendors}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('common:actions.previous')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('common:pagination.pageOf', { page, total: meta.totalPages })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= meta.totalPages || loadingVendors}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('common:actions.next')}
          </Button>
        </div>
      )}

      <VendorDetailSheet
        vendor={detailVendor}
        open={detailVendor !== null}
        onOpenChange={(open) => { if (!open) setDetailVendor(null); }}
        footerSlot={
          detailVendor && (
            <ConnectionActionSlot vendor={detailVendor} actions={actions} onConnectionChange={onConnectionChange} />
          )
        }
      />
    </div>
  );
}
