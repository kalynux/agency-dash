import { formatCurrency, formatDateTime as fmtDateTime } from '@/lib/format';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { codCashService } from '@/services/cod-cash.service';
import { CodRemittanceStatusBadge } from '@/components/cash/CodRemittanceStatusBadge';
import { CodProofImage } from '@/components/cash/CodProofImage';
import { CodProofPicker } from '@/components/cash/CodProofPicker';
import { CashFormField } from '@/components/cash/CashFormField';
import { AddRecordButton } from '@/components/common/AddRecordButton';
import { RecordCard, RecordCardList } from '@/components/common/RecordCard';
import { ResponsiveModal } from '@/components/common/ResponsiveModal';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { listSurfaceClass } from '@/components/layout/PageContainer';
import { useCreateParam } from '@/hooks/useOpenParam';
import { getApiErrorMessage, getErrorCode, getFieldErrorMessage } from '@/lib/errors';
import type { CodListMeta, CodRemittance, CodRemittanceStatus } from '@/types/cod-cash.types';
import { usePageRefresh } from '@/store/pageRefresh.store';

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

  const [formOpen, setFormOpen] = useCreateParam();
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);
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

  usePageRefresh(load, isLoading);

  // The receipt photo is what gates the declaration now; the reference is
  // optional, like the note (2026-09-27).
  const handleSubmit = async () => {
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0 || !proof) return;
    setIsSubmitting(true);
    try {
      await codCashService.declareRemittance(proof, amountNum, reference, note);
      toast.success(t('remittances.declared'));
      setFormOpen(false);
      setAmount('');
      setReference('');
      setNote('');
      setProof(null);
      setPage(1);
      load();
    } catch (err) {
      // A malformed field names itself in `details`; everything else resolves
      // by code. Both image refusals (wrong type — typically an iPhone HEIC —
      // or too big) get one sentence that says what to do instead.
      const fieldMessage =
        getErrorCode(err) === 'VALIDATION_ERROR' ? getFieldErrorMessage(err) : undefined;
      toast.error(
        fieldMessage ??
          getApiErrorMessage(err, {
            UPLOAD_POLICY_VIOLATION: 'cash:proof.invalid',
            CATALOG_FILE_TOO_LARGE: 'cash:proof.invalid',
          }),
      );
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
        trailing={
          <AddRecordButton
            label={t('remittances.declareAction')}
            icon={Send}
            onClick={() => setFormOpen(true)}
          />
        }
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
          {/* Mobile: one card per remittance. */}
          <RecordCardList>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4">
                  <div className="h-12 animate-pulse rounded bg-muted" />
                </div>
              ))
            ) : loadError ? (
              <div className="p-8 text-center">
                <p className="mb-4 text-sm text-muted-foreground">{loadError}</p>
                <Button variant="outline" onClick={load}>
                  {t('common:actions.retry')}
                </Button>
              </div>
            ) : visibleRemittances.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {query ? t('remittances.emptyFiltered') : t('remittances.empty')}
              </p>
            ) : (
              visibleRemittances.map((r) => (
                <RecordCard
                  key={r.id}
                  title={r.reference ?? t('remittances.noReference')}
                  badge={<CodRemittanceStatusBadge status={r.status} />}
                  primary={formatCurrency(r.amount, r.currency)}
                  meta={[formatDateTime(r.declaredAt)]}
                  fields={[
                    {
                      label: t('remittances.table.resolved'),
                      value: r.resolvedAt ? formatDateTime(r.resolvedAt) : '—',
                      hideWhenEmpty: false,
                    },
                    {
                      label: t('remittances.table.proof'),
                      value: (
                        <CodProofImage
                          key={r.id}
                          proof={r.proof}
                          fetchFile={() => codCashService.getRemittanceProofFile(r.id)}
                        />
                      ),
                    },
                  ]}
                  note={r.note}
                />
              ))
            )}
          </RecordCardList>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-start p-4 text-sm font-medium">{t('remittances.table.reference')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('remittances.table.amount')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('remittances.table.proof')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('remittances.table.status')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('remittances.table.declared')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('remittances.table.resolved')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b"><td colSpan={6} className="p-4"><div className="h-10 bg-muted animate-pulse rounded" /></td></tr>
                  ))
                ) : loadError ? (
                  <tr><td colSpan={6} className="p-8 text-center"><p className="text-muted-foreground mb-4">{loadError}</p><Button variant="outline" onClick={load}>{t('common:actions.retry')}</Button></td></tr>
                ) : visibleRemittances.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {query ? t('remittances.emptyFiltered') : t('remittances.empty')}
                  </td></tr>
                ) : (
                  visibleRemittances.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium">
                        {r.reference ? (
                          <span className="block max-w-[16rem] truncate" title={r.reference}>{r.reference}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4">{formatCurrency(r.amount, r.currency)}</td>
                      <td className="p-4">
                        <CodProofImage
                          key={r.id}
                          proof={r.proof}
                          fetchFile={() => codCashService.getRemittanceProofFile(r.id)}
                        />
                      </td>
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

      {/* Declare a transfer — a sheet on a phone, a dialog on desktop. The
          receipt photo is required; the reference is optional, like the note. */}
      <ResponsiveModal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={t('remittances.declareTitle')}
        description={t('remittances.declareHint')}
        desktopClassName="sm:max-w-md"
        mobileClassName="h-auto max-h-[92dvh]"
        disableClose={isSubmitting}
        footer={
          <>
            <Button
              variant="outline"
              className="max-md:w-full"
              disabled={isSubmitting}
              onClick={() => setFormOpen(false)}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              className="gap-2 max-md:w-full"
              disabled={!amount || !proof || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t('remittances.declare')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <CashFormField label={t('remittances.amount')} htmlFor="remittance-amount">
            <Input
              id="remittance-amount"
              type="number"
              inputMode="numeric"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </CashFormField>
          <CashFormField label={t('remittances.proofLabel')}>
            <CodProofPicker value={proof} onChange={setProof} disabled={isSubmitting} />
          </CashFormField>
          <CashFormField
            label={t('remittances.table.reference')}
            htmlFor="remittance-reference"
            optional
          >
            <Input
              id="remittance-reference"
              placeholder={t('remittances.referenceExample')}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </CashFormField>
          <CashFormField label={t('remittances.note')} htmlFor="remittance-note" optional>
            <Textarea
              id="remittance-note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </CashFormField>
        </div>
      </ResponsiveModal>
    </div>
  );
}
