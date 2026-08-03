import { formatCurrency, formatDateTime as fmtDateTime } from '@/lib/format';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { codCashService } from '@/services/cod-cash.service';
import { CodRemittanceStatusBadge } from '@/components/cash/CodRemittanceStatusBadge';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { listSurfaceClass } from '@/components/layout/PageContainer';
import { getApiErrorMessage } from '@/lib/errors';
import type { CodListMeta, CodRemittance, CodRemittanceStatus } from '@/types/cod-cash.types';

const PAGE_LIMIT = 20;

function formatDateTime(iso: string): string {
  return fmtDateTime(iso);
}

export function RemittancesTab() {
  const { t } = useTranslation(['cash', 'common']);
  const [remittances, setRemittances] = useState<CodRemittance[]>([]);
  const [meta, setMeta] = useState<CodListMeta>({ total: 0, page: 1, limit: PAGE_LIMIT, pages: 1 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CodRemittanceStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const statusOptions = useMemo(
    () => [
      { value: 'all' as const, label: t('remittances.allStatuses') },
      { value: 'declared' as const, label: t('remittanceStatus.declared') },
      { value: 'confirmed' as const, label: t('remittanceStatus.confirmed') },
      { value: 'rejected' as const, label: t('remittanceStatus.rejected') },
    ],
    [t],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, meta: m } = await codCashService.listRemittances({
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        limit: PAGE_LIMIT,
      });
      setRemittances(data);
      setMeta(m);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async () => {
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0 || !reference.trim()) return;
    setIsSubmitting(true);
    try {
      await codCashService.declareRemittance(amountNum, reference.trim(), note || undefined);
      toast.success(t('remittances.declared'));
      setAmount('');
      setReference('');
      setNote('');
      setPage(1);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // The endpoint filters by status only, so text search narrows the loaded page.
  const query = search.trim().toLowerCase();
  const visibleRemittances = query
    ? remittances.filter((r) =>
        [r.reference, r.note].some((field) => field?.toLowerCase().includes(query)),
      )
    : remittances;

  return (
    <div className="space-y-6">
      <Card className="py-0 md:py-6">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">{t('remittances.declareTitle')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Input type="number" min={1} placeholder={t('remittances.amount')} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input placeholder={t('remittances.referencePlaceholder')} value={reference} onChange={(e) => setReference(e.target.value)} />
            <Input placeholder={t('remittances.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button className="gap-2" disabled={!amount || !reference.trim() || isSubmitting} onClick={handleSubmit}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {t('remittances.declare')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('remittances.declareHint')}</p>
        </CardContent>
      </Card>

      <SearchFilterBar
        value={search}
        onChange={setSearch}
        placeholder={t('remittances.searchPlaceholder')}
        searchLabel={t('remittances.searchLabel')}
        activeCount={statusFilter === 'all' ? 0 : 1}
        onReset={() => { setStatusFilter('all'); setPage(1); }}
        filterDescription={t('remittances.filterDescription')}
        resultCount={query ? visibleRemittances.length : meta.total}
        resultNounKey="common:nouns.remittance"
      >
        <FilterSection label={t('remittances.status')}>
          <FilterOptionGroup
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={statusOptions}
          />
        </FilterSection>
      </SearchFilterBar>

      <Card className={listSurfaceClass}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-start p-4 text-sm font-medium">{t('remittances.table.reference')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('remittances.table.amount')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('remittances.table.status')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('remittances.table.declared')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('remittances.table.resolved')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b"><td colSpan={5} className="p-4"><div className="h-10 bg-muted animate-pulse rounded" /></td></tr>
                  ))
                ) : loadError ? (
                  <tr><td colSpan={5} className="p-8 text-center"><p className="text-muted-foreground mb-4">{loadError}</p><Button variant="outline" onClick={load}>{t('common:actions.retry')}</Button></td></tr>
                ) : visibleRemittances.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {query ? t('remittances.emptyFiltered') : t('remittances.empty')}
                  </td></tr>
                ) : (
                  visibleRemittances.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium"><span className="block max-w-[16rem] truncate" title={r.reference}>{r.reference}</span></td>
                      <td className="p-4">{formatCurrency(r.amount, r.currency)}</td>
                      <td className="p-4"><CodRemittanceStatusBadge status={r.status} /></td>
                      <td className="p-4 text-sm text-muted-foreground">{formatDateTime(r.declaredAt)}</td>
                      <td className="p-4 text-sm text-muted-foreground">{r.resolvedAt ? formatDateTime(r.resolvedAt) : t('common:values.notAvailable')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!isLoading && !loadError && meta.pages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">{t('common:pagination.pageOf', { page: meta.page, total: meta.pages })}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={t('common:pagination.previous')}><ChevronLeft className="w-4 h-4 rtl:-scale-x-100" /></Button>
                <Button variant="outline" size="sm" disabled={meta.page >= meta.pages} onClick={() => setPage((p) => p + 1)} aria-label={t('common:pagination.next')}><ChevronRight className="w-4 h-4 rtl:-scale-x-100" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
