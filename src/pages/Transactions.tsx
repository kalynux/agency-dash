import { TransactionsTab } from '@/components/billing/TransactionsTab';

export function Transactions() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-muted-foreground">
          Every money and credit movement on your account — plan purchases, credit top-ups and
          delivery-fee earnings
        </p>
      </div>

      <TransactionsTab />
    </div>
  );
}
