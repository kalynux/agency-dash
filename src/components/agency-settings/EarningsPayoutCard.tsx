import { formatCurrency, formatDate } from '@/lib/format';
import { useNavigate } from 'react-router-dom';
import { Clock, Info, Loader2, Lock, RefreshCw, Send, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InfoHint } from '@/components/common/InfoHint';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/badge';
import { useEarnings } from '@/hooks/useEarnings';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { cn } from '@/lib/utils';
import type { EarningsPayoutStatus } from '@/types/earnings.types';

// Mirrors the backend EARNINGS_CONFIG — see api-doc/agency/earnings.md.
const MIN_PAYOUT = 10_000;
const AUTO_PAYOUT_THRESHOLD = 2_000_000;

const STATUS_MAP: Record<EarningsPayoutStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-yellow-500 text-yellow-600 bg-yellow-50' },
  paid: { label: 'Paid', className: 'border-green-500 text-green-600 bg-green-50' },
  rejected: { label: 'Rejected', className: 'border-red-500 text-red-600 bg-red-50' },
};

/**
 * One balance tile. Sized as a flex item so the row below can pair them up:
 * `basis` asks for half a row, while the amount's `whitespace-nowrap` sets the
 * tile's automatic minimum size. A tile whose figure needs more than half the
 * row therefore can't share one — see `BALANCE_ROW`.
 *
 * The icon sits beside the label rather than beside the amount so the figure
 * gets the tile's full inner width; sharing a row with a 36px chip would leave
 * roughly 70px for it on a phone, and every balance would then claim a row.
 */
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
    <div className="flex grow basis-[calc(50%_-_0.5rem)] flex-col rounded-lg border p-3 sm:p-4 lg:basis-[calc(25%_-_0.75rem)]">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
          {label}
          {/* The hint is 2–3 wrapped lines in a half-width tile on a phone, which
              triples the tile's height for text the user reads once. */}
          <InfoHint className="md:hidden" label={`About your ${label.toLowerCase()} balance`}>
            {hint}
          </InfoHint>
        </p>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-9 sm:w-9">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
      <p className="mt-2 whitespace-nowrap text-lg font-bold sm:text-2xl">{formatCurrency(value, currency)}</p>
      <p className="text-xs text-muted-foreground mt-1.5 max-md:hidden">{hint}</p>
    </div>
  );
}

/**
 * 2×2 on phones, one row of four from `lg`. A wrapping flex row rather than a
 * grid on purpose: grid tracks are fixed, so a long amount would either clip or
 * overflow its cell. Here each tile's minimum size is driven by its own
 * (non-wrapping) figure, so a balance too wide to sit beside a sibling pushes
 * itself onto its own full-width line instead.
 */
const BALANCE_ROW = 'flex flex-wrap gap-3 sm:gap-4';

export function EarningsPayoutCard() {
  const { balance, latestPayout, isLoading, loadError, isRequesting, requestPayout, refetch } = useEarnings();
  const { session } = useOnboarding();
  const navigate = useNavigate();

  const currency = balance?.currency ?? 'XAF';
  const hasPayoutMethod = (session?.role_entity?.payout_details?.length ?? 0) > 0;
  const hasPendingRequest = latestPayout?.status === 'pending';
  const available = balance?.available ?? 0;

  const disabledReason = !hasPayoutMethod
    ? 'Add a payout method below before requesting a withdrawal.'
    : hasPendingRequest
      ? 'You already have a pending payout request.'
      : available <= 0
        ? 'No available balance to withdraw yet.'
        : available < MIN_PAYOUT
          ? `Minimum payout is ${formatCurrency(MIN_PAYOUT, currency)}.`
          : null;

  return (
    <Card className={sectionSurfaceClass}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 max-md:px-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            Earnings
            <InfoHint className="md:hidden" label="About earnings">
              <span className="block">
                Your delivery-fee balance — held while orders are in flight, released once
                completed.
              </span>
              <span className="mt-2 block">
                You earn a delivery fee when the agent delivers the shipment — not when the
                customer pays — and one entry is created per shipment. What lands here is the fee{' '}
                <span className="font-medium">minus the delivering agent's contracted share</span>,
                which the platform pays them directly. It becomes available once the whole order
                completes and the hold window elapses (for COD, also once the cash is remitted and
                confirmed). A shipment that comes back earns your return-to-origin fee instead.
              </span>
            </InfoHint>
          </CardTitle>
          <CardDescription className="max-md:hidden">
            Your delivery-fee balance — held while orders are in flight, released once completed
          </CardDescription>
          <CardDescription className="md:hidden">Your delivery-fee balance</CardDescription>
        </div>
        <Button variant="outline" size="icon" onClick={refetch} title="Refresh" className="flex-shrink-0">
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 max-md:px-0">
        {isLoading && !balance ? (
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
            <div className={BALANCE_ROW}>
              <BalanceStat
                icon={Wallet}
                label="Available"
                value={balance.available}
                currency={balance.currency}
                hint="Withdrawable now via a payout request"
              />
              <BalanceStat
                icon={Clock}
                label="Pending"
                value={balance.pending}
                currency={balance.currency}
                hint="Held during the hold window, or COD cash not yet settled"
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

            {/* When the money is earned, and what has already come out of it.
                Six lines of prose on a phone — folded into the ⓘ on the
                heading there, where it stays one tap away. */}
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 max-md:hidden">
              <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                You earn a delivery fee when the agent delivers the shipment — not when the customer
                pays — and one entry is created per shipment. What lands here is the fee{' '}
                <span className="font-medium">minus the delivering agent's contracted share</span>,
                which the platform pays them directly. It becomes available once the whole order
                completes and the hold window elapses (for COD, also once the cash is remitted and
                confirmed). A shipment that comes back earns your return-to-origin fee instead.
              </p>
            </div>

            {latestPayout && (
              <div className="rounded-lg border p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={cn(STATUS_MAP[latestPayout.status].className)}>
                    {STATUS_MAP[latestPayout.status].label}
                  </Badge>
                  {latestPayout.origin === 'auto_threshold' && (
                    <Badge variant="secondary" className="text-xs">Automatic</Badge>
                  )}
                  <div className="text-sm">
                    <span className="font-medium">
                      {formatCurrency(latestPayout.amount, latestPayout.currency)}
                    </span>
                    <span className="text-muted-foreground">
                      {' '}· requested {formatDate(latestPayout.createdAt)}
                    </span>
                    {latestPayout.status === 'rejected' && latestPayout.rejectionReason && (
                      <span className="text-destructive"> — {latestPayout.rejectionReason}</span>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/tickets')}>
                  View in Tickets
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {disabledReason}
                <InfoHint className="md:hidden" label="About automatic payouts">
                  If your available balance reaches{' '}
                  {formatCurrency(AUTO_PAYOUT_THRESHOLD, currency)}, we automatically request a
                  payout on your behalf so funds don't sit unclaimed. Make sure a payout method is
                  saved — otherwise the automatic request can't be created.
                </InfoHint>
              </p>
              <Button
                onClick={() => requestPayout()}
                disabled={!!disabledReason || isRequesting}
                className="gap-2"
              >
                {isRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isRequesting
                  ? 'Requesting…'
                  : disabledReason
                    ? 'Request Withdrawal'
                    : `Withdraw ${formatCurrency(available, currency)}`}
              </Button>
            </div>

            {/* Mobile reads this from the ⓘ beside the withdraw row above. */}
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 max-md:hidden">
              <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                If your available balance reaches {formatCurrency(AUTO_PAYOUT_THRESHOLD, currency)}, we automatically
                request a payout on your behalf so funds don't sit unclaimed. Make sure a payout method is saved —
                otherwise the automatic request can't be created.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
