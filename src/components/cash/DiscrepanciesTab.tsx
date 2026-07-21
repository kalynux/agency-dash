import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAgentsRoster } from '@/store/agents.store';
import { codCashService } from '@/services/cod-cash.service';
import { CodDiscrepancyStatusBadge } from '@/components/cash/CodDiscrepancyStatusBadge';
import { ApiError } from '@/types/api';
import type { CodDiscrepancy, CodDiscrepancyType, CodListMeta } from '@/types/cod-cash.types';

const PAGE_LIMIT = 20;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function DiscrepanciesTab() {
  const { agents } = useAgentsRoster();
  const [discrepancies, setDiscrepancies] = useState<CodDiscrepancy[]>([]);
  const [meta, setMeta] = useState<CodListMeta>({ total: 0, page: 1, limit: PAGE_LIMIT, pages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [agentId, setAgentId] = useState('');
  const [type, setType] = useState<CodDiscrepancyType>('cash_shortfall');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, meta: m } = await codCashService.listDiscrepancies({ page, limit: PAGE_LIMIT });
      setDiscrepancies(data);
      setMeta(m);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load discrepancy history.');
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
      toast.success('Discrepancy raised — an admin will review and resolve it.');
      setAmount('');
      setNote('');
      setPage(1);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not raise this discrepancy.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Flag a cash problem with an agent</p>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
              <SelectContent>
                {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => setType(v as CodDiscrepancyType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash_shortfall">Cash shortfall</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" min={0} placeholder="Amount at stake" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button variant="destructive" className="gap-2" disabled={!agentId || isSubmitting} onClick={handleSubmit}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
              Raise
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A cash shortfall applies an immediate trust penalty and blocks new COD assignments to that agent until resolved.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 text-sm font-medium">Agent</th>
                  <th className="text-left p-4 text-sm font-medium">Type</th>
                  <th className="text-left p-4 text-sm font-medium">Amount</th>
                  <th className="text-left p-4 text-sm font-medium">Status</th>
                  <th className="text-left p-4 text-sm font-medium">Opened</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b"><td colSpan={5} className="p-4"><div className="h-10 bg-muted animate-pulse rounded" /></td></tr>
                  ))
                ) : loadError ? (
                  <tr><td colSpan={5} className="p-8 text-center"><p className="text-muted-foreground mb-4">{loadError}</p><Button variant="outline" onClick={load}>Retry</Button></td></tr>
                ) : discrepancies.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No discrepancies raised yet</td></tr>
                ) : (
                  discrepancies.map((d) => (
                    <tr key={d.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium">{agentName(d.agentId)}</td>
                      <td className="p-4 text-sm capitalize">{d.type.replace(/_/g, ' ')}</td>
                      <td className="p-4">{d.amount != null ? `${d.amount.toLocaleString()} ${d.currency}` : '—'}</td>
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
