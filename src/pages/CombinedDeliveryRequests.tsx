/**
 * Combined price requests — customers asking for ONE lower price on several of
 * their parcels from the same checkout that this agency carries (ADR-A11 D-8).
 *
 * A sub-page of Shipments: reached from the Shipments header and from the
 * `combined_delivery_request.received` notification, whose button names the
 * request's first parcel — that id arrives as `?shipment=` and the request
 * holding it is highlighted.
 *
 * Open is the default view: those are the requests waiting on an answer. Fees
 * only ever go down here, and every amount shown is the server's.
 *
 * See api-doc/agency/shipments.md § Combined delivery-price requests.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { listSurfaceClass, PageHeader } from '@/components/layout/PageContainer';
import { usePageRefresh } from '@/store/pageRefresh.store';
import { CombinedRequestCard } from '@/components/shipments/combined/CombinedRequestCard';
import { CombinedRespondDialog } from '@/components/shipments/combined/CombinedRespondDialog';
import { CombinedDeclineDialog } from '@/components/shipments/combined/CombinedDeclineDialog';
import { useParcelSummaries, type ParcelSummary } from '@/components/shipments/combined/useParcelSummaries';
import { combinedDeliveryRequestsService } from '@/services/combined-delivery-requests.service';
import { getApiErrorMessage } from '@/lib/errors';
import {
  COMBINED_DELIVERY_REQUEST_STATUSES,
  type CombinedDeliveryRequest,
  type CombinedDeliveryRequestListMeta,
  type CombinedDeliveryRequestStatus,
} from '@/types/combined-delivery-request.types';

const PAGE_LIMIT = 20;
const EMPTY_META: CombinedDeliveryRequestListMeta = { total: 0, page: 1, limit: PAGE_LIMIT, totalPages: 1 };

/** A card plus its parcels' names — read only for an open request, the one you act on. */
function RequestRow({
  request,
  highlighted,
  refreshKey,
  onLower,
  onDecline,
}: {
  request: CombinedDeliveryRequest;
  highlighted: boolean;
  refreshKey: number;
  onLower: (request: CombinedDeliveryRequest, summaries: Record<string, ParcelSummary | null>) => void;
  onDecline: (request: CombinedDeliveryRequest) => void;
}) {
  const { summaries } = useParcelSummaries(
    request.shipments.map((s) => s.shipmentId),
    request.status === 'open',
    refreshKey,
  );
  return (
    <CombinedRequestCard
      request={request}
      summaries={summaries}
      highlighted={highlighted}
      onLower={(r) => onLower(r, summaries)}
      onDecline={onDecline}
    />
  );
}

export function CombinedDeliveryRequests() {
  const { t } = useTranslation(['shipments', 'nav', 'common']);
  const [searchParams] = useSearchParams();
  const highlightShipment = searchParams.get('shipment');

  const [status, setStatus] = useState<CombinedDeliveryRequestStatus>('open');
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<CombinedDeliveryRequest[]>([]);
  const [meta, setMeta] = useState<CombinedDeliveryRequestListMeta>(EMPTY_META);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [lowering, setLowering] = useState<{
    request: CombinedDeliveryRequest;
    summaries: Record<string, ParcelSummary | null>;
  } | null>(null);
  const [declining, setDeclining] = useState<CombinedDeliveryRequest | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await combinedDeliveryRequestsService.list({ status, page, limit: PAGE_LIMIT });
      setRequests(res.data);
      setMeta(res.meta);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  usePageRefresh(() => {
    setRefreshKey((k) => k + 1);
    load();
  }, isLoading);

  /** An answer moved fees: reload the list and re-read the parcels' current fees. */
  const handleChanged = () => {
    setRefreshKey((k) => k + 1);
    load();
  };

  const statusOptions = COMBINED_DELIVERY_REQUEST_STATUSES.map((s) => ({
    value: s,
    label: t(`combined.status.${s}`),
  }));

  const rangeStart = requests.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const rangeEnd = (meta.page - 1) * meta.limit + requests.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        parent={t('nav:primary.shipments')}
        title={t('combined.title')}
        description={t('combined.description')}
        shortDescription={t('combined.shortDescription')}
        actions={
          <Button asChild variant="ghost" size="sm" className="gap-1.5 max-md:h-9 max-md:w-9 max-md:p-0">
            <Link to="/dashboard/shipments" aria-label={t('combined.back')} title={t('combined.back')}>
              <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
              <span className="max-md:hidden">{t('combined.back')}</span>
            </Link>
          </Button>
        }
      />

      <div className="space-y-1.5">
        <ChoiceChips
          label={t('combined.filterStatus')}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={statusOptions}
        />
        <p className="text-xs text-muted-foreground">{t('combined.filterDescription')}</p>
      </div>

      <Card className={listSurfaceClass}>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
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
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <Layers className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">{status === 'open' ? t('combined.emptyOpen') : t('combined.empty')}</p>
              <p className="max-w-md text-sm text-muted-foreground">
                {status === 'open' ? t('combined.emptyOpenBody') : t('combined.emptyBody')}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {requests.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  highlighted={!!highlightShipment && request.shipments.some((s) => s.shipmentId === highlightShipment)}
                  refreshKey={refreshKey}
                  onLower={(r, summaries) => setLowering({ request: r, summaries })}
                  onDecline={setDeclining}
                />
              ))}
            </div>
          )}

          {!isLoading && !loadError && meta.totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 border-t p-4">
              <p className="text-xs text-muted-foreground sm:text-sm">
                {t('common:pagination.showingRange', { from: rangeStart, to: rangeEnd, total: meta.total })}
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
                  {t('common:pagination.pageOf', { page: meta.page, total: meta.totalPages || 1 })}
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

      <CombinedRespondDialog
        request={lowering?.request ?? null}
        summaries={lowering?.summaries ?? {}}
        open={lowering !== null}
        onOpenChange={(open) => !open && setLowering(null)}
        onChanged={handleChanged}
      />
      <CombinedDeclineDialog
        request={declining}
        open={declining !== null}
        onOpenChange={(open) => !open && setDeclining(null)}
        onChanged={handleChanged}
      />
    </div>
  );
}
