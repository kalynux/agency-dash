import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Package, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { shipmentsService } from '@/services/shipments.service';
import { useShipments } from '@/store/shipments.store';
import { ShipmentStatusBadge } from '@/components/shipments/ShipmentStatusBadge';
import { ShipmentDetailSheet } from '@/components/shipments/ShipmentDetailSheet';
import { ApiError } from '@/types/api';
import { cn } from '@/lib/utils';
import type { ShipmentListItem, ShipmentListMeta, ShipmentStatus } from '@/types/shipment.types';

const STATUS_FILTERS: { value: ShipmentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'agent_delivered', label: 'Awaiting Confirmation' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
  { value: 'returned', label: 'Returned' },
  { value: 'rejected', label: 'Rejected' },
];

const PAGE_LIMIT = 20;

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function Shipments() {
  const { refetch: refetchBadge } = useShipments();
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [meta, setMeta] = useState<ShipmentListMeta>({ total: 0, page: 1, limit: PAGE_LIMIT, pages: 1 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
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
        page,
        limit: PAGE_LIMIT,
      });
      setShipments(data);
      setMeta(m);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load your shipments.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusFilterChange = (value: ShipmentStatus | 'all') => {
    setStatusFilter(value);
    setPage(1);
  };

  const filtered = shipments.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.orderNumber.toLowerCase().includes(q) ||
      s.customer.name.toLowerCase().includes(q) ||
      s.vendor.businessName.toLowerCase().includes(q)
    );
  });

  const openDetail = (id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
  };

  const handleChanged = () => {
    load();
    refetchBadge();
  };

  const rangeStart = shipments.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const rangeEnd = (meta.page - 1) * meta.limit + shipments.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Shipments</h1>
          <p className="text-muted-foreground">
            Shipments assigned to your agency for pickup and delivery
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={load} disabled={isLoading}>
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search this page by order #, customer, or vendor…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => handleStatusFilterChange(v as ShipmentStatus | 'all')}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Shipments Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 text-sm font-medium">Shipment</th>
                  <th className="text-left p-4 text-sm font-medium">Vendor</th>
                  <th className="text-left p-4 text-sm font-medium">Customer</th>
                  <th className="text-left p-4 text-sm font-medium">Date</th>
                  <th className="text-left p-4 text-sm font-medium">Status</th>
                  <th className="text-left p-4 text-sm font-medium">Tracking #</th>
                  <th className="w-20 p-4"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={7} className="p-4">
                        <div className="h-12 bg-muted animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : loadError ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center">
                      <p className="text-muted-foreground mb-4">{loadError}</p>
                      <Button variant="outline" onClick={load}>
                        Retry
                      </Button>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          {shipments.length === 0 ? 'No shipments in this category yet' : 'No shipments match your search'}
                        </p>
                        {searchQuery && (
                          <Button variant="outline" onClick={() => setSearchQuery('')}>
                            Clear search
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((shipment) => (
                    <tr
                      key={shipment.id}
                      className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => openDetail(shipment.id)}
                    >
                      <td className="p-4">
                        <div className="font-medium">{shipment.orderNumber}</div>
                        <div className="text-sm text-muted-foreground">
                          {shipment.itemCount} item{shipment.itemCount === 1 ? '' : 's'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">{shipment.vendor.businessName}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                            {initials(shipment.customer.name)}
                          </div>
                          <div>
                            <div className="font-medium">{shipment.customer.name}</div>
                            <div className="text-sm text-muted-foreground">{shipment.customer.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm">{formatDate(shipment.createdAt)}</td>
                      <td className="p-4">
                        <ShipmentStatusBadge status={shipment.status} />
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{shipment.trackingNumber ?? '—'}</td>
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openDetail(shipment.id); }}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isLoading && !loadError && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {rangeStart}–{rangeEnd} of {meta.total} shipments
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {meta.page} of {meta.pages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
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
