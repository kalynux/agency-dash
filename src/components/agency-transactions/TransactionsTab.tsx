import { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useTransactionStore } from '@/store';
import type { TransactionCategory } from '@/types';
import {
  TRANSACTION_CATEGORY_TABS,
  categoryLabel,
  transactionStatusMeta,
  transactionAmount,
} from './transactions.constants';

export function TransactionsTab() {
  const { transactions, isLoading, fetchTransactions } = useTransactionStore();
  const [activeCategory, setActiveCategory] = useState<TransactionCategory | 'all'>('all');

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filtered = activeCategory === 'all'
    ? transactions
    : transactions.filter((t) => t.category === activeCategory);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-4 border-b">
          <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as TransactionCategory | 'all')}>
            <TabsList>
              {TRANSACTION_CATEGORY_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 text-sm font-medium">Description</th>
                <th className="text-left p-4 text-sm font-medium">Category</th>
                <th className="text-left p-4 text-sm font-medium">Date</th>
                <th className="text-left p-4 text-sm font-medium">Status</th>
                <th className="text-right p-4 text-sm font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={5} className="p-4"><div className="h-10 bg-muted animate-pulse rounded" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Receipt className="w-12 h-12 text-muted-foreground" />
                      <p className="text-muted-foreground">No transactions found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const statusMeta = transactionStatusMeta[t.status];
                  return (
                    <tr key={t.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium">{t.description}</td>
                      <td className="p-4 text-sm text-muted-foreground">{categoryLabel(t.category)}</td>
                      <td className="p-4 text-sm text-muted-foreground">{formatDate(t.createdAt)}</td>
                      <td className="p-4">
                        <Badge variant="outline" className={cn('capitalize', statusMeta.className)}>
                          {statusMeta.label}
                        </Badge>
                      </td>
                      <td className={cn('p-4 text-right font-medium', t.direction === 'in' ? 'text-green-600' : 'text-foreground')}>
                        {transactionAmount(t.amount, t.currency, t.direction)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
