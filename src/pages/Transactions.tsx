import { useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTransactionStore } from '@/store';
import { TransactionsTab } from '@/components/agency-transactions/TransactionsTab';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export function Transactions() {
  const { transactions, fetchTransactions } = useTransactionStore();

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const totals = useMemo(() => {
    const earned = transactions.filter(t => t.category === 'earning').reduce((sum, t) => sum + t.amount, 0);
    const paidOut = transactions.filter(t => t.category === 'payout' && t.status === 'paid').reduce((sum, t) => sum + t.amount, 0);
    const pending = transactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0);
    return { earned, paidOut, pending };
  }, [transactions]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-muted-foreground">Track your delivery earnings, payouts, and platform credits</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Earned</p>
              <p className="text-2xl font-bold">{formatCurrency(totals.earned)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Paid Out</p>
              <p className="text-2xl font-bold">{formatCurrency(totals.paidOut)}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{formatCurrency(totals.pending)}</p>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <Wallet className="w-5 h-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <TransactionsTab />
    </div>
  );
}
