import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, Clock, Loader2, Lock, Send, Wallet } from 'lucide-react';
import { BalanceRow, BalanceStat } from '@/components/agency-settings/BalanceStat';
import { ListHeader } from '@/components/agency-settings/EarningsHistory';
import {
  payoutEntryDetail,
  payoutEntryMark,
  payoutEntryTitle,
  toPayoutEntries,
} from '@/components/agency-settings/payout/payoutEntry.helpers';
import { PaymentMethodMark } from '@/components/common/PaymentBrandLogo';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { withdrawBlock, type ReferralPartner, type WithdrawBlock } from '@/types/referral.types';

const PAYOUT_PATH = '/dashboard/account/payout';

const BLOCK_KEY = {
  frozen: 'referrals.withdraw.blocked.frozen',
  open: 'referrals.withdraw.blocked.open',
  noDestination: 'referrals.withdraw.blocked.noDestination',
  owes: 'referrals.withdraw.blocked.owes',
  noBalance: 'referrals.withdraw.blocked.noBalance',
  belowMinimum: 'referrals.withdraw.blocked.belowMinimum',
} as const satisfies Record<WithdrawBlock, string>;

/**
 * The partner's own balance.
 *
 * ⚠ Not the agency's earnings and never part of its COD figures: its own
 * withdrawal, its own minimum, and said so on the card.
 *
 * ⛔ `clawback` is what the partner owes back, so it is never a tile beside the
 * others and never added to them. `reserve` belongs to COD on the earnings card and
 * nothing here is known to fill it, so it appears only if it ever holds something.
 */
export function ReferralBalanceCard({ partner, isWithdrawing, onWithdraw }: {
  partner: ReferralPartner;
  isWithdrawing: boolean;
  onWithdraw: () => Promise<void>;
}) {
  const { t } = useTranslation('account');
  const { balances, program, canWithdraw } = partner;
  const { currency } = balances;
  const minimum = formatCurrency(program.minPayoutAmount, currency);
  const block = withdrawBlock(partner);

  return (
    <Card className={sectionSurfaceClass}>
      <ListHeader
        title={t('referrals.balance.title')}
        description={t('referrals.balance.description')}
        short={t('referrals.balance.short')}
        aboutLabel={t('referrals.balance.aboutLabel')}
      />
      <CardContent className="space-y-4 max-md:px-0">
        <BalanceRow>
          <BalanceStat
            icon={Wallet}
            label={t('referrals.balance.available')}
            value={balances.available}
            currency={currency}
            hint={t('referrals.balance.availableHint', { amount: minimum })}
          />
          <BalanceStat
            icon={Clock}
            label={t('referrals.balance.pending')}
            value={balances.pending}
            currency={currency}
            hint={
              program.rewardWaitDays > 0
                ? t('referrals.balance.pendingHint', { count: program.rewardWaitDays })
                : t('referrals.balance.pendingHintNoWait')
            }
          />
          <BalanceStat
            icon={Send}
            label={t('referrals.balance.requested')}
            value={balances.requested}
            currency={currency}
            hint={t('referrals.balance.requestedHint')}
          />
          {balances.reserve > 0 && (
            <BalanceStat
              icon={Lock}
              label={t('referrals.balance.reserve')}
              value={balances.reserve}
              currency={currency}
              hint={t('referrals.balance.reserveHint')}
            />
          )}
        </BalanceRow>

        {balances.clawback > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
            <div className="text-sm">
              <p className="font-medium text-orange-700 dark:text-orange-400">
                {t('referrals.balance.owes', { amount: formatCurrency(balances.clawback, currency) })}
              </p>
              <p className="text-muted-foreground">{t('referrals.balance.owesNote')}</p>
            </div>
          </div>
        )}

        <PayoutDestination partner={partner} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {block ? t(BLOCK_KEY[block], { amount: minimum }) : t('referrals.withdraw.whole', { amount: minimum })}
          </p>
          {canWithdraw && !block && (
            <Button className="gap-2" disabled={isWithdrawing} onClick={() => void onWithdraw()}>
              {isWithdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isWithdrawing
                ? t('referrals.withdraw.requesting')
                // A withdrawal always takes the whole available balance.
                : t('referrals.withdraw.button', { amount: formatCurrency(balances.available, currency) })}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Where the money would go. Always the masked method, never a form: an agency's
 * destination is edited on Account → Payout.
 *
 * ⚠ That page writes the AGENCY's method, so it is only the right link for
 * `agency`, for a destination saved on the partnership (an agency method takes
 * over from it) and for none at all. `vendor` and `agent` mean this person applied
 * from another role, whose method wins however often this agency's changes: sending
 * them to this app's Payout page would be a change with no effect, so it names the
 * other app instead.
 */
function PayoutDestination({ partner }: { partner: ReferralPartner }) {
  const { t } = useTranslation('account');
  const { source, method } = partner.payoutDestination;
  const entry = toPayoutEntries(method ? [method] : [])[0];
  const elsewhere = source === 'vendor' || source === 'agent';

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 md:p-4">
      {/* The 16rem basis puts the button on its own line on a phone, rather than
          squeezing the number it is there to identify into a sliver beside it. */}
      <div className="flex min-w-0 flex-[1_1_16rem] items-center gap-3">
        {entry && <PaymentMethodMark {...payoutEntryMark(entry)} />}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{t('referrals.destination.title')}</p>
          {entry ? (
            <>
              <p className="truncate text-sm font-medium">{payoutEntryTitle(entry, t)}</p>
              <p dir="ltr" className="truncate text-sm text-muted-foreground rtl:text-end">{payoutEntryDetail(entry)}</p>
            </>
          ) : (
            <p className="text-sm font-medium">{t('referrals.destination.none')}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {source === 'vendor'
              ? t('referrals.destination.fromVendor')
              : source === 'agent'
                ? t('referrals.destination.fromAgent')
                : source === 'agency'
                  ? t('referrals.destination.fromAgency')
                  : source === 'referral'
                    ? t('referrals.destination.fromReferral')
                    : t('referrals.destination.noneHint')}
          </p>
        </div>
      </div>
      {!elsewhere && (
        <Button asChild variant="outline" size="sm" className="gap-2 max-md:h-10">
          <Link to={PAYOUT_PATH}>
            {entry ? t('referrals.destination.manage') : t('referrals.destination.add')}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </Button>
      )}
    </div>
  );
}
