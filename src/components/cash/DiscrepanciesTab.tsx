import { formatCurrency, formatDateTime as fmtDateTime } from '@/lib/format';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAgentsRoster } from '@/store/agents.store';
import { codCashService } from '@/services/cod-cash.service';
import { CodDiscrepancyStatusBadge } from '@/components/cash/CodDiscrepancyStatusBadge';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { listSurfaceClass } from '@/components/layout/PageContainer';
import { getApiErrorMessage } from '@/lib/errors';
import type {
  CodDiscrepancy,
  CodDiscrepancyStatus,
  CodDiscrepancyType,
  CodListMeta,
} from '@/types/cod-cash.types';

const PAGE_LIMIT = 20;

function formatDateTime(iso: string): string {
  return fmtDateTime(iso);
}

export function DiscrepanciesTab() {
  const { t } = useTranslation(['cash', 'common']);
  const { agents } = useAgentsRoster();
  const [discrepancies, setDiscrepancies] = useState<CodDiscrepancy[]>([]);
  const [meta, setMeta] = useState<CodListMeta>({ total: 0, page: 1, limit: PAGE_LIMIT, pages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CodDiscrepancyStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<CodDiscrepancyType | 'all'>('all');

  const [agentId, setAgentId] = useState('');
  const [type, setType] = useState<CodDiscrepancyType>('cash_shortfall');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const statusOptions = useMemo(
    () => [
      { value: 'all' as const, label: t('discrepancies.allStatuses') },
      { value: 'open' as const, label: t('discrepancyStatus.open') },
      { value: 'resolved' as const, label: t('discrepancyStatus.resolved') },
      { value: 'written_off' as const, label: t('discrepancyStatus.written_off') },
    ],
    [t],
  );

  const typeOptions = useMemo(
    () => [
      { value: 'all' as const, label: t('discrepancies.allTypes') },
      { value: 'cash_shortfall' as const, label: t('discrepancyType.cash_shortfall') },
      { value: 'other' as const, label: t('discrepancyType.other') },
    ],
    [t],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, meta: m } = await codCashService.listDiscrepancies({ page, limit: PAGE_LIMIT });
      setDiscrepancies(data);
      setMeta(m);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async () => {
    if (!agentId) return;
    setIsSubmitting(true);
    try {
      await codCashService.raiseDiscrepancy(agentId, type, amount ? Number(amount) : undefined, note || undefined);
      toast.success(t('discrepancies.raised'));
      setAmount('');
      setNote('');
      setPage(1);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? id;

  // The list endpoint takes page/limit only, so search and filters narrow the
  // page already loaded.
  const query = search.trim().toLowerCase();
  const visibleDiscrepancies = discrepancies.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (typeFilter !== 'all' && d.type !== typeFilter) return false;
    if (!query) return true;
    return [agentName(d.agentId), d.note, d.resolutionNote].some((field) =>
      field?.toLowerCase().includes(query),
    );
  });

  const activeFilterCount = (statusFilter === 'all' ? 0 : 1) + (typeFilter === 'all' ? 0 : 1);

  return (
    <div className="space-y-6">
      <Card className="py-0 md:py-6">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">{t('discrepancies.raiseTitle')}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="h-10 w-full min-w-0"><SelectValue placeholder={t('discrepancies.selectAgent')} /></SelectTrigger>
              <SelectContent>
                {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => setType(v as CodDiscrepancyType)}>
              <SelectTrigger className="h-10 w-full min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash_shortfall">{t('discrepancyType.cash_shortfall')}</SelectItem>
                <SelectItem value="other">{t('discrepancyType.other')}</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" min={0} placeholder={t('discrepancies.amountPlaceholder')} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input placeholder={t('discrepancies.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button variant="destructive" className="gap-2 sm:col-span-2 lg:col-span-1" disabled={!agentId || isSubmitting} onClick={handleSubmit}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
              {t('discrepancies.raise')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('discrepancies.raiseHint')}</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <p className="text-sm font-medium">{t('discrepancies.historyTitle')}</p>
        <SearchFilterBar
          value={search}
          onChange={setSearch}
          placeholder={t('discrepancies.searchPlaceholder')}
          searchLabel={t('discrepancies.searchLabel')}
          activeCount={activeFilterCount}
          onReset={() => { setStatusFilter('all'); setTypeFilter('all'); }}
          filterDescription={t('discrepancies.filterDescription')}
          resultCount={visibleDiscrepancies.length}
          resultNounKey="common:nouns.discrepancy"
        >
          <FilterSection label={t('discrepancies.status')}>
            <FilterOptionGroup value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
          </FilterSection>
          <FilterSection label={t('discrepancies.type')}>
            <FilterOptionGroup value={typeFilter} onChange={setTypeFilter} options={typeOptions} />
          </FilterSection>
        </SearchFilterBar>
      </div>

      <Card className={listSurfaceClass}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-start p-4 text-sm font-medium">{t('discrepancies.table.agent')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('discrepancies.table.type')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('discrepancies.table.amount')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('discrepancies.table.status')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('discrepancies.table.opened')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b"><td colSpan={5} className="p-4"><div className="h-10 bg-muted animate-pulse rounded" /></td></tr>
                  ))
                ) : loadError ? (
                  <tr><td colSpan={5} className="p-8 text-center"><p className="text-muted-foreground mb-4">{loadError}</p><Button variant="outline" onClick={load}>{t('common:actions.retry')}</Button></td></tr>
                ) : visibleDiscrepancies.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {discrepancies.length === 0
                      ? t('discrepancies.empty')
                      : t('discrepancies.emptyFiltered')}
                  </td></tr>
                ) : (
                  visibleDiscrepancies.map((d) => (
                    <tr key={d.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium"><span className="block max-w-[16rem] truncate" title={agentName(d.agentId)}>{agentName(d.agentId)}</span></td>
                      <td className="p-4 text-sm">{t(`discrepancyType.${d.type}` as 'discrepancyType.other')}</td>
                      <td className="p-4">{d.amount != null ? formatCurrency(d.amount, d.currency) : t('common:values.notAvailable')}</td>
                      <td className="p-4"><CodDiscrepancyStatusBadge status={d.status} /></td>
                      <td className="p-4 text-sm text-muted-foreground">{formatDateTime(d.openedAt)}</td>
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
