import { useCallback, useEffect, useRef, useState } from 'react';
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
import { ApiError } from '@/types/api';
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
import { PlansCatalog } from './PlansCatalog';
import { BillingSettingsCard } from './BillingSettingsCard';
import { SavedPaymentMethodsCard } from './SavedPaymentMethodsCard';
import { PaymentDialog } from './PaymentDialog';
import { CardSkeleton, PlansSkeleton } from './BillingSkeletons';
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
 */
export function BillingTab() {
  const [current, setCurrent] = useState<CurrentPlanData | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const plansRef = useRef<HTMLElement>(null);

  const [payment, setPayment] = useState<PaymentRequest | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planData, planList, bal, packList] = await Promise.all([
        fetchCurrentPlan(),
        fetchPlans(),
        fetchCreditBalance(),
        fetchCreditPacks(),
      ]);
      setCurrent(planData);
      setPlans(planList);
      setBalance(bal);
      setPacks(packList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load billing information.');
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
              toast.success(marker.kind === 'plan' ? 'Plan purchased' : 'Credits added');
              await refreshAfterPayment();
            }
            return;
          }
          if (status === 'failed' || status === 'reversed') {
            if (!cancelled) toast.error('The card payment was not completed.');
            return;
          }
        } catch {
          // transient — retry
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelled) {
        toast.info("We're still confirming your card payment — it'll update here shortly.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openPlanPurchase(plan: PricingPlan) {
    setPayment({
      title: `Switch to ${plan.name}`,
      summary: `${plan.name} plan`,
      amount: plan.price,
      currency: plan.currency,
      successLabel: 'Plan purchased',
      paymentKind: 'plan',
      initiate: (gateway, channel) => initiatePlanPurchase(plan._id, { gateway, channel }),
      verify: verifyPlanPurchase,
    });
    setPaymentOpen(true);
  }

  function openPackPurchase(pack: CreditPack) {
    setPayment({
      title: 'Buy credits',
      summary: `${formatCredits(pack.credits)} credits`,
      amount: pack.price,
      currency: pack.currency,
      successLabel: 'Credits added',
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
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {current && <CurrentPlanCard data={current} />}
        {balance !== null && (
          <CreditWalletCard balance={balance} packs={packs} onBuyPack={openPackPurchase} />
        )}
      </div>

      <section ref={plansRef} className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Plans</h3>
          <p className="text-sm text-muted-foreground">
            Upgrade any time — a paid plan you buy now starts when your current one ends.
          </p>
        </div>
        <PlansCatalog plans={plans} current={current} onBuy={openPlanPurchase} />
      </section>

      <SavedPaymentMethodsCard />

      <BillingSettingsCard />

      {payment && (
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
