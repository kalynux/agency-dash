import { formatCurrency, formatNumber, formatDateTime as fmtDateTime } from '@/lib/format';
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, HandCoins, Loader2, AlertTriangle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CodDepositStatusBadge } from '@/components/cash/CodDepositStatusBadge';
import { useAgentsRoster } from '@/store/agents.store';
import { useCodCashActions } from '@/hooks/useCodCashActions';
import { codCashService } from '@/services/cod-cash.service';
import { getApiErrorMessage } from '@/lib/errors';
import type { CodDeposit, CodDepositStatus, CodListMeta } from '@/types/cod-cash.types';

const PAGE_LIMIT = 20;

const STATUS_FILTERS: { value: CodDepositStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All deposits' },
  { value: 'declared', label: 'Awaiting your answer' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
];

function formatDateTime(iso: string | null): string {
  return fmtDateTime(iso);
}

export function DepositsTab() {
  const { agents, refetch: refetchRoster } = useAgentsRoster();
  const actions = useCodCashActions();

  const [deposits, setDeposits] = useState<CodDeposit[]>([]);
  const [meta, setMeta] = useState<CodListMeta>({ total: 0, page: 1, limit: PAGE_LIMIT, pages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CodDepositStatus | 'all'>('all');
  const [declaredCount, setDeclaredCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [agentId, setAgentId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const [rejectTarget, setRejectTarget] = useState<CodDeposit | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [list, declared] = await Promise.all([
        codCashService.listDeposits({
          page,
          limit: PAGE_LIMIT,
          status: status === 'all' ? undefined : status,
        }),
        codCashService.listDeposits({ status: 'declared', page: 1, limit: 1 }),
      ]);
      setDeposits(list.data);
      setMeta(list.meta);
      setDeclaredCount(declared.meta.total);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    load();
    refetchRoster();
  };

  const handleRecord = async () => {
    const amountNum = Number(amount);
    if (!agentId || !amountNum || amountNum <= 0) return;
    const result = await actions.recordDeposit(agentId, amountNum, note || undefined);
    if (result) {
      setAmount('');
      setNote('');
      setPage(1);
      refresh();
    }
  };

  const handleConfirm = async (id: string) => {
    const result = await actions.confirmDeposit(id);
    if (result) refresh();
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    const result = await actions.rejectDeposit(rejectTarget.id, rejectReason.trim());
    if (result) {
      setRejectTarget(null);
      setRejectReason('');
      refresh();
    }
  };

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      {/* Declarations alert */}
      {declaredCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                {declaredCount} hand-over{declaredCount === 1 ? '' : 's'} awaiting your answer
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Confirm or reject within 2 days. Leaving a declaration unanswered opens a
                discrepancy that freezes your rolling-reserve releases.
              </p>
            </div>
            {status !== 'declared' && (
              <Button
                size="sm"
                variant="outline"
                className="flex-shrink-0"
                onClick={() => {
                  setStatus('declared');
                  setPage(1);
                }}
              >
                Review
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Record form */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Record cash received from an agent</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({formatNumber(a.cashHeld)} held)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" min={1} placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button
              className="gap-2"
              disabled={!agentId || !amount || actions.pendingKey === 'record-deposit'}
              onClick={handleRecord}
            >
              {actions.pendingKey === 'record-deposit' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <HandCoins className="w-4 h-4" />
              )}
              Record Deposit
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            If the agent handed over less than they hold, record what you actually received and raise a
            discrepancy for the difference.
          </p>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Deposit history</p>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as CodDepositStatus | 'all');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-56">
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 text-sm font-medium">Agent</th>
                  <th className="text-left p-4 text-sm font-medium">Amount</th>
                  <th className="text-left p-4 text-sm font-medium">Recipient</th>
                  <th className="text-left p-4 text-sm font-medium">Status</th>
                  <th className="text-left p-4 text-sm font-medium">Date</th>
                  <th className="text-right p-4 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={6} className="p-4">
                        <div className="h-10 bg-muted animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : loadError ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center">
                      <p className="text-muted-foreground mb-4">{loadError}</p>
                      <Button variant="outline" onClick={load}>
                        Retry
                      </Button>
                    </td>
                  </tr>
                ) : deposits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No deposits in this view
                    </td>
                  </tr>
                ) : (
                  deposits.map((d) => {
                    const isDeclared = d.status === 'declared';
                    const isAgencyRecipient = (d.recipient ?? 'agency') === 'agency';
                    const actionable = isDeclared && isAgencyRecipient;
                    return (
                      <tr key={d.id} className="border-b hover:bg-muted/50 transition-colors align-top">
                        <td className="p-4 font-medium"><span className="block max-w-[16rem] truncate" title={agentName(d.agentId)}>{agentName(d.agentId)}</span></td>
                        <td className="p-4">
                          {formatCurrency(d.amount, d.currency)}
                        </td>
                        <td className="p-4 text-sm capitalize text-muted-foreground">
                          {d.recipient ?? 'agency'}
                          {d.reference && <div className="text-xs">Ref: {d.reference}</div>}
                        </td>
                        <td className="p-4">
                          {d.status ? (
                            <CodDepositStatusBadge status={d.status} />
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                          {d.rejectionReason && (
                            <div className="text-xs text-muted-foreground mt-1 max-w-[16rem]">
                              {d.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {formatDateTime(d.declaredAt ?? d.recordedAt)}
                          {d.note && <div className="text-xs">{d.note}</div>}
                        </td>
                        <td className="p-4 text-right">
                          {actionable ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                className="gap-1"
                                disabled={actions.pendingKey === `confirm:${d.id}`}
                                onClick={() => handleConfirm(d.id)}
                              >
                                {actions.pendingKey === `confirm:${d.id}` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={() => setRejectTarget(d)}
                              >
                                <X className="w-3.5 h-3.5" />
                                Reject
                              </Button>
                            </div>
                          ) : isDeclared ? (
                            <span className="text-xs text-muted-foreground">Awaiting admin</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!isLoading && !loadError && meta.pages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.pages}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={meta.page >= meta.pages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject reason dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject declaration</DialogTitle>
            <DialogDescription>
              No money moves. The agent's late-deposit clock resumes and an admin can see both sides.
              Rejecting a claim you dispute is a normal, cost-free action.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Nothing was handed over at the desk; our till reconciles."
            rows={3}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || (rejectTarget ? actions.pendingKey === `reject:${rejectTarget.id}` : false)}
              onClick={handleReject}
            >
              {rejectTarget && actions.pendingKey === `reject:${rejectTarget.id}` ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Reject declaration'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
