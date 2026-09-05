import { formatCurrency, formatDate } from '@/lib/format';
import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
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

/** Colour per payout status; the label is keyed off the same enum in `account`. */
const STATUS_CLASS: Record<EarningsPayoutStatus, string> = {
  pending: 'border-yellow-500 text-yellow-600 bg-yellow-50',
  paid: 'border-green-500 text-green-600 bg-green-50',
  rejected: 'border-red-500 text-red-600 bg-red-50',
};

const STATUS_LABEL_KEY = {
  pending: 'earnings.status.pending',
  paid: 'earnings.status.paid',
  rejected: 'earnings.status.rejected',
} as const satisfies Record<EarningsPayoutStatus, string>;

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
  const { t } = useTranslation(['account', 'common']);
  return (
    <div className="flex grow basis-[calc(50%_-_0.5rem)] flex-col rounded-lg border p-3 sm:p-4 lg:basis-[calc(25%_-_0.75rem)]">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
          {label}
          {/* The hint is 2–3 wrapped lines in a half-width tile on a phone, which
              triples the tile's height for text the user reads once. */}
          <InfoHint
            className="md:hidden"
            label={t('earnings.balance.aboutLabel', { label: label.toLowerCase() })}
          >
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
  const { t } = useTranslation(['account', 'common']);
  const { balance, latestPayout, isLoading, loadError, isRequesting, requestPayout, refetch } = useEarnings();
  const { session } = useOnboarding();
  const navigate = useNavigate();

  const currency = balance?.currency ?? 'XAF';
  const hasPayoutMethod = (session?.role_entity?.payout_details?.length ?? 0) > 0;
  const hasPendingRequest = latestPayout?.status === 'pending';
  const available = balance?.available ?? 0;

  const disabledReason = !hasPayoutMethod
    ? t('earnings.blocked.noMethod')
    : hasPendingRequest
      ? t('earnings.blocked.pendingRequest')
      : available <= 0
        ? t('earnings.blocked.noBalance')
        : available < MIN_PAYOUT
          ? t('earnings.blocked.belowMinimum', { amount: formatCurrency(MIN_PAYOUT, currency) })
          : null;

  return (
    <Card className={sectionSurfaceClass}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 max-md:px-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            {t('earnings.title')}
            <InfoHint className="md:hidden" label={t('earnings.aboutLabel')}>
              <span className="block">{t('earnings.howItWorksLead')}</span>
              <span className="mt-2 block">
                <HowEarningsWork />
              </span>
            </InfoHint>
          </CardTitle>
          <CardDescription className="max-md:hidden">{t('earnings.description')}</CardDescription>
          <CardDescription className="md:hidden">{t('earnings.descriptionShort')}</CardDescription>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={refetch}
          title={t('earnings.refresh')}
          aria-label={t('earnings.refresh')}
          className="flex-shrink-0"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 max-md:px-0">
        {isLoading && !balance ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> {t('earnings.loading')}
          </div>
        ) : loadError || !balance ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">{loadError ?? t('earnings.noData')}</p>
            <Button variant="outline" onClick={refetch}>{t('common:actions.retry')}</Button>
          </div>
        ) : (
          <>
            <div className={BALANCE_ROW}>
              <BalanceStat
                icon={Wallet}
                label={t('earnings.balance.available')}
                value={balance.available}
                currency={balance.currency}
                hint={t('earnings.balance.availableHint')}
              />
              <BalanceStat
                icon={Clock}
                label={t('earnings.balance.pending')}
                value={balance.pending}
                currency={balance.currency}
                hint={t('earnings.balance.pendingHint')}
              />
              <BalanceStat
                icon={Lock}
                label={t('earnings.balance.reserve')}
                value={balance.reserve}
                currency={balance.currency}
                hint={t('earnings.balance.reserveHint')}
              />
              <BalanceStat
                icon={Send}
                label={t('earnings.balance.requested')}
                value={balance.requested}
                currency={balance.currency}
                hint={t('earnings.balance.requestedHint')}
              />
            </div>

            {/* When the money is earned, and what has already come out of it.
                Six lines of prose on a phone — folded into the ⓘ on the
                heading there, where it stays one tap away. */}
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 max-md:hidden">
              <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <HowEarningsWork />
              </p>
            </div>

            {latestPayout && (
              <div className="rounded-lg border p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={cn(STATUS_CLASS[latestPayout.status])}>
                    {t(STATUS_LABEL_KEY[latestPayout.status])}
                  </Badge>
                  {latestPayout.origin === 'auto_threshold' && (
                    <Badge variant="secondary" className="text-xs">
                      {t('earnings.status.automatic')}
                    </Badge>
                  )}
                  <div className="text-sm">
                    <span className="font-medium">
                      {formatCurrency(latestPayout.amount, latestPayout.currency)}
                    </span>
                    <span className="text-muted-foreground">
                      {' '}· {t('earnings.requestedOn', { date: formatDate(latestPayout.createdAt) })}
                    </span>
                    {latestPayout.status === 'rejected' && latestPayout.rejectionReason && (
                      <span className="text-destructive"> — {latestPayout.rejectionReason}</span>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/tickets')}>
                  {t('earnings.viewInTickets')}
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {disabledReason}
                <InfoHint className="md:hidden" label={t('earnings.autoPayoutLabel')}>
                  {t('earnings.autoPayout', {
                    threshold: formatCurrency(AUTO_PAYOUT_THRESHOLD, currency),
                  })}
                </InfoHint>
              </p>
              <Button
                onClick={() => requestPayout()}
                disabled={!!disabledReason || isRequesting}
                className="gap-2"
              >
                {isRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isRequesting
                  ? t('earnings.requesting')
                  : disabledReason
                    ? t('earnings.requestWithdrawal')
                    : t('earnings.withdraw', { amount: formatCurrency(available, currency) })}
              </Button>
            </div>

            {/* Mobile reads this from the ⓘ beside the withdraw row above. */}
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 max-md:hidden">
              <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                {t('earnings.autoPayout', {
                  threshold: formatCurrency(AUTO_PAYOUT_THRESHOLD, currency),
                })}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The "how earnings work" paragraph, shown inline on desktop and behind the ⓘ
 * on a phone. Uses `Trans` because the copy has one emphasised phrase in the
 * middle — the `<1>` placeholder lets a translator move it, which a split
 * string would not.
 */
function HowEarningsWork() {
  return (
    <Trans
      ns="account"
      i18nKey="earnings.howItWorks"
      components={{ strong: <span className="font-medium" /> }}
    />
  );
}
