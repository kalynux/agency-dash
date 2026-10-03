import { formatDate as fmtDate } from '@/lib/format';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Navigation, Package, Store, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { listSurfaceClass, PageHeader } from '@/components/layout/PageContainer';
import { usePageRefresh } from '@/store/pageRefresh.store';
import { shipmentsService } from '@/services/shipments.service';
import { useShipments } from '@/store/shipments.store';
import { useAgentsRoster } from '@/store/agents.store';
import { ShipmentStatusBadge } from '@/components/shipments/ShipmentStatusBadge';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { ShipmentMoneyCell } from '@/components/shipments/ShipmentMoney';
import { ShipmentDetailSheet } from '@/components/shipments/ShipmentDetailSheet';
import { useOpenParam } from '@/hooks/useOpenParam';
import { ShipmentRowActions } from '@/components/shipments/ShipmentRowActions';
import { AutoAssignStatusChip } from '@/components/shipments/AutoAssignStatusChip';
import { DeliveryFeePendingChip } from '@/components/shipments/DeliveryFeePendingChip';
import { BulkAssignDialog } from '@/components/shipments/BulkAssignDialog';
import { isBulkOfferable } from '@/components/shipments/bulkAssign';
import { Checkbox } from '@/components/ui/checkbox';
import { getApiErrorMessage } from '@/lib/errors';
import { BULK_ASSIGN_MAX, describeAddress } from '@/types/shipment.types';
import type { ShipmentListItem, ShipmentListMeta, ShipmentStatus } from '@/types/shipment.types';

/**
 * Statuses offered in the filter sheet, in display order. Labels come from
 * `shipments:status.*` — the same table the badge reads, so a filter pill and
 * the badge it matches can never disagree.
 */
/**
 * The ten statuses `GET /api/agency/shipments?status=` accepts, plus `all`.
 *
 * ⚠ **`pending` is deliberately absent and must stay absent** — it is not in the
 * filter enum and sending it is a `400 VALIDATION_ERROR`. A `pending` shipment
 * has not been handed to the agency yet and is invisible to it, so the filter
 * is built from these ten rather than from the eleven-row lifecycle table.
 * See api-doc/agency/shipments.md § List.
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
  'pending_agency_reassignment',
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
  const { openId, close: clearOpenParam } = useOpenParam();
  const [detailOpen, setDetailOpen] = useState(false);
  // Shipments picked for a bulk offer, in the order picked (a Map keeps it).
  // Kept across pages and filters, so a batch can be gathered from several.
  const [selected, setSelected] = useState<Map<string, ShipmentListItem>>(() => new Map());
  const [bulkOpen, setBulkOpen] = useState(false);

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

  usePageRefresh(() => {
    load();
    refetchBadge();
  }, isLoading);

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

  // `?open=<shipmentId>` — where a notification deep link lands
  // (`shipments/{id}`, api-doc/notifications/deep-links.md). The id is in the
  // URL so an emailed button, a pasted link and an in-app click all arrive the
  // same way.
  useEffect(() => {
    if (!openId) return;
    // Inlined rather than calling `openDetail`, which is re-created every render
    // and would make this effect re-run on each one.
    setSelectedId(openId);
    setDetailOpen(true);
  }, [openId]);

  const agentNameFor = (id: string) => agents.find((a) => a.id === id)?.name ?? t('status.assigned');
  const agentVerifiedFor = (id: string) => agents.find((a) => a.id === id)?.verified;

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

  // A reload can show a selected row no longer offerable (an agent accepted
  // it meanwhile): drop it, and refresh the rest from the new payload. Not
  // while the bulk dialog is open — its rows must stay what was sent.
  useEffect(() => {
    if (bulkOpen) return;
    setSelected((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const s of shipments) {
        if (!next.has(s.id)) continue;
        changed = true;
        if (isBulkOfferable(s)) next.set(s.id, s);
        else next.delete(s.id);
      }
      return changed ? next : prev;
    });
  }, [shipments, bulkOpen]);

  const atLimit = selected.size >= BULK_ASSIGN_MAX;
  const offerableOnPage = shipments.filter(isBulkOfferable);
  const pageAllSelected = offerableOnPage.length > 0 && offerableOnPage.every((s) => selected.has(s.id));
  const pageSomeSelected = offerableOnPage.some((s) => selected.has(s.id));

  const toggleSelected = (shipment: ShipmentListItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(shipment.id)) next.delete(shipment.id);
      else if (next.size < BULK_ASSIGN_MAX && isBulkOfferable(shipment)) next.set(shipment.id, shipment);
      return next;
    });
  };

  /** Select this page's offerable rows up to the cap, or clear them when all already are. */
  const togglePage = () => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (pageAllSelected) {
        for (const s of offerableOnPage) next.delete(s.id);
      } else {
        for (const s of offerableOnPage) {
          if (next.size >= BULK_ASSIGN_MAX) break;
          next.set(s.id, s);
        }
      }
      return next;
    });
  };

  const removeSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });

  const keepFirstSelected = (count: number) =>
    setSelected((prev) => new Map([...prev].slice(0, count)));

  const clearSelected = () => setSelected(new Map());

  /** The row checkbox — only an offerable row gets one. */
  const renderSelect = (shipment: ShipmentListItem) => {
    if (!isBulkOfferable(shipment)) return null;
    const checked = selected.has(shipment.id);
    const blocked = !checked && atLimit;
    return (
      <Checkbox
        checked={checked}
        disabled={blocked}
        onCheckedChange={() => toggleSelected(shipment)}
        onClick={(e) => e.stopPropagation()}
        aria-label={t('bulkAssign.selectRow', { order: shipment.orderNumber })}
        title={blocked ? t('bulkAssign.limitReached', { max: BULK_ASSIGN_MAX }) : undefined}
      />
    );
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
        <VerifiedBadge verified={agentVerifiedFor(shipment.agentId)} className="-ms-0.5" />
      </Link>
    ) : shipment.trackingNumber ? (
      <span className="text-sm text-muted-foreground">{shipment.trackingNumber}</span>
    ) : (
      <span className="text-sm text-muted-foreground">{t('table.unassigned')}</span>
    );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('page.title')}
        description={t('page.description')}
        // Not an action but a status (the switch lives in Settings →
        // Preferences) — so it rides the bar directly instead of going through
        // `actionItems`, which can only describe things you press.
        actions={<AutoAssignStatusChip />}
      />

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
                      <th className="w-10 ps-4 pe-0 py-4">
                        {offerableOnPage.length > 0 && (
                          <Checkbox
                            checked={pageAllSelected ? true : pageSomeSelected ? 'indeterminate' : false}
                            disabled={!pageAllSelected && atLimit}
                            onCheckedChange={togglePage}
                            aria-label={t('bulkAssign.selectPage')}
                            title={t('bulkAssign.selectPage')}
                          />
                        )}
                      </th>
                      <th className="text-start p-4 text-sm font-medium">{t('table.shipment')}</th>
                      <th className="text-start p-4 text-sm font-medium">{t('table.vendor')}</th>
                      <th className="text-start p-4 text-sm font-medium">{t('table.customer')}</th>
                      <th className="text-start p-4 text-sm font-medium">{t('table.money')}</th>
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
                        <td className="w-10 ps-4 pe-0 py-4" onClick={(e) => e.stopPropagation()}>
                          {renderSelect(shipment)}
                        </td>
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
                        {/* The vendor's store, on every shipment — including one
                            collected from our own magazin: who supplied the goods
                            doesn't depend on where we pick them up. The phone is
                            the one thing dispatch calls when a pickup goes wrong,
                            so it dials straight from the row. */}
                        <td className="p-4">
                          <div className="flex items-start gap-2">
                            <Store className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <div className="flex max-w-[12rem] items-center gap-1 text-sm font-medium">
                                <span className="truncate" title={shipment.vendor.businessName}>
                                  {shipment.vendor.businessName}
                                </span>
                                <VerifiedBadge verified={shipment.vendor.verified} />
                              </div>
                              {shipment.vendor.phone && (
                                <a
                                  href={`tel:${shipment.vendor.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-muted-foreground hover:text-primary hover:underline"
                                >
                                  {shipment.vendor.phone}
                                </a>
                              )}
                            </div>
                          </div>
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
                        {/* Cash at the door + what the run pays us. Both are on
                            the row (not just the detail) because dispatch decides
                            what to send out, and to whom, off this list. */}
                        <td className="p-4">
                          <ShipmentMoneyCell shipment={shipment} />
                        </td>
                        <td className="p-4 text-sm">{formatDate(shipment.createdAt)}</td>
                        <td className="p-4">
                          <div className="flex flex-col items-start gap-1">
                            <ShipmentStatusBadge status={shipment.status} />
                            <DeliveryFeePendingChip pending={shipment.deliveryFeeProposalPending} />
                          </div>
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
                        {isBulkOfferable(shipment) && (
                          <span className="flex flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            {renderSelect(shipment)}
                          </span>
                        )}
                        <span className="min-w-0 truncate font-medium">{shipment.orderNumber}</span>
                        <span className="flex-shrink-0 text-muted-foreground">·</span>
                        <ShipmentStatusBadge status={shipment.status} className="flex-shrink-0" />
                        <DeliveryFeePendingChip
                          pending={shipment.deliveryFeeProposalPending}
                          className="flex-shrink-0"
                        />
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
                        <VerifiedBadge verified={shipment.vendor.verified} className="-ms-0.5" />
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
                          <VerifiedBadge verified={agentVerifiedFor(shipment.agentId)} />
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

                    {/* Cash to collect and our net on the run — laid out in a row
                        here, since a phone card has width to spare but not height. */}
                    <ShipmentMoneyCell
                      shipment={shipment}
                      className="mt-2 flex-row flex-wrap items-center"
                    />
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

      {/* Bulk offer bar — up whenever something is selected, pinned to the
          bottom so it stays in reach while scrolling for more rows. */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-background p-3 shadow-lg">
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">
              {t('bulkAssign.selected', { count: selected.size, max: BULK_ASSIGN_MAX })}
            </p>
            {atLimit && (
              <p className="text-xs text-muted-foreground">
                {t('bulkAssign.limitReached', { max: BULK_ASSIGN_MAX })}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={clearSelected}>
            {t('bulkAssign.clear')}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setBulkOpen(true)}>
            <UserPlus className="w-4 h-4" /> {t('bulkAssign.action')}
          </Button>
        </div>
      )}

      <BulkAssignDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        shipments={[...selected.values()]}
        agents={agents}
        onRemove={removeSelected}
        onKeepFirst={keepFirstSelected}
        onChanged={handleChanged}
        onDone={clearSelected}
      />

      <ShipmentDetailSheet
        shipmentId={selectedId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          // Drop `?open=` or the effect above reopens the sheet the user just
          // closed on the next render.
          if (!open) clearOpenParam();
        }}
        onChanged={handleChanged}
      />
    </div>
  );
}
