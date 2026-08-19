import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, formatFileSize } from '@/lib/utils';
import type { PricingPlan, CurrentPlanData } from '@/types/billing.types';
import {
  formatMoney,
  formatTerm,
  formatCredits,
  formatShipmentCap,
  planAccent,
} from './billing.constants';

interface PlansCatalogProps {
  plans: PricingPlan[];
  current: CurrentPlanData | null;
  /**
   * Start a purchase. Omitted where purchases are gated (native — D4 / Phase 5),
   * which drops the per-plan buttons; the notice saying where a plan change is
   * made instead is rendered by the parent, under the catalog.
   *
   * The catalog itself always renders. What each tier costs is information, and
   * withholding it would make the app worse for no policy benefit.
   */
  onBuy?: (plan: PricingPlan) => void;
}

export function PlansCatalog({ plans, current, onBuy }: PlansCatalogProps) {
  const { t } = useTranslation('billing');
  const activeCode = current?.active.plan.code;
  const hasPending = !!current?.pending;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const isCurrent = plan.code === activeCode;
        const isFree = plan.price === 0;
        // A gated build renders no call-to-action slot at all rather than a
        // disabled "Choose plan": a greyed-out button reads as something broken,
        // not as something that lives elsewhere. The two status pills stay —
        // "Your plan" and "Default tier" are labels, not actions.
        const cta = isCurrent ? (
          <Button variant="outline" className="w-full" disabled>
            {t('plans.yourPlan')}
          </Button>
        ) : isFree ? (
          <Button variant="outline" className="w-full" disabled>
            {t('plans.defaultTier')}
          </Button>
        ) : onBuy ? (
          <Button
            className="w-full"
            onClick={() => onBuy(plan)}
            disabled={hasPending}
            title={hasPending ? t('plans.queuedTitle') : undefined}
          >
            {hasPending ? t('plans.queued') : t('plans.choose')}
          </Button>
        ) : null;
        return (
          <Card
            key={plan._id}
            className={cn('flex flex-col border-2', planAccent(plan.code), isCurrent && 'ring-1 ring-primary')}
          >
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                {isCurrent && <Badge>{t('plans.current')}</Badge>}
              </div>
              <div>
                <span className="text-2xl font-bold">
                  {isFree ? t('plans.free') : formatMoney(plan.price, plan.currency)}
                </span>
                {!isFree && (
                  <span className="text-sm text-muted-foreground"> · {formatTerm(plan.term_days)}</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <ul className="space-y-2 text-sm">
                <Feature>
                  {t('plans.creditsOnActivation', { credits: formatCredits(plan.credit_allowance) })}
                </Feature>
                <Feature>
                  {t('plans.concurrentShipments', {
                    cap: formatShipmentCap(plan.max_unterminated_shipments),
                  })}
                </Feature>
                {plan.live_tracking_enabled && <Feature>{t('plans.liveTrackingIncluded')}</Feature>}
                {/* Storage caps are per-plan and admin-editable — only advertise one when the plan actually carries it. */}
                {typeof plan.max_storage_bytes === 'number' && plan.max_storage_bytes > 0 && (
                  <Feature>
                    {t('plans.mediaStorage', { size: formatFileSize(plan.max_storage_bytes) })}
                  </Feature>
                )}
              </ul>
              {cta && <div className="mt-auto">{cta}</div>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}
