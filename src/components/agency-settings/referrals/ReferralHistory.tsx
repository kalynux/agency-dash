import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ListBody, ListHeader } from '@/components/agency-settings/EarningsHistory';
import { payoutEntryDetail, payoutEntryTitle, toPayoutEntries } from '@/components/agency-settings/payout/payoutEntry.helpers';
import { PAYOUT_STATUS_VIEW } from '@/components/agency-settings/payoutStatusView';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { usePagedEarningsList } from '@/hooks/useEarnings';
import { referralService } from '@/services/referral.service';
import { usePageRefresh } from '@/store/pageRefresh.store';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { readPayoutStatus } from '@/types/earnings.types';
import {
  linkEarns,
  type ReferralPartner,
  type ReferralPayout,
  type ReferralReward,
  type ReferredAccount,
} from '@/types/referral.types';

/**
 * The partner's three lists.
 *
 * ⛔ No order number, product, vendor or commission figure appears on these, and
 * none may be asked for: the backend withholds them on purpose, since a commission
 * and a vendor's plan reveal that vendor's sales, and an order reveals what a
 * person bought. Names arrive masked and are printed as they come.
 */

export const REFERRAL_PAGE_LIMIT = 10;

const CATEGORY_KEY = {
  vendor: 'referrals.category.vendor',
  customer: 'referrals.category.customer',
  agency: 'referrals.category.agency',
  agent: 'referrals.category.agent',
} as const;

function CategoryBadge({ category }: { category: string }) {
  const { t } = useTranslation('account');
  const key = CATEGORY_KEY[category as keyof typeof CATEGORY_KEY];
  // A category added after this build gets no guessed name.
  return key ? <Badge variant="outline" className="text-xs">{t(key)}</Badge> : null;
}

// ─── Referred accounts ────────────────────────────────────────────────────────

export function ReferredCard({ partner }: { partner: ReferralPartner }) {
  const { t } = useTranslation('account');
  const { rows, meta, setPage, isLoading, loadError, refetch } = usePagedEarningsList(
    referralService.listReferred,
    REFERRAL_PAGE_LIMIT,
  );
  usePageRefresh(refetch, isLoading);
  const earningNow = linkEarns(partner);
  const { total, earning } = partner.referred;

  return (
    <Card className={sectionSurfaceClass}>
      <ListHeader
        title={t('referrals.referred.title')}
        description={t('referrals.referred.description')}
        short={t('referrals.referred.short')}
        aboutLabel={t('referrals.referred.aboutLabel')}
      />
      <CardContent className="space-y-4 max-md:px-0">
        {total > 0 && (
          <p className="text-sm text-muted-foreground">
            {t('referrals.referred.total', { count: total })}
            {/* `earning` counts dates only; a suspended partner's are earning nothing. */}
            {earningNow && <> · {t('referrals.referred.earningCount', { count: earning })}</>}
          </p>
        )}
        <ListBody
          isLoading={isLoading}
          loadError={loadError}
          isEmpty={rows.length === 0}
          loadingText={t('referrals.referred.loading')}
          emptyText={t('referrals.referred.empty')}
          onRetry={refetch}
          meta={meta}
          onPage={setPage}
        >
          {rows.map((row) => (
            <ReferredRow key={row.id} row={row} currency={partner.balances.currency} earningNow={earningNow} />
          ))}
        </ListBody>
      </CardContent>
    </Card>
  );
}

function ReferredRow({ row, currency, earningNow }: {
  row: ReferredAccount;
  currency: string;
  earningNow: boolean;
}) {
  const { t } = useTranslation('account');
  return (
    <li className="space-y-1 p-3 md:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span dir="ltr" className="truncate text-sm font-medium">{row.name}</span>
          <CategoryBadge category={row.category} />
          {row.earning && earningNow && (
            <Badge variant="outline" className="border-green-500 bg-green-50 text-xs text-green-600">
              {t('referrals.referred.earning')}
            </Badge>
          )}
        </div>
        <span className="whitespace-nowrap font-medium">{formatCurrency(row.totalEarned, currency)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('referrals.referred.registered', { date: formatDate(row.registeredAt) })}
        {' · '}
        {/* `expiresAt` is null for an agent, whose own activity never earns. */}
        {row.expiresAt
          ? t(row.earning ? 'referrals.referred.until' : 'referrals.referred.ended', { date: formatDate(row.expiresAt) })
          : t('referrals.referred.neverEarns')}
      </p>
    </li>
  );
}

// ─── Rewards ──────────────────────────────────────────────────────────────────

const REWARD_VIEW = {
  held: { className: 'border-yellow-500 text-yellow-600 bg-yellow-50', labelKey: 'referrals.rewards.status.held' },
  released: { className: 'border-green-500 text-green-600 bg-green-50', labelKey: 'referrals.rewards.status.released' },
  reversed: { className: 'border-red-500 text-red-600 bg-red-50', labelKey: 'referrals.rewards.status.reversed' },
  unknown: { className: 'border-muted-foreground/40 text-muted-foreground bg-muted', labelKey: 'referrals.rewards.status.unknown' },
} as const;

export function RewardsCard() {
  const { t } = useTranslation('account');
  const { rows, meta, setPage, isLoading, loadError, refetch } = usePagedEarningsList(
    referralService.listRewards,
    REFERRAL_PAGE_LIMIT,
  );
  usePageRefresh(refetch, isLoading);

  return (
    <Card className={sectionSurfaceClass}>
      <ListHeader
        title={t('referrals.rewards.title')}
        description={t('referrals.rewards.description')}
        short={t('referrals.rewards.short')}
        aboutLabel={t('referrals.rewards.aboutLabel')}
      />
      <CardContent className="space-y-4 max-md:px-0">
        <ListBody
          isLoading={isLoading}
          loadError={loadError}
          isEmpty={rows.length === 0}
          loadingText={t('referrals.rewards.loading')}
          emptyText={t('referrals.rewards.empty')}
          onRetry={refetch}
          meta={meta}
          onPage={setPage}
        >
          {rows.map((row) => <RewardRow key={row.id} row={row} />)}
        </ListBody>
      </CardContent>
    </Card>
  );
}

function RewardRow({ row }: { row: ReferralReward }) {
  const { t } = useTranslation('account');
  const reversed = row.status === 'reversed';
  const view = REWARD_VIEW[row.status as keyof typeof REWARD_VIEW] ?? REWARD_VIEW.unknown;
  return (
    <li className="space-y-1 p-3 md:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span dir="ltr" className="truncate text-sm font-medium">{row.name}</span>
          <CategoryBadge category={row.category} />
          <Badge variant="outline" className={cn('text-xs', view.className)}>{t(view.labelKey)}</Badge>
        </div>
        {/* `amount` is already net of refunds; a reversed reward is shown as 0. */}
        <span className="whitespace-nowrap font-medium">{formatCurrency(reversed ? 0 : row.amount, row.currency)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('referrals.rewards.earned', { date: formatDate(row.earnedAt) })}
        {row.status === 'held' && <> · {t('referrals.rewards.availableFrom', { date: formatDate(row.availableFrom) })}</>}
        {row.adjusted && !reversed && <> · {t('referrals.rewards.adjusted')}</>}
      </p>
    </li>
  );
}

// ─── Withdrawals ──────────────────────────────────────────────────────────────

/** The hook lives with the withdraw button, which has to reload this list. */
export function PayoutsCard({ list }: { list: ReturnType<typeof usePagedEarningsList<ReferralPayout>> }) {
  const { t } = useTranslation('account');
  const { rows, meta, setPage, isLoading, loadError, refetch } = list;
  return (
    <Card className={sectionSurfaceClass}>
      <ListHeader
        title={t('referrals.payouts.title')}
        description={t('referrals.payouts.description')}
        short={t('referrals.payouts.short')}
        aboutLabel={t('referrals.payouts.aboutLabel')}
      />
      <CardContent className="space-y-4 max-md:px-0">
        <ListBody
          isLoading={isLoading}
          loadError={loadError}
          isEmpty={rows.length === 0}
          loadingText={t('referrals.payouts.loading')}
          emptyText={t('referrals.payouts.empty')}
          onRetry={refetch}
          meta={meta}
          onPage={setPage}
        >
          {rows.map((row) => <PayoutRow key={row.id} row={row} />)}
        </ListBody>
      </CardContent>
    </Card>
  );
}

function PayoutRow({ row }: { row: ReferralPayout }) {
  const { t } = useTranslation('account');
  // ⛔ Through `readPayoutStatus`: a status added to the backend after this build
  // must render as in progress, never index the map to a blank badge.
  const status = readPayoutStatus(row.status);
  const view = PAYOUT_STATUS_VIEW[status];
  const entry = toPayoutEntries(row.destination ? [row.destination] : [])[0];
  // This row has no ticket to open, so the shared `unknown` line would point nowhere.
  const noteKey = status === 'unknown' ? 'referrals.payouts.unknownNote' : view.noteKey;

  return (
    <li className="space-y-1.5 p-3 md:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Badge variant="outline" className={cn('text-xs', view.className)}>{t(view.labelKey)}</Badge>
          <span className="text-xs text-muted-foreground">
            {t('earnings.requestedOn', { date: formatDate(row.requestedAt) })}
          </span>
        </div>
        <span className="whitespace-nowrap font-medium">{formatCurrency(row.amount, row.currency)}</span>
      </div>
      {entry && (
        <p className="text-xs text-muted-foreground">
          {payoutEntryTitle(entry, t)} · <span dir="ltr">{payoutEntryDetail(entry)}</span>
        </p>
      )}
      {/* ⚠ `rejectionReason` is the only place the *why* lives. */}
      {status === 'rejected' && row.rejectionReason && (
        <p className="text-sm text-destructive">{row.rejectionReason}</p>
      )}
      {noteKey && <p className="text-xs text-muted-foreground">{t(noteKey)}</p>}
    </li>
  );
}
