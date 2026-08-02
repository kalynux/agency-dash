import { formatCurrency, formatDateTime as fmtDateTime } from '@/lib/format';
import { useCallback, useEffect, useState } from 'react';
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
import { ApiError } from '@/types/api';
import type { CodListMeta, CodRemittance, CodRemittanceStatus } from '@/types/cod-cash.types';

const PAGE_LIMIT = 20;

const STATUS_FILTERS: { value: CodRemittanceStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'declared', label: 'Declared' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
];

function formatDateTime(iso: string): string {
  return fmtDateTime(iso);
}

export function RemittancesTab() {
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
      setLoadError(err instanceof ApiError ? err.message : 'Could not load remittance history.');
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
      toast.success('Remittance declared — awaiting platform confirmation.');
      setAmount('');
      setReference('');
      setNote('');
      setPage(1);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not declare this remittance.');
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
          <p className="text-sm font-medium">Declare a cash transfer to the platform</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Input type="number" min={1} placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input placeholder="Reference (e.g. bank tx id)" value={reference} onChange={(e) => setReference(e.target.value)} />
            <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button className="gap-2" disabled={!amount || !reference.trim() || isSubmitting} onClick={handleSubmit}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Declare
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            An admin confirms receipt; only then does your liability fall and collections settle (oldest first).
          </p>
        </CardContent>
      </Card>

      <SearchFilterBar
        value={search}
        onChange={setSearch}
        placeholder="Search remittances…"
        searchLabel="Search this page by reference or note"
        activeCount={statusFilter === 'all' ? 0 : 1}
        onReset={() => { setStatusFilter('all'); setPage(1); }}
        filterDescription="Status filters every remittance; search looks at the page you're on."
        resultCount={query ? visibleRemittances.length : meta.total}
        resultNoun="remittance"
      >
        <FilterSection label="Status">
          <FilterOptionGroup
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={STATUS_FILTERS}
          />
        </FilterSection>
      </SearchFilterBar>

      <Card className={listSurfaceClass}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 text-sm font-medium">Reference</th>
                  <th className="text-left p-4 text-sm font-medium">Amount</th>
                  <th className="text-left p-4 text-sm font-medium">Status</th>
                  <th className="text-left p-4 text-sm font-medium">Declared</th>
                  <th className="text-left p-4 text-sm font-medium">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b"><td colSpan={5} className="p-4"><div className="h-10 bg-muted animate-pulse rounded" /></td></tr>
                  ))
                ) : loadError ? (
                  <tr><td colSpan={5} className="p-8 text-center"><p className="text-muted-foreground mb-4">{loadError}</p><Button variant="outline" onClick={load}>Retry</Button></td></tr>
                ) : visibleRemittances.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {query ? 'No remittances match your search' : 'No remittances in this category yet'}
                  </td></tr>
                ) : (
                  visibleRemittances.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium"><span className="block max-w-[16rem] truncate" title={r.reference}>{r.reference}</span></td>
                      <td className="p-4">{formatCurrency(r.amount, r.currency)}</td>
                      <td className="p-4"><CodRemittanceStatusBadge status={r.status} /></td>
                      <td className="p-4 text-sm text-muted-foreground">{formatDateTime(r.declaredAt)}</td>
                      <td className="p-4 text-sm text-muted-foreground">{r.resolvedAt ? formatDateTime(r.resolvedAt) : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!isLoading && !loadError && meta.pages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">Page {meta.page} of {meta.pages}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" disabled={meta.page >= meta.pages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
