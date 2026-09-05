import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// Aliased: `tx` is already the row variable in this file's map callbacks.
import { tx as txKey } from '@/i18n/tx';
import { fetchTransactions } from '@/services/transactions.service';
import type {
  Transaction,
  TransactionCategory,
  TransactionsListMeta,
} from '@/types/transactions.types';
import { getApiErrorMessage } from '@/lib/errors';
import { listSurfaceClass } from '@/components/layout/PageContainer';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { LedgerSkeleton } from './BillingSkeletons';
import { formatDate, gatewayLabel } from './billing.constants';
import {
  TRANSACTION_CATEGORY_TABS,
  categoryLabel,
  transactionStatusMeta,
  transactionAmount,
  isReversalTransaction,
} from './transactions.constants';

const PAGE_LIMIT = 20;

type CategoryFilter = TransactionCategory | 'all';

/**
 * Unified account-activity feed: plan purchases, credit top-ups & usage, and
 * delivery-fee earnings in one place. Sub-tabs filter by `category` via the same
 * endpoint.
 *
 * `refreshKey` bumps to force a reload after a successful purchase elsewhere.
 */
export function TransactionsTab({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useTranslation(['billing', 'common']);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [rows, setRows] = useState<Transaction[]>([]);
  const [meta, setMeta] = useState<TransactionsListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(
    async (p: number, cat: CategoryFilter) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchTransactions({
          page: p,
          limit: PAGE_LIMIT,
          category: cat === 'all' ? undefined : cat,
        });
        setRows(res.data);
        setMeta(res.meta);
      } catch (err) {
        setError(getApiErrorMessage(err));
        setRows([]);
        setMeta(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const categoryOptions = useMemo(
    () => TRANSACTION_CATEGORY_TABS.map((c) => ({ value: c.value, label: txKey(t, c.labelKey) })),
    [t],
  );

  // Reset to page 1 when the category changes or a purchase succeeds.
  useEffect(() => {
    setPage(1);
  }, [category, refreshKey]);

  useEffect(() => {
    load(page, category);
  }, [load, page, category, refreshKey]);

  // The endpoint has no text search, so this narrows the page already loaded.
  const query = search.trim().toLowerCase();
  const visibleRows = query
    ? rows.filter(
        (tx) =>
          tx.description.toLowerCase().includes(query) ||
          categoryLabel(tx.category).toLowerCase().includes(query),
      )
    : rows;

  // No header of its own: the page above already states the title and the
  // description, and repeating them here read as the same block printed twice.
  return (
    <Card className={cn(listSurfaceClass, 'gap-4 md:gap-6')}>
      <CardContent className="space-y-4 px-4 py-4 md:px-6 md:py-0">
        <SearchFilterBar
          value={search}
          onChange={setSearch}
          placeholder={t('transactions.searchPlaceholder')}
          searchLabel={t('transactions.searchLabel')}
          activeCount={category === 'all' ? 0 : 1}
          onReset={() => setCategory('all')}
          filterDescription={t('transactions.filterDescription')}
          resultCount={query ? visibleRows.length : meta?.total}
          resultNounKey="common:nouns.transaction"
        >
          <FilterSection label={t('transactions.category')}>
            <FilterOptionGroup value={category} onChange={setCategory} options={categoryOptions} />
          </FilterSection>
        </SearchFilterBar>

        {loading ? (
          <LedgerSkeleton />
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}{' '}
            <button className="underline" onClick={() => load(page, category)}>
              {t('common:actions.retry')}
            </button>
          </div>
        ) : visibleRows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {query ? t('transactions.emptyFiltered') : t('transactions.empty')}
          </p>
        ) : (
          <>
            {/* Desktop table — switches at `md`, where the card regains its frame */}
            <div className="hidden overflow-hidden rounded-lg border md:block">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t('transactions.table.activity')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('transactions.table.date')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{t('transactions.table.amount')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{t('transactions.table.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((tx) => {
                    const amount = transactionAmount(tx);
                    return (
                      <tr key={tx.id} className="border-b align-top last:border-0">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{tx.description}</span>
                            <CategoryChip category={tx.category} />
                          </div>
                          {tx.gateway && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {t('transactions.via', { gateway: gatewayLabel(tx.gateway) })}
                            </p>
                          )}
                          {isReversalTransaction(tx) && (
                            <p className="mt-0.5 text-xs text-orange-600">
                              {t('transactions.reversalNote')}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDate(tx.createdAt)}</td>
                        <td className={cn('px-4 py-2.5 text-right font-medium', amount.className)}>
                          {amount.text}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <StatusBadge status={tx.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked rows — full-bleed, separated by a line */}
            <ul className="-mx-4 divide-y border-y md:hidden">
              {visibleRows.map((tx) => {
                const amount = transactionAmount(tx);
                return (
                  <li key={tx.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(tx.createdAt)}
                          {tx.gateway && ` · ${gatewayLabel(tx.gateway)}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className={cn('font-medium', amount.className)}>{amount.text}</p>
                        <StatusBadge status={tx.status} />
                      </div>
                    </div>
                    {isReversalTransaction(tx) && (
                      <p className="mt-2 text-xs text-orange-600">{t('transactions.reversalNote')}</p>
                    )}
                  </li>
                );
              })}
            </ul>

            {meta && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {t('common:pagination.pageOf', { page: meta.page, total: meta.totalPages || 1 })}
                </span>
                {meta.totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      {t('common:actions.previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.page >= meta.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {t('common:actions.next')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryChip({ category }: { category: TransactionCategory }) {
  return (
    <span className="rounded-full border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {categoryLabel(category)}
    </span>
  );
}

function StatusBadge({ status }: { status: Transaction['status'] }) {
  const meta = transactionStatusMeta(status);
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', meta.class)}>
      {meta.label}
    </span>
  );
}
