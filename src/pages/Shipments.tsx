import { formatDate as fmtDate } from '@/lib/format';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Navigation, Package, RefreshCw, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { listSurfaceClass } from '@/components/layout/PageContainer';
import { shipmentsService } from '@/services/shipments.service';
import { useShipments } from '@/store/shipments.store';
import { useAgentsRoster } from '@/store/agents.store';
import { ShipmentStatusBadge } from '@/components/shipments/ShipmentStatusBadge';
import { ShipmentDetailSheet } from '@/components/shipments/ShipmentDetailSheet';
import { ShipmentRowActions } from '@/components/shipments/ShipmentRowActions';
import { AutoAssignToggle } from '@/components/shipments/AutoAssignToggle';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { describeAddress } from '@/types/shipment.types';
import type { ShipmentListItem, ShipmentListMeta, ShipmentStatus } from '@/types/shipment.types';

/**
 * Statuses offered in the filter sheet, in display order. Labels come from
 * `shipments:status.*` — the same table the badge reads, so a filter pill and
 * the badge it matches can never disagree.
 */
const STATUS_FILTER_VALUES: (ShipmentStatus | 'all')[] = [
  'all',
  'assigned',
  'handing_over',
  'picked_up',
  'in_transit',
  'agent_delivered',
  'delivered',
  'failed',
  'returned',
  'rejected',
];

const PAGE_LIMIT = 20;

/** The backend ignores anything shorter, so we don't send it either. */
const MIN_SEARCH_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 350;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatDate(iso: string): string {
  return fmtDate(iso);
}

export function Shipments() {
  const { t } = useTranslation(['shipments', 'common']);
  const { refetch: refetchBadge } = useShipments();
  const { agents } = useAgentsRoster();
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [meta, setMeta] = useState<ShipmentListMeta>({ total: 0, page: 1, limit: PAGE_LIMIT, pages: 1 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Debounced, server-side. Search runs across every page of the agency's
  // shipments (customer name/phone, product titles, order #, tracking #), so it
  // is a query parameter rather than a filter over the rows already loaded.
  const [appliedQuery, setAppliedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, meta: m } = await shipmentsService.list({
        status: statusFilter === 'all' ? undefined : statusFilter,
        q: appliedQuery || undefined,
        page,
        limit: PAGE_LIMIT,
      });
      setShipments(data);
      setMeta(m);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, appliedQuery, page]);

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

  const statusOptions = useMemo(
    () =>
      STATUS_FILTER_VALUES.map((value) => ({
        value,
        label:
          value === 'all'
            ? t('filters.allStatuses')
            : t(`status.${value}` as 'status.pending'),
      })),
    [t],
  );

  const handleStatusFilterChange = (value: ShipmentStatus | 'all') => {
    setStatusFilter(value);
    setPage(1);
  };

  const openDetail = (id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
  };

  const agentNameFor = (id: string) => agents.find((a) => a.id === id)?.name ?? t('status.assigned');

  /**
   * "Douala → Yaoundé" from the row's own pickup/drop-off. Both are optional on
   * the payload, so a row that carries neither simply shows no route line.
   *
   * A shipment can have several collection points (one vendor with two business
   * addresses, or a mix of vendor-collected and agency-stored items), which is
   * an operationally different job — so say so rather than naming only the first.
   */
  const routeLabel = (shipment: ShipmentListItem): string | null => {
    const from = describeAddress(shipment.pickup?.address);
    const to = describeAddress(shipment.deliveryAddress);
    if (!from && !to) return null;
    const stops = shipment.pickup?.count ?? 0;
    const unknown = t('table.unknownPlace');
    const fromLabel = from
      ? stops > 1
        ? t('table.extraStops', { place: from, count: stops - 1 })
        : from
      : unknown;
    return t('table.route', { from: fromLabel, to: to ?? unknown });
  };

  const handleChanged = () => {
    load();
    refetchBadge();
  };

  const rangeStart = shipments.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const rangeEnd = (meta.page - 1) * meta.limit + shipments.length;


  /** The agent / tracking cell, shared by the table and the mobile card. */
  const renderAgentLink = (shipment: ShipmentListItem) =>
    shipment.agentId ? (
      <Link
        to={`/dashboard/tracking?agent=${shipment.agentId}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        title={t('table.trackAgent')}
      >
        <Navigation className="w-3.5 h-3.5 flex-shrink-0" />
        {agentNameFor(shipment.agentId)}
      </Link>
    ) : shipment.trackingNumber ? (
      <span className="text-sm text-muted-foreground">{shipment.trackingNumber}</span>
    ) : (
      <span className="text-sm text-muted-foreground">{t('table.unassigned')}</span>
    );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('page.title')}</h1>
          <p className="text-muted-foreground">{t('page.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <AutoAssignToggle />
          <Button
            variant="outline"
            className="gap-2"
            onClick={load}
            disabled={isLoading}
            aria-label={t('page.refresh')}
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            <span className="hidden sm:inline">{t('page.refresh')}</span>
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <SearchFilterBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t('page.searchPlaceholder')}
        searchLabel={t('page.searchLabel')}
        activeCount={statusFilter === 'all' ? 0 : 1}
        onReset={() => handleStatusFilterChange('all')}
        filterDescription={t('page.filterDescription')}
        resultCount={meta.total}
        resultNounKey="common:nouns.shipment"
        hint={
          searchQuery.trim().length === 1
            ? t('page.searchHint', { count: MIN_SEARCH_CHARS })
            : undefined
        }
      >
        <FilterSection label={t('filters.status')}>
          <FilterOptionGroup
            value={statusFilter}
            onChange={handleStatusFilterChange}
            options={statusOptions}
          />
        </FilterSection>
      </SearchFilterBar>

      {/* Shipments list */}
      <Card className={listSurfaceClass}>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : loadError ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground mb-4">{loadError}</p>
              <Button variant="outline" onClick={load}>
                {t('common:actions.retry')}
              </Button>
            </div>
          ) : shipments.length === 0 ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <Package className="w-12 h-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {appliedQuery ? t('page.emptyNoMatch') : t('page.emptyNoShipments')}
                </p>
                {searchQuery && (
                  <Button variant="outline" onClick={() => setSearchQuery('')}>
                    {t('page.clearSearch')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Desktop / tablet: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-start p-4 text-sm font-medium">{t('table.shipment')}</th>
                      <th className="text-start p-4 text-sm font-medium">{t('table.vendor')}</th>
                      <th className="text-start p-4 text-sm font-medium">{t('table.customer')}</th>
                      <th className="text-start p-4 text-sm font-medium">{t('table.date')}</th>
                      <th className="text-start p-4 text-sm font-medium">{t('table.status')}</th>
                      <th className="text-start p-4 text-sm font-medium">{t('table.agent')}</th>
                      <th className="w-12 p-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map((shipment) => (
                      <tr
                        key={shipment.id}
                        className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => openDetail(shipment.id)}
                      >
                        <td className="p-4">
                          <div className="font-medium">{shipment.orderNumber}</div>
                          <div className="text-sm text-muted-foreground">
                            {t('table.itemCount', { count: shipment.itemCount })}
                          </div>
                          {routeLabel(shipment) && (
                            <div className="mt-0.5 max-w-[16rem] truncate text-xs text-muted-foreground" title={routeLabel(shipment) ?? undefined}>
                              {routeLabel(shipment)}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="max-w-[14rem] truncate text-sm" title={shipment.vendor.businessName}>{shipment.vendor.businessName}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                              {initials(shipment.customer.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium" title={shipment.customer.name}>{shipment.customer.name}</div>
                              <div className="truncate text-sm text-muted-foreground" title={shipment.customer.phone}>{shipment.customer.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm">{formatDate(shipment.createdAt)}</td>
                        <td className="p-4">
                          <ShipmentStatusBadge status={shipment.status} />
                        </td>
                        <td className="p-4">{renderAgentLink(shipment)}</td>
                        {/* stopPropagation: the row-actions menu + reject dialog render in
                            portals but are React descendants of this <tr>, so their clicks
                            (including the dialog overlay/close) bubble back to the row's
                            onClick through the React tree and would otherwise open the detail. */}
                        <td className="p-4 text-end" onClick={(e) => e.stopPropagation()}>
                          <ShipmentRowActions
                            shipment={shipment}
                            onView={() => openDetail(shipment.id)}
                            onChanged={handleChanged}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: cards */}
              <div className="md:hidden divide-y">
                {shipments.map((shipment) => (
                  <div
                    key={shipment.id}
                    className="p-4 hover:bg-muted/50 active:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => openDetail(shipment.id)}
                  >
                    {/* Order # → status → actions */}
                    <div className="flex items-center gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="min-w-0 truncate font-medium">{shipment.orderNumber}</span>
                        <span className="flex-shrink-0 text-muted-foreground">·</span>
                        <ShipmentStatusBadge status={shipment.status} className="flex-shrink-0" />
                      </div>
                      <div className="flex-shrink-0 -me-2" onClick={(e) => e.stopPropagation()}>
                        <ShipmentRowActions
                          shipment={shipment}
                          onView={() => openDetail(shipment.id)}
                          onChanged={handleChanged}
                        />
                      </div>
                    </div>

                    {/* Vendor store + assignment indication */}
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                        <Store className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{shipment.vendor.businessName}</span>
                      </span>
                      <span className="flex-shrink-0 text-muted-foreground">·</span>
                      {shipment.agentId ? (
                        <Link
                          to={`/dashboard/tracking?agent=${shipment.agentId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex min-w-0 flex-shrink items-center gap-1 font-medium text-primary hover:underline"
                        >
                          <Navigation className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{agentNameFor(shipment.agentId)}</span>
                        </Link>
                      ) : (
                        <span className="flex-shrink-0 text-muted-foreground">
                          {t('table.unassigned')}
                        </span>
                      )}
                    </div>

                    {routeLabel(shipment) && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{routeLabel(shipment)}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {!isLoading && !loadError && (
            <div className="flex items-center justify-between gap-2 p-4 border-t">
              <p className="text-xs sm:text-sm text-muted-foreground">
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
                  <ChevronLeft className="w-4 h-4 rtl:-scale-x-100" />
                </Button>
                <span className="text-xs sm:text-sm text-muted-foreground px-1 sm:px-2 whitespace-nowrap">
                  {t('common:pagination.pageOf', { page: meta.page, total: meta.pages || 1 })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.pages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label={t('common:pagination.next')}
                >
                  <ChevronRight className="w-4 h-4 rtl:-scale-x-100" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ShipmentDetailSheet
        shipmentId={selectedId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onChanged={handleChanged}
      />
    </div>
  );
}
