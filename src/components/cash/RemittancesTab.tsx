import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { codCashService } from '@/services/cod-cash.service';
import { CodRemittanceStatusBadge } from '@/components/cash/CodRemittanceStatusBadge';
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
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function RemittancesTab() {
  const [remittances, setRemittances] = useState<CodRemittance[]>([]);
  const [meta, setMeta] = useState<CodListMeta>({ total: 0, page: 1, limit: PAGE_LIMIT, pages: 1 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CodRemittanceStatus | 'all'>('all');
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

  return (
    <div className="space-y-6">
      <Card>
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

      <Card>
        <CardContent className="p-4">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as CodRemittanceStatus | 'all'); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
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
                ) : remittances.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No remittances in this category yet</td></tr>
                ) : (
                  remittances.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium">{r.reference}</td>
                      <td className="p-4">{r.amount.toLocaleString()} {r.currency}</td>
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
