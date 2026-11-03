import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Clock, Loader2, PauseCircle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { sectionGroupClass, sectionSurfaceClass } from '@/components/layout/PageContainer';
import { usePagedEarningsList } from '@/hooks/useEarnings';
import { useReferral } from '@/hooks/useReferral';
import { referralService } from '@/services/referral.service';
import { usePageRefresh } from '@/store/pageRefresh.store';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { hasPartnerHistory, type ReferralPartner, type ReferralProgramInfo } from '@/types/referral.types';
import { ReferralApplicationCard } from './ReferralApplicationCard';
import { ReferralBalanceCard } from './ReferralBalanceCard';
import { PayoutsCard, REFERRAL_PAGE_LIMIT, ReferredCard, RewardsCard } from './ReferralHistory';
import { ReferralShareCard } from './ReferralShareCard';

/**
 * Account → Referrals: the partner page, by `status`. See
 * api-doc/FRONTEND-CHANGELOG-referrals.md § The page in each state.
 *
 * ⛔ Every rate, duration, wait and minimum here is read from the API; none may be
 * written into code or copy. ⚠ The balance is not the agency's earnings and never
 * part of its COD figures, which is why this page shares nothing with them but the
 * payout destination.
 *
 * There are no in-app or push notifications about any of this, and a WhatsApp
 * message outside the 24-hour window points back here instead of quoting the
 * reason, so the page has to state the status and `statusReason` itself.
 */
export function ReferralProgram() {
  const { t } = useTranslation(['account', 'common']);
  const { overview, isLoading, loadError, isApplying, isWithdrawing, apply, withdraw, refetch } = useReferral();
  usePageRefresh(refetch, isLoading);

  if (isLoading && !overview) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('referrals.loading')}
      </div>
    );
  }
  if (loadError || !overview) {
    return (
      <div className="py-8 text-center">
        <p className="mb-4 text-sm text-muted-foreground">{loadError ?? t('referrals.loadFailed')}</p>
        <Button variant="outline" onClick={refetch}>{t('common:actions.retry')}</Button>
      </div>
    );
  }

  if (overview.status === 'none') {
    return overview.canApply ? (
      <div className={sectionGroupClass}>
        <Card className={sectionSurfaceClass}>
          <CardHeader className="max-md:px-0">
            <CardTitle>{t('referrals.intro.title')}</CardTitle>
            <CardDescription>{t('referrals.intro.lead')}</CardDescription>
          </CardHeader>
          <CardContent className="max-md:px-0">
            <HowReferralsWork program={overview.program} />
            <p className="mt-3 text-sm text-muted-foreground">{t('referrals.intro.ratesAfterApproval')}</p>
          </CardContent>
        </Card>
        <ReferralApplicationCard isApplying={isApplying} onApply={apply} />
      </div>
    ) : (
      // Off, which is how the program starts: no numbers and no form.
      <Notice
        icon={<PauseCircle className="h-5 w-5" />}
        title={t('referrals.closed.title')}
        body={t('referrals.closed.body')}
      />
    );
  }

  return (
    <div className={sectionGroupClass}>
      <StatusNotice partner={overview} />
      {overview.canApply && <ReferralApplicationCard isApplying={isApplying} onApply={apply} />}
      {hasPartnerHistory(overview) && (
        <PartnerRecord partner={overview} isWithdrawing={isWithdrawing} onWithdraw={withdraw} />
      )}
    </div>
  );
}

/**
 * The money and the history. Kept apart from the page above because a first-time
 * applicant has no partner record to list: the lists answer them nothing useful.
 */
function PartnerRecord({ partner, isWithdrawing, onWithdraw }: {
  partner: ReferralPartner;
  isWithdrawing: boolean;
  onWithdraw: () => Promise<unknown>;
}) {
  const payouts = usePagedEarningsList(referralService.listPayouts, REFERRAL_PAGE_LIMIT);
  usePageRefresh(payouts.refetch, payouts.isLoading);

  const withdraw = async () => {
    await onWithdraw();
    await payouts.refetch();
  };

  return (
    <>
      {partner.code && <ReferralShareCard partner={partner} />}
      <ReferralBalanceCard partner={partner} isWithdrawing={isWithdrawing} onWithdraw={withdraw} />
      {partner.status === 'active' && <TermsCard partner={partner} />}
      <ReferredCard partner={partner} />
      <RewardsCard />
      <PayoutsCard list={payouts} />
    </>
  );
}

// ─── Status ───────────────────────────────────────────────────────────────────

function Notice({ icon, title, body, children, tone = 'neutral' }: {
  icon: ReactNode;
  title: string;
  body?: string;
  children?: ReactNode;
  tone?: 'neutral' | 'warning';
}) {
  const warning = tone === 'warning';
  return (
    // `py-0`: the Card's own padding stacks on the content's and leaves a tall
    // empty band around a two-line banner.
    <Card className={warning ? 'border-gold-400/50 bg-gold-50/70 py-0 dark:border-gold-500/25 dark:bg-gold-500/10' : 'py-0'}>
      <CardContent className="flex items-start gap-3 p-4">
        <span className={`mt-0.5 flex-shrink-0 ${warning ? 'text-gold-700 dark:text-gold-400' : 'text-muted-foreground'}`}>{icon}</span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className={`text-sm font-medium ${warning ? 'text-gold-800 dark:text-gold-300' : ''}`}>{title}</p>
          {body && <p className="text-sm text-muted-foreground">{body}</p>}
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusNotice({ partner }: { partner: ReferralPartner }) {
  const { t } = useTranslation('account');
  const { status, statusReason, canApply, balanceFrozen, program } = partner;

  // The server says `codeActive: true` for an active partner while the program is
  // off, yet attaches no referral and creates no reward. Say so.
  const paused = !program.enabled && (status === 'active' || status === 'pending') && (
    <Notice
      icon={<PauseCircle className="h-5 w-5" />}
      title={t('referrals.paused.title')}
      body={status === 'active' ? t('referrals.paused.active') : t('referrals.paused.pending')}
    />
  );

  if (status === 'active') return paused || null;
  if (status === 'pending') {
    return (
      <>
        <Notice
          icon={<Clock className="h-5 w-5" />}
          title={t('referrals.pending.title')}
          body={t('referrals.pending.body', { date: formatDate(partner.appliedAt) })}
        />
        {paused}
      </>
    );
  }

  const reason = statusReason && (
    <p className="rounded-md border bg-background/60 p-2.5 text-sm">
      <span className="font-medium">{t('referrals.reason')}</span> {statusReason}
    </p>
  );
  const again = canApply ? t('referrals.reapply.allowed') : t('referrals.reapply.notAllowed');

  if (status === 'rejected') {
    return (
      <Notice tone="warning" icon={<ShieldAlert className="h-5 w-5" />} title={t('referrals.rejected.title')}>
        {reason}
        <p className="text-sm text-muted-foreground">{again}</p>
      </Notice>
    );
  }

  // Suspended or terminated. The freeze ends when an administrator releases the
  // balance, whatever the status, so that half reads `balanceFrozen`.
  const ended = status === 'terminated';
  return (
    <Notice
      tone="warning"
      icon={<ShieldAlert className="h-5 w-5" />}
      title={ended ? t('referrals.terminated.title') : t('referrals.suspended.title')}
    >
      {reason}
      <p className="text-sm text-muted-foreground">
        {ended ? t('referrals.terminated.body') : t('referrals.suspended.body')}
      </p>
      <p className="text-sm text-muted-foreground">
        {balanceFrozen ? t('referrals.balanceFrozen') : t('referrals.balanceReleased')}
      </p>
      {ended && <p className="text-sm text-muted-foreground">{again}</p>}
    </Notice>
  );
}

// ─── Terms and how it works ───────────────────────────────────────────────────

const TERM_ROWS = [
  { category: 'vendor', labelKey: 'referrals.category.vendor' },
  { category: 'customer', labelKey: 'referrals.category.customer' },
  { category: 'agency', labelKey: 'referrals.category.agency' },
] as const;

function TermsCard({ partner }: { partner: ReferralPartner }) {
  const { t } = useTranslation('account');
  return (
    <Card className={sectionSurfaceClass}>
      <CardHeader className="max-md:px-0">
        <CardTitle>{t('referrals.terms.title')}</CardTitle>
        <CardDescription>{t('referrals.terms.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-md:px-0">
        <dl className="divide-y rounded-lg border">
          {TERM_ROWS.map(({ category, labelKey }) => {
            const terms = partner.terms[category];
            return (
              <div key={category} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 p-3">
                <dt className="text-sm font-medium">{t(labelKey)}</dt>
                <dd className="text-sm text-muted-foreground">
                  {t('referrals.terms.row', { rate: formatNumber(terms.ratePercent), count: terms.durationMonths })}
                </dd>
              </div>
            );
          })}
        </dl>
        <HowReferralsWork program={partner.program} />
      </CardContent>
    </Card>
  );
}

/** The rules a partner's copy must not contradict, with the numbers from the API. */
function HowReferralsWork({ program }: { program: ReferralProgramInfo }) {
  const { t } = useTranslation('account');
  const minimum = formatCurrency(program.minPayoutAmount);
  return (
    <ul className="list-disc space-y-1.5 ps-5 text-sm text-muted-foreground">
      <li>{t('referrals.how.source')}</li>
      <li>{t('referrals.how.who')}</li>
      <li>{t('referrals.how.limited')}</li>
      {/* An administrator may set no wait at all, and "0 days" is not a sentence. */}
      <li>
        {program.rewardWaitDays > 0
          ? t('referrals.how.earned', { count: program.rewardWaitDays })
          : t('referrals.how.earnedNoWait')}
      </li>
      <li>{t('referrals.how.refund')}</li>
      <li>
        <Trans
          ns="account"
          i18nKey="referrals.how.withdraw"
          values={{ amount: minimum }}
          components={{ strong: <span className="font-medium text-foreground" /> }}
        />
      </li>
    </ul>
  );
}
