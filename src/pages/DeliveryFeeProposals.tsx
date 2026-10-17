/**
 * Fee proposals to answer — delivery fees the PAYER proposed on this agency's
 * shipments (ADR-A12, 2026-10-14): the vendor on a shop-paid parcel, the
 * customer on a customer-paid one, higher or lower. Pickup waits for the answer.
 *
 * Pending is the default view: those are the ones holding a pickup. It includes
 * a higher fee you already accepted that is waiting for the customer's online
 * payment — still `pending`, still blocking, and still declinable.
 *
 * Accept / Decline come from `availableActions` only. Every figure is the
 * server's. See api-doc/agency/shipments.md § Answering a fee the PAYER proposed.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { listSurfaceClass, PageHeader } from '@/components/layout/PageContainer';
import { usePageRefresh } from '@/store/pageRefresh.store';
import { useFeeProposals } from '@/store/feeProposals.store';
import { PayerProposalCard } from '@/components/shipments/PayerProposalCard';
import { useParcelSummaries } from '@/components/shipments/combined/useParcelSummaries';
import { deliveryFeeProposalsService } from '@/services/delivery-fee-proposals.service';
import { getApiErrorMessage } from '@/lib/errors';
import {
  DELIVERY_FEE_PROPOSAL_STATUSES,
  type DeliveryFeeProposal,
  type DeliveryFeeProposalInboxMeta,
  type DeliveryFeeProposalStatus,
} from '@/types/delivery-fee-proposal.types';

const PAGE_LIMIT = 20;
const EMPTY_META: DeliveryFeeProposalInboxMeta = { total: 0, page: 1, limit: PAGE_LIMIT, totalPages: 1 };

export function DeliveryFeeProposals() {
  const { t } = useTranslation(['shipments', 'common']);
  const { refetch: refetchBadge } = useFeeProposals();

  const [status, setStatus] = useState<DeliveryFeeProposalStatus>('pending');
  const [page, setPage] = useState(1);
  const [proposals, setProposals] = useState<DeliveryFeeProposal[]>([]);
  const [meta, setMeta] = useState<DeliveryFeeProposalInboxMeta>(EMPTY_META);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // The rows carry ids only; the order number and customer come from each parcel.
  const { summaries } = useParcelSummaries(
    proposals.map((p) => p.shipmentId),
    proposals.length > 0,
    refreshKey,
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await deliveryFeeProposalsService.listInbox({ status, page, limit: PAGE_LIMIT });
      setProposals(res.data);
      setMeta(res.meta ?? EMPTY_META);
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
    load();
    void refetchBadge();
  }, isLoading);

  /** An answer (or a stale refusal) moved things: reload the list and the parcels' current fees. */
  const handleChanged = () => {
    setRefreshKey((k) => k + 1);
    load();
  };

  const statusOptions = DELIVERY_FEE_PROPOSAL_STATUSES.map((s) => ({
    value: s,
    label: t(`feeProposals.filter.${s}`),
  }));

  const rangeStart = proposals.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const rangeEnd = (meta.page - 1) * meta.limit + proposals.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('feeProposals.title')}
        description={t('feeProposals.description')}
        shortDescription={t('feeProposals.shortDescription')}
      />

      <div className="space-y-1.5">
        <ChoiceChips
          label={t('feeProposals.filterStatus')}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={statusOptions}
        />
        <p className="text-xs text-muted-foreground">{t('feeProposals.filterDescription')}</p>
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
          ) : proposals.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <Scale className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                {status === 'pending' ? t('feeProposals.emptyPending') : t('feeProposals.empty')}
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                {status === 'pending' ? t('feeProposals.emptyPendingBody') : t('feeProposals.emptyBody')}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {proposals.map((proposal) => (
                <PayerProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  summary={summaries[proposal.shipmentId] ?? null}
                  onChanged={handleChanged}
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
    </div>
  );
}
