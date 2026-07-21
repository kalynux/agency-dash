import { useNavigate } from 'react-router-dom';
import { Wallet, Clock, PiggyBank, Send, Loader2, Info, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AsyncBoundary } from '@/components/common/state-views';
import { useEarnings } from '@/hooks/useEarnings';
import { cn } from '@/lib/utils';
import type { EarningsPayoutStatus } from '@/types/earnings.types';

const AUTO_PAYOUT_THRESHOLD = 2_000_000;
const MIN_PAYOUT = 10_000;

const PAYOUT_STATUS_BADGE: Record<EarningsPayoutStatus, string> = {
  pending: 'border-amber-500 text-amber-600 bg-amber-50',
  paid: 'border-green-500 text-green-600 bg-green-50',
  rejected: 'border-red-500 text-red-600 bg-red-50',
};

function StatCard({ icon: Icon, label, value, currency, hint, accent }: {
  icon: React.ElementType; label: string; value: number; currency: string; hint?: string; accent?: boolean;
}) {
  return (
    <Card className={cn(accent && 'border-primary/30')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{currency}</span></p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Earnings() {
  const navigate = useNavigate();
  const { balance, latestPayout, isLoading, loadError, isRequesting, requestPayout, refetch } = useEarnings();

  const currency = balance?.currency ?? 'XAF';
  const canRequest = !!balance && balance.available >= MIN_PAYOUT && latestPayout?.status !== 'pending';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Earnings</h1>
          <p className="text-muted-foreground">Your delivery-fee balance and payout requests</p>
        </div>
        <Button variant="outline" size="icon" onClick={refetch} title="Refresh">
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      <AsyncBoundary isLoading={isLoading && !balance} error={loadError && !balance ? loadError : undefined} onRetry={refetch}>
        {balance && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Wallet} label="Available" value={balance.available} currency={currency} hint="Withdrawable now" accent />
              <StatCard icon={Clock} label="Pending" value={balance.pending} currency={currency} hint="Held until released / COD settled" />
              <StatCard icon={PiggyBank} label="Reserve" value={balance.reserve} currency={currency} hint="COD rolling reserve (30 days)" />
              <StatCard icon={Send} label="Requested" value={balance.requested} currency={currency} hint="Earmarked for a payout" />
            </div>

            {/* Payout action */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="font-medium">Request a payout</p>
                    <p className="text-sm text-muted-foreground">
                      A request sweeps your entire available balance and opens a payout ticket for the admin team.
                    </p>
                  </div>
                  <Button
                    className="gap-2"
                    disabled={!canRequest || isRequesting}
                    onClick={() => requestPayout()}
                  >
                    {isRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Withdraw {balance.available.toLocaleString()} {currency}
                  </Button>
                </div>
                {balance.available < MIN_PAYOUT && (
                  <p className="text-xs text-muted-foreground">
                    Minimum payout is {MIN_PAYOUT.toLocaleString()} {currency}.
                  </p>
                )}
                {latestPayout?.status === 'pending' && (
                  <p className="text-xs text-amber-600">A payout request is already in progress.</p>
                )}
                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                  <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    If your available balance reaches {AUTO_PAYOUT_THRESHOLD.toLocaleString()} {currency}, we automatically
                    request a payout on your behalf so funds don't sit unclaimed. Make sure a payout method is saved —
                    otherwise the automatic request can't be created.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Latest payout */}
            {latestPayout && (
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">Latest payout</p>
                        <Badge variant="outline" className={cn('capitalize', PAYOUT_STATUS_BADGE[latestPayout.status])}>
                          {latestPayout.status}
                        </Badge>
                        {latestPayout.origin === 'auto_threshold' && (
                          <Badge variant="secondary" className="text-xs">Automatic</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {latestPayout.amount.toLocaleString()} {latestPayout.currency} · requested{' '}
                        {new Date(latestPayout.createdAt).toLocaleDateString()}
                      </p>
                      {latestPayout.rejectionReason && (
                        <p className="text-sm text-destructive mt-1">Rejected: {latestPayout.rejectionReason}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/dashboard/tickets')}>
                      View ticket
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-muted-foreground">
              Manage your payout method under <button className="underline" onClick={() => navigate('/dashboard/account/payout')}>Account → Payout</button>.
            </p>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
