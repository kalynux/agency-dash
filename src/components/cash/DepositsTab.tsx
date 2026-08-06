import { formatCurrency, formatNumber, formatDateTime as fmtDateTime } from '@/lib/format';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { listSurfaceClass } from '@/components/layout/PageContainer';
import { useAgentsRoster } from '@/store/agents.store';
import { useCodCashActions } from '@/hooks/useCodCashActions';
import { codCashService } from '@/services/cod-cash.service';
import { getApiErrorMessage } from '@/lib/errors';
import type { CodDeposit, CodDepositStatus, CodListMeta } from '@/types/cod-cash.types';

const PAGE_LIMIT = 20;

function formatDateTime(iso: string | null): string {
  return fmtDateTime(iso);
}

export function DepositsTab() {
  const { t } = useTranslation(['cash', 'common']);
  const { agents, refetch: refetchRoster } = useAgentsRoster();
  const actions = useCodCashActions();

  const [deposits, setDeposits] = useState<CodDeposit[]>([]);
  const [meta, setMeta] = useState<CodListMeta>({ total: 0, page: 1, limit: PAGE_LIMIT, pages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CodDepositStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [declaredCount, setDeclaredCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [agentId, setAgentId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const [rejectTarget, setRejectTarget] = useState<CodDeposit | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const statusOptions = useMemo(
    () => [
      { value: 'all' as const, label: t('deposits.allDeposits') },
      { value: 'declared' as const, label: t('deposits.awaitingAnswer') },
      { value: 'confirmed' as const, label: t('depositStatus.confirmed') },
      { value: 'rejected' as const, label: t('depositStatus.rejected') },
    ],
    [t],
  );

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

  // The endpoint filters by status only, so text search narrows the loaded page.
  const query = search.trim().toLowerCase();
  const visibleDeposits = query
    ? deposits.filter((d) =>
        [agentName(d.agentId), d.reference, d.note].some((field) =>
          field?.toLowerCase().includes(query),
        ),
      )
    : deposits;

  return (
    <div className="space-y-6">
      {/* Declarations alert */}
      {declaredCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/60 py-0 md:py-6">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                {t('deposits.alertTitle', { count: declaredCount })}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">{t('deposits.alertBody')}</p>
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
                {t('deposits.review')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Record form */}
      <Card className="py-0 md:py-6">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">{t('deposits.recordTitle')}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="h-10 w-full min-w-0">
                {/* Only the name in the trigger — the held amount stays in the options, which have room for it. */}
                <SelectValue placeholder={t('deposits.selectAgent')}>
                  {agentId ? agentName(agentId) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {t('deposits.agentOption', { name: a.name, amount: formatNumber(a.cashHeld) })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" min={1} placeholder={t('deposits.amount')} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input placeholder={t('deposits.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
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
              {t('deposits.record')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('deposits.recordHint')}</p>
        </CardContent>
      </Card>

      {/* Search & filter */}
      <div className="space-y-3">
        <p className="text-sm font-medium">{t('deposits.historyTitle')}</p>
        <SearchFilterBar
          value={search}
          onChange={setSearch}
          placeholder={t('deposits.searchPlaceholder')}
          searchLabel={t('deposits.searchLabel')}
          activeCount={status === 'all' ? 0 : 1}
          onReset={() => {
            setStatus('all');
            setPage(1);
          }}
          filterDescription={t('deposits.filterDescription')}
          resultCount={query ? visibleDeposits.length : meta.total}
          resultNounKey="common:nouns.deposit"
        >
          <FilterSection label={t('deposits.status')}>
            <FilterOptionGroup
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={statusOptions}
            />
          </FilterSection>
        </SearchFilterBar>
      </div>

      {/* Table */}
      <Card className={listSurfaceClass}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-start p-4 text-sm font-medium">{t('deposits.table.agent')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('deposits.table.amount')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('deposits.table.recipient')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('deposits.table.status')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('deposits.table.date')}</th>
                  <th className="text-end p-4 text-sm font-medium">{t('deposits.table.actions')}</th>
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
                        {t('common:actions.retry')}
                      </Button>
                    </td>
                  </tr>
                ) : visibleDeposits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      {query ? t('deposits.emptyFiltered') : t('deposits.empty')}
                    </td>
                  </tr>
                ) : (
                  visibleDeposits.map((d) => {
                    const isDeclared = d.status === 'declared';
                    const isAgencyRecipient = (d.recipient ?? 'agency') === 'agency';
                    const actionable = isDeclared && isAgencyRecipient;
                    return (
                      <tr key={d.id} className="border-b hover:bg-muted/50 transition-colors align-top">
                        <td className="p-4 font-medium"><span className="block max-w-[16rem] truncate" title={agentName(d.agentId)}>{agentName(d.agentId)}</span></td>
                        <td className="p-4">
                          {formatCurrency(d.amount, d.currency)}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {t(`recipient.${d.recipient ?? 'agency'}` as 'recipient.agency')}
                          {d.reference && (
                            <div className="text-xs">
                              {t('deposits.table.reference', { reference: d.reference })}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          {d.status ? (
                            <CodDepositStatusBadge status={d.status} />
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              {t('common:values.notAvailable')}
                            </span>
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
                        <td className="p-4 text-end">
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
                                {t('deposits.confirm')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={() => setRejectTarget(d)}
                              >
                                <X className="w-3.5 h-3.5" />
                                {t('deposits.reject')}
                              </Button>
                            </div>
                          ) : isDeclared ? (
                            <span className="text-xs text-muted-foreground">
                              {t('deposits.table.awaitingAdmin')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {t('common:values.notAvailable')}
                            </span>
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
                {t('common:pagination.pageOf', { page: meta.page, total: meta.pages })}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={t('common:pagination.previous')}>
                  <ChevronLeft className="w-4 h-4 rtl:-scale-x-100" />
                </Button>
                <Button variant="outline" size="sm" disabled={meta.page >= meta.pages} onClick={() => setPage((p) => p + 1)} aria-label={t('common:pagination.next')}>
                  <ChevronRight className="w-4 h-4 rtl:-scale-x-100" />
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
            <DialogTitle>{t('deposits.rejectTitle')}</DialogTitle>
            <DialogDescription>{t('deposits.rejectDescription')}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t('deposits.rejectPlaceholder')}
            rows={3}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || (rejectTarget ? actions.pendingKey === `reject:${rejectTarget.id}` : false)}
              onClick={handleReject}
            >
              {rejectTarget && actions.pendingKey === `reject:${rejectTarget.id}` ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('deposits.rejectSubmit')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
