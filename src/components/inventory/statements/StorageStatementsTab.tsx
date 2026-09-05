/**
 * Storage statements — the monthly record of what each vendor owes for
 * warehousing their stock.
 *
 * ⚠ ─── THIS SCREEN'S ONE WAY OF MISLEADING ─────────────────────────────────
 *
 * **The platform moves none of this money.** It does not charge the vendor, does
 * not pay the agency, and takes no commission. A statement exists so both sides
 * read the same durable, dated number instead of the agency quoting a live
 * figure off its own inventory screen.
 *
 * "Settle" is therefore the agency *stating it was paid out of band* — not a
 * payment, not a charge, and nothing verifies it. A Settle button that reads
 * like "Pay" is the single way this screen can lie, so the notice below is not
 * decoration and the confirm copy says "record" rather than "pay".
 *
 * ─── Why it lives beside Inventory ────────────────────────────────────────────
 *
 * Only **counted** stock is billed: a shelf with no recorded receipt has no
 * quantity the platform is willing to claim, so it is not on the statement at
 * all. An agency that records no intake is invoiced for nothing. That makes this
 * screen the direct consequence of the Stock tab's counting verbs, which is why
 * it is a sibling tab rather than a separate nav item.
 *
 * See api-doc/agency/storage-invoices.md.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, FileText, Info, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { listSurfaceClass, type RenderPageHeader } from '@/components/layout/PageContainer';
import { StorageStatementSheet } from '@/components/inventory/statements/StorageStatementSheet';
import { storageInvoicesService } from '@/services/storage-invoices.service';
import { getApiErrorMessage } from '@/lib/errors';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { tx } from '@/i18n/tx';
import { cn } from '@/lib/utils';
import type {
  ListStorageInvoicesParams,
  StorageInvoice,
  StorageInvoiceListMeta,
  StorageInvoiceStatus,
} from '@/types/storage-invoice.types';

const PAGE_LIMIT = 20;

const EMPTY_META: StorageInvoiceListMeta = { total: 0, page: 1, limit: PAGE_LIMIT, totalPages: 1 };

const STATUSES: StorageInvoiceStatus[] = ['open', 'settled', 'void'];

/** Status tint. `open` is not "overdue" — nothing chases these, on either side. */
const STATUS_STYLE: Record<StorageInvoiceStatus, string> = {
  open: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  settled:
    'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800',
  void: 'text-muted-foreground bg-muted border-border',
};

export function StorageStatementsTab({ renderHeader }: { renderHeader: RenderPageHeader }) {
  const { t } = useTranslation(['inventory', 'common']);

  const [invoices, setInvoices] = useState<StorageInvoice[]>([]);
  const [meta, setMeta] = useState<StorageInvoiceListMeta>(EMPTY_META);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const params: ListStorageInvoicesParams = { page, limit: PAGE_LIMIT };
      if (status !== 'all') params.status = status as StorageInvoiceStatus;
      const res = await storageInvoicesService.list(params);
      setInvoices(res.data);
      setMeta(res.meta ?? EMPTY_META);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const rangeStart = (meta.page - 1) * meta.limit + 1;
  const rangeEnd = Math.min(meta.page * meta.limit, meta.total);

  const header = useMemo(
    () =>
      renderHeader([
        {
          id: 'reload',
          label: t('common:actions.refresh'),
          icon: RefreshCw,
          onSelect: () => void load(),
        },
      ]),
    [renderHeader, load, t],
  );

  return (
    <div className="space-y-4">
      {header}

      {/* Stated once, at the top, before any number or button. */}
      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <p>{t('statements.recordNotice')}</p>
      </div>

      {/* Filter-only: the endpoint takes no free-text search, and a dead search
          box invites a query that can never match. */}
      <SearchFilterBar
        activeCount={status === 'all' ? 0 : 1}
        onReset={() => {
          setStatus('all');
          setPage(1);
        }}
      >
        <FilterSection label={t('statements.filterStatus')}>
          <FilterOptionGroup
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: 'all', label: t('statements.statuses.all') },
              ...STATUSES.map((s) => ({ value: s, label: tx(t, `inventory:statements.statuses.${s}`) })),
            ]}
          />
        </FilterSection>
      </SearchFilterBar>

      <Card className={listSurfaceClass}>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : loadError ? (
            <div className="p-8 text-center">
              <p className="mb-4 text-muted-foreground">{loadError}</p>
              <Button variant="outline" onClick={() => void load()}>
                {t('common:actions.retry')}
              </Button>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">{t('statements.empty')}</p>
                {/* The commonest reason for an empty list is not "no vendors" —
                    it is that nothing has been counted, so nothing is billable. */}
                <p className="max-w-md text-sm text-muted-foreground">
                  {t('statements.emptyHint')}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {invoices.map((invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  onClick={() => setOpenId(invoice.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{invoice.periodKey}</span>
                      <Badge variant="outline" className={cn('text-[10px]', STATUS_STYLE[invoice.status])}>
                        {tx(t, `inventory:statements.statuses.${invoice.status}`)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('statements.rowSummary', {
                        skus: formatNumber(invoice.skuCount),
                        units: formatNumber(invoice.unitCount),
                      })}
                      {' · '}
                      {t('statements.issued', { date: formatDate(invoice.issuedAt) })}
                    </p>
                  </div>
                  <span className="flex-shrink-0 font-mono text-sm font-medium">
                    {formatCurrency(invoice.total)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!isLoading && !loadError && meta.totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 border-t p-4">
              <p className="text-xs text-muted-foreground sm:text-sm">
                {t('common:pagination.showingRange', {
                  from: rangeStart,
                  to: rangeEnd,
                  total: meta.total,
                })}
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

      <StorageStatementSheet
        invoiceId={openId}
        open={openId !== null}
        onOpenChange={(next) => !next && setOpenId(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}
