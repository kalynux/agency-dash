import { formatCurrency, formatDate } from '@/lib/format';
import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Clock, Info, Loader2, Lock, Send, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InfoHint } from '@/components/common/InfoHint';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/badge';
import { useEarnings } from '@/hooks/useEarnings';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { cn } from '@/lib/utils';
import {
  openPayoutStatus,
  readPayoutStatus,
  type EarningsPayoutRequest,
  type OpenPayoutStatus,
  type PayoutStatusView,
} from '@/types/earnings.types';
import { usePageRefresh } from '@/store/pageRefresh.store';

// Mirrors the backend EARNINGS_CONFIG — see api-doc/agency/earnings.md.
// There is no per-account withdrawal limit: since 2026-09-27 a payout takes the
// whole `available` balance whether or not the agency is verified.
const MIN_PAYOUT = 10_000;
const AUTO_PAYOUT_THRESHOLD = 2_000_000;

/**
 * How each payout status is rendered — colour, badge label, and the line under
 * it that says where the money actually is.
 *
 * ⛔ **Every value has its OWN entry, `unknown` included.** This map used to be
 * exhaustive over three statuses; when `processing` and `failed` arrived, a map
 * of that shape sends both into whichever branch is reached last — telling an
 * agency their payout was *declined* while their money is in flight.
 *
 * ⚠ The colours carry the same distinction the copy does. `failed` is amber —
 * still open, money still held, an administrator is on it — and deliberately
 * NOT the red of `rejected`, which is closed with the balance handed back.
 * `processing` is blue rather than green, because green reads as "arrived".
 */
const STATUS_VIEW = {
  pending: {
    className: 'border-yellow-500 text-yellow-600 bg-yellow-50',
    labelKey: 'earnings.status.pending',
    noteKey: 'earnings.statusNote.pending',
  },
  processing: {
    className: 'border-blue-500 text-blue-600 bg-blue-50',
    labelKey: 'earnings.status.processing',
    noteKey: 'earnings.statusNote.processing',
  },
  paid: {
    className: 'border-green-500 text-green-600 bg-green-50',
    labelKey: 'earnings.status.paid',
    // The only status that needs no qualifier: the money arrived.
    noteKey: null,
  },
  rejected: {
    className: 'border-red-500 text-red-600 bg-red-50',
    labelKey: 'earnings.status.rejected',
    noteKey: 'earnings.statusNote.rejected',
  },
  failed: {
    className: 'border-orange-500 text-orange-600 bg-orange-50',
    labelKey: 'earnings.status.failed',
    noteKey: 'earnings.statusNote.failed',
  },
  unknown: {
    className: 'border-muted-foreground/40 text-muted-foreground bg-muted',
    labelKey: 'earnings.status.unknown',
    noteKey: 'earnings.statusNote.unknown',
  },
} as const satisfies Record<
  PayoutStatusView,
  { className: string; labelKey: string; noteKey: string | null }
>;

/**
 * Why the withdraw button is disabled while a payout is still open — one
 * sentence per open status, because "you already have a pending request" is
 * simply untrue of a payout that is in flight or that an administrator is
 * retrying, and the three wait on different things.
 */
const OPEN_REQUEST_KEY = {
  pending: 'earnings.blocked.openRequest.pending',
  processing: 'earnings.blocked.openRequest.processing',
  failed: 'earnings.blocked.openRequest.failed',
  unknown: 'earnings.blocked.openRequest.unknown',
} as const satisfies Record<OpenPayoutStatus, string>;

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
  usePageRefresh(refetch, isLoading);
  const { session } = useOnboarding();

  const currency = balance?.currency ?? 'XAF';
  const hasPayoutMethod = (session?.role_entity?.payout_details?.length ?? 0) > 0;
  /**
   * The open payout standing in the way of a new request — `pending`,
   * `processing` **or** `failed`, and an unrecognised status too.
   *
   * ⛔ Not `status === 'pending'`. All three hold the balance in `requested`, so
   * offering the button on the other two sends the agency straight into a
   * `409 EARNINGS_PAYOUT_ALREADY_PENDING`. ⚠ `failed` is the one that looks
   * finished and is not: the transfer was refused, but the money has not come
   * back, so there is nothing to request again.
   */
  const openStatus = openPayoutStatus(latestPayout);
  const available = balance?.available ?? 0;

  /** The one-liner beside the button. */
  const disabledReason = !hasPayoutMethod
    ? t('earnings.blocked.noMethod')
    : openStatus
      ? t(OPEN_REQUEST_KEY[openStatus])
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

            {latestPayout && <LatestPayoutRow payout={latestPayout} />}

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
                    // A payout always takes the whole `available` balance.
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
 * The most recent payout request: where it stands, and — for every status but
 * `paid` — where the money is while it stands there.
 *
 * ⚠ **Status and money are two different facts, and only one of them is in the
 * badge.** `processing` and `failed` both still hold the balance; `rejected`
 * hands it back. An agency reading "Payment failed" with no second line assumes
 * the money is theirs again and goes looking for a button to request it — so the
 * note is not decoration, it is the half of the answer the badge cannot carry.
 */
function LatestPayoutRow({ payout }: { payout: EarningsPayoutRequest }) {
  const { t } = useTranslation(['account', 'common']);
  const navigate = useNavigate();

  // ⛔ Through `readPayoutStatus`, never `STATUS_VIEW[payout.status]` directly:
  // a status added to the backend after this build would index the map to
  // `undefined` and paint a blank badge on a live payout.
  const view = STATUS_VIEW[readPayoutStatus(payout.status)];

  return (
    <div className="rounded-lg border p-3 md:p-4 flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge variant="outline" className={cn(view.className)}>
            {t(view.labelKey)}
          </Badge>
          {payout.origin === 'auto_threshold' && (
            <Badge variant="secondary" className="text-xs">
              {t('earnings.status.automatic')}
            </Badge>
          )}
          <div className="text-sm">
            <span className="font-medium">
              {formatCurrency(payout.amount, payout.currency)}
            </span>
            <span className="text-muted-foreground">
              {' '}· {t('earnings.requestedOn', { date: formatDate(payout.createdAt) })}
            </span>
          </div>
        </div>

        {/* ⚠ `rejectionReason` is the ONLY place the *why* lives — the WhatsApp
            notification carries just the amount and points back here. */}
        {payout.status === 'rejected' && payout.rejectionReason && (
          <p className="text-sm text-destructive">{payout.rejectionReason}</p>
        )}

        {view.noteKey && <p className="text-xs text-muted-foreground">{t(view.noteKey)}</p>}
      </div>

      <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/tickets')}>
        {t('earnings.viewInTickets')}
      </Button>
    </div>
  );
}

/**
 * The "how earnings work" paragraph, shown inline on desktop and behind the ⓘ
 * on a phone. Uses `Trans` because the copy has one emphasised phrase in the
 * middle — the `<1>` placeholder lets a translator move it, which a split
 * string would not.
 *
 * The second line is why a `pending` balance can sit still past the 3 days: a
 * card dispute, a seller cancelling a paid order, or an investigation pauses
 * the entry, and the clock resumes where it stopped. Spans, not paragraphs —
 * desktop renders this inside a `<p>`.
 */
function HowEarningsWork() {
  const { t } = useTranslation('account');
  return (
    <>
      <Trans
        ns="account"
        i18nKey="earnings.howItWorks"
        components={{ strong: <span className="font-medium" /> }}
      />
      <span className="mt-2 block">{t('earnings.paused')}</span>
    </>
  );
}
