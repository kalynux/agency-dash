import { TransactionsTab } from '@/components/billing/TransactionsTab';
import { InfoHint } from '@/components/common/InfoHint';

export function Transactions() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-bold">
          Transactions
          <InfoHint className="md:hidden" label="About transactions">
            Every money and credit movement on your account — plan purchases, credit top-ups and
            usage, and delivery-fee earnings.
          </InfoHint>
        </h1>
        <p className="text-muted-foreground max-md:hidden">
          Every money and credit movement on your account — plan purchases, credit top-ups and
          delivery-fee earnings
        </p>
        <p className="text-muted-foreground md:hidden">Money and credit movements</p>
      </div>

      <TransactionsTab />
    </div>
  );
}
