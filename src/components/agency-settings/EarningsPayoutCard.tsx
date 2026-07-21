import { useNavigate } from 'react-router-dom';
import { Clock, Loader2, Lock, Send, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEarnings } from '@/hooks/useEarnings';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { cn } from '@/lib/utils';
import type { EarningsPayoutStatus } from '@/types/earnings.types';

const STATUS_MAP: Record<EarningsPayoutStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-yellow-500 text-yellow-600 bg-yellow-50' },
  paid: { label: 'Paid', className: 'border-green-500 text-green-600 bg-green-50' },
  rejected: { label: 'Rejected', className: 'border-red-500 text-red-600 bg-red-50' },
};

function BalanceStat({
  icon: Icon,
  label,
  value,
  currency,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  currency: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border p-4 flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value.toLocaleString()} {currency}</p>
        <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>
      </div>
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
    </div>
  );
}

export function EarningsPayoutCard() {
  const { balance, latestPayout, isLoading, loadError, isRequesting, requestPayout, refetch } = useEarnings();
  const { session } = useOnboarding();
  const navigate = useNavigate();

  const hasPayoutMethod = (session?.role_entity?.payout_details?.length ?? 0) > 0;
  const hasPendingRequest = latestPayout?.status === 'pending';
  const hasAvailableBalance = (balance?.available ?? 0) > 0;

  const disabledReason = !hasPayoutMethod
    ? 'Add a payout method below before requesting a withdrawal.'
    : hasPendingRequest
      ? 'You already have a pending payout request.'
      : !hasAvailableBalance
        ? 'No available balance to withdraw yet.'
        : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Earnings</CardTitle>
        <CardDescription>
          Your delivery-fee balance — held while orders are in flight, released once completed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading earnings…
          </div>
        ) : loadError || !balance ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">{loadError ?? 'No data available.'}</p>
            <Button variant="outline" onClick={refetch}>Retry</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <BalanceStat
                icon={Clock}
                label="Pending"
                value={balance.pending}
                currency={balance.currency}
                hint="Held during the hold window, or COD cash not yet settled"
              />
              <BalanceStat
                icon={Wallet}
                label="Available"
                value={balance.available}
                currency={balance.currency}
                hint="Withdrawable now via a payout request"
              />
              <BalanceStat
                icon={Lock}
                label="Reserve"
                value={balance.reserve}
                currency={balance.currency}
                hint="COD security margin — parked 30 days"
              />
              <BalanceStat
                icon={Send}
                label="Requested"
                value={balance.requested}
                currency={balance.currency}
                hint="Earmarked for your pending payout request"
              />
            </div>

            {latestPayout && (
              <div className="rounded-lg border p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={cn(STATUS_MAP[latestPayout.status].className)}>
                    {STATUS_MAP[latestPayout.status].label}
                  </Badge>
                  <div className="text-sm">
                    <span className="font-medium">
                      {latestPayout.amount.toLocaleString()} {latestPayout.currency}
                    </span>
                    {latestPayout.status === 'rejected' && latestPayout.rejectionReason && (
                      <span className="text-muted-foreground"> — {latestPayout.rejectionReason}</span>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/tickets')}>
                  View in Tickets
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">{disabledReason}</p>
              <Button
                onClick={() => requestPayout()}
                disabled={!!disabledReason || isRequesting}
                className="gap-2"
              >
                {isRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isRequesting ? 'Requesting…' : 'Request Withdrawal'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
