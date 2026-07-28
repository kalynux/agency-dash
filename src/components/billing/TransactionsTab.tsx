import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetchTransactions } from '@/services/transactions.service';
import type {
  Transaction,
  TransactionCategory,
  TransactionsListMeta,
} from '@/types/transactions.types';
import { ApiError } from '@/types/api';
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
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [rows, setRows] = useState<Transaction[]>([]);
  const [meta, setMeta] = useState<TransactionsListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(err instanceof ApiError ? err.message : 'Failed to load transactions.');
        setRows([]);
        setMeta(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Reset to page 1 when the category changes or a purchase succeeds.
  useEffect(() => {
    setPage(1);
  }, [category, refreshKey]);

  useEffect(() => {
    load(page, category);
  }, [load, page, category, refreshKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
        <CardDescription>
          Every money and credit movement on your account — plan purchases, credit top-ups and
          usage, and delivery-fee earnings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category sub-tabs */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
          {TRANSACTION_CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setCategory(tab.value)}
              className={cn(
                'flex-shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                category === tab.value
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background hover:bg-accent',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <LedgerSkeleton />
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}{' '}
            <button className="underline" onClick={() => load(page, category)}>
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No transactions yet.
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-lg border sm:block">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Activity</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                    <th className="px-4 py-2.5 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((tx) => {
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
                              via {gatewayLabel(tx.gateway)}
                            </p>
                          )}
                          {isReversalTransaction(tx) && (
                            <p className="mt-0.5 text-xs text-orange-600">
                              Chargeback/refund — this charge was unwound.
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

            {/* Mobile stacked rows */}
            <ul className="space-y-2 sm:hidden">
              {rows.map((tx) => {
                const amount = transactionAmount(tx);
                return (
                  <li key={tx.id} className="rounded-lg border p-3">
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
                      <p className="mt-2 text-xs text-orange-600">
                        Chargeback/refund — this charge was unwound.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            {meta && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Page {meta.page} of {meta.totalPages || 1}
                </span>
                {meta.totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.page >= meta.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
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
