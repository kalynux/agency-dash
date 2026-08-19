import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  fetchCurrentPlan,
  fetchPlans,
  fetchCreditBalance,
  fetchCreditPacks,
  initiatePlanPurchase,
  verifyPlanPurchase,
  initiateTopup,
  verifyTopup,
} from '@/services/billing.service';
import { fetchStorageUsage } from '@/services/files.service';
import { getApiErrorMessage } from '@/lib/errors';
import type { StorageUsage } from '@/types/file.types';
import type {
  CurrentPlanData,
  PricingPlan,
  CreditPack,
  PaymentChannel,
  PaymentGateway,
  PaymentInitResult,
  PaymentStatus,
} from '@/types/billing.types';
import { CurrentPlanCard } from './CurrentPlanCard';
import { CreditWalletCard } from './CreditWalletCard';
import { StorageUsageCard } from './StorageUsageCard';
import { PlansCatalog } from './PlansCatalog';
import { BillingSettingsCard } from './BillingSettingsCard';
import { SavedPaymentMethodsCard } from './SavedPaymentMethodsCard';
import { PaymentDialog } from './PaymentDialog';
import { CardSkeleton, PlansSkeleton } from './BillingSkeletons';
import { ManageOnWebNotice } from './ManageOnWebNotice';
import { InfoHint } from '@/components/common/InfoHint';
import { sectionRuleClass } from '@/components/layout/PageContainer';
import { purchasesEnabled } from '@/platform/purchases';
import { cn } from '@/lib/utils';
import {
  formatCredits,
  readStripeResume,
  clearStripeResume,
  type StripeResumeKind,
} from './billing.constants';

interface PaymentRequest {
  title: string;
  summary: string;
  amount: number;
  currency: string;
  successLabel: string;
  paymentKind: StripeResumeKind;
  initiate: (gateway: PaymentGateway, channel: PaymentChannel) => Promise<PaymentInitResult>;
  verify: (id: string) => Promise<{ status: PaymentStatus }>;
}

/**
 * The merged Billing surface (Account → Billing): current plan + credit wallet,
 * the plan catalog, saved payment methods and expiry reminders — all on one page,
 * mirroring the vendor dashboard. A single PaymentDialog drives both plan purchase
 * and credit top-up. (Transaction history lives on its own top-level page.)
 *
 * Inside the native shell the whole page still renders, but nothing can be
 * bought: `purchasesEnabled` is false, so the two `open*Purchase` callbacks are
 * never handed down, no card offers a button, and PaymentDialog is never
 * mounted (CAPACITOR-PLAN.md → Phase 5, decision D4). The purchase code below is
 * left exactly as it is — unreachable, not deleted — because it is still the web
 * path, and because the Stripe 3-D Secure return trip that a native build cannot
 * complete is a topology problem, not a bug to patch out.
 */
export function BillingTab() {
  const { t } = useTranslation(['billing', 'common']);
  const [current, setCurrent] = useState<CurrentPlanData | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [storage, setStorage] = useState<StorageUsage | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const plansRef = useRef<HTMLElement>(null);

  const [payment, setPayment] = useState<PaymentRequest | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planData, planList, bal, packList, storageUsage] = await Promise.all([
        fetchCurrentPlan(),
        fetchPlans(),
        fetchCreditBalance(),
        fetchCreditPacks(),
        // Storage is supplementary — a hiccup here must not blank the whole page.
        fetchStorageUsage().catch(() => null),
      ]);
      setCurrent(planData);
      setPlans(planList);
      setBalance(bal);
      setPacks(packList);
      setStorage(storageUsage);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh the live figures after a successful payment (plan + balance).
  const refreshAfterPayment = useCallback(async () => {
    try {
      const [planData, bal] = await Promise.all([fetchCurrentPlan(), fetchCreditBalance()]);
      setCurrent(planData);
      setBalance(bal);
    } catch {
      // best-effort
    }
  }, []);

  // Resume a Stripe card payment that left the SPA for 3-D Secure. On return we
  // re-verify the purchase for immediate feedback; the Stripe webhook is the
  // authoritative finalizer, so the plan/credits apply server-side regardless.
  useEffect(() => {
    // Native never leaves for 3-D Secure because it never starts a payment, so
    // there is no marker to resume and nothing here to poll for.
    if (!purchasesEnabled) return;
    const marker = readStripeResume();
    if (!marker) return;
    clearStripeResume();
    let cancelled = false;
    (async () => {
      const verify = marker.kind === 'plan' ? verifyPlanPurchase : verifyTopup;
      for (let i = 0; i < 5 && !cancelled; i++) {
        try {
          const { status } = await verify(marker.id);
          if (status === 'paid') {
            if (!cancelled) {
              toast.success(
                marker.kind === 'plan'
                  ? t('checkout.planPurchased')
                  : t('checkout.creditsAdded'),
              );
              await refreshAfterPayment();
            }
            return;
          }
          if (status === 'failed' || status === 'reversed') {
            if (!cancelled) toast.error(t('checkout.cardNotCompleted'));
            return;
          }
        } catch {
          // transient — retry
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelled) {
        toast.info(t('checkout.stillConfirming'));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openPlanPurchase(plan: PricingPlan) {
    setPayment({
      title: t('checkout.planTitle', { name: plan.name }),
      summary: t('checkout.planSummary', { name: plan.name }),
      amount: plan.price,
      currency: plan.currency,
      successLabel: t('checkout.planPurchased'),
      paymentKind: 'plan',
      initiate: (gateway, channel) => initiatePlanPurchase(plan._id, { gateway, channel }),
      verify: verifyPlanPurchase,
    });
    setPaymentOpen(true);
  }

  function openPackPurchase(pack: CreditPack) {
    setPayment({
      title: t('checkout.topupTitle'),
      summary: t('checkout.topupSummary', { credits: formatCredits(pack.credits) }),
      amount: pack.price,
      currency: pack.currency,
      successLabel: t('checkout.creditsAdded'),
      paymentKind: 'topup',
      initiate: (gateway, channel) => initiateTopup({ packCode: pack.code, gateway, channel }),
      verify: verifyTopup,
    });
    setPaymentOpen(true);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
        <PlansSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          {t('common:actions.retry')}
        </Button>
      </div>
    );
  }

  // Each card below opens its own mobile section (`sectionRuleClass`) rather
  // than leaning on `sectionGroupClass`: the children here alternate between
  // Cards and plain `<section>`s, so the group's adjacent-sibling selector
  // would skip half the boundaries.
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {current && <CurrentPlanCard data={current} />}
        {balance !== null && (
          <CreditWalletCard
            balance={balance}
            packs={packs}
            onBuyPack={purchasesEnabled ? openPackPurchase : undefined}
          />
        )}
      </div>

      {storage && (
        <StorageUsageCard
          storage={storage}
          onViewPlans={() => plansRef.current?.scrollIntoView({ behavior: 'smooth' })}
        />
      )}

      <section ref={plansRef} className={cn('space-y-3', sectionRuleClass)}>
        <div>
          <h3 className="flex items-center gap-1.5 text-lg font-semibold">
            {t('plans.title')}
            <InfoHint className="md:hidden" label={t('plans.aboutLabel')}>
              {t('plans.description')}
            </InfoHint>
          </h3>
          <p className="text-sm text-muted-foreground max-md:hidden">{t('plans.description')}</p>
        </div>
        <PlansCatalog
          plans={plans}
          current={current}
          onBuy={purchasesEnabled ? openPlanPurchase : undefined}
        />
        {!purchasesEnabled && <ManageOnWebNotice kind="plan" />}
      </section>

      <SavedPaymentMethodsCard />

      <BillingSettingsCard />

      {purchasesEnabled && payment && (
        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          title={payment.title}
          summary={payment.summary}
          amount={payment.amount}
          currency={payment.currency}
          successLabel={payment.successLabel}
          paymentKind={payment.paymentKind}
          initiate={payment.initiate}
          verify={payment.verify}
          onPaid={refreshAfterPayment}
        />
      )}
    </div>
  );
}
