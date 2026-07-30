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
  onBuy: (plan: PricingPlan) => void;
}

export function PlansCatalog({ plans, current, onBuy }: PlansCatalogProps) {
  const activeCode = current?.active.plan.code;
  const hasPending = !!current?.pending;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const isCurrent = plan.code === activeCode;
        const isFree = plan.price === 0;
        return (
          <Card
            key={plan._id}
            className={cn('flex flex-col border-2', planAccent(plan.code), isCurrent && 'ring-1 ring-primary')}
          >
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                {isCurrent && <Badge>Current</Badge>}
              </div>
              <div>
                <span className="text-2xl font-bold">
                  {isFree ? 'Free' : formatMoney(plan.price, plan.currency)}
                </span>
                {!isFree && (
                  <span className="text-sm text-muted-foreground"> · {formatTerm(plan.term_days)}</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <ul className="space-y-2 text-sm">
                <Feature>{formatCredits(plan.credit_allowance)} credits on activation</Feature>
                <Feature>{formatShipmentCap(plan.max_unterminated_shipments)} concurrent shipments</Feature>
                {plan.live_tracking_enabled && <Feature>Live agent tracking included</Feature>}
                {/* Storage caps are per-plan and admin-editable — only advertise one when the plan actually carries it. */}
                {typeof plan.max_storage_bytes === 'number' && plan.max_storage_bytes > 0 && (
                  <Feature>{formatFileSize(plan.max_storage_bytes)} media storage</Feature>
                )}
              </ul>
              <div className="mt-auto">
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Your plan
                  </Button>
                ) : isFree ? (
                  <Button variant="outline" className="w-full" disabled>
                    Default tier
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => onBuy(plan)}
                    disabled={hasPending}
                    title={hasPending ? 'A plan is already queued to start when your current one ends.' : undefined}
                  >
                    {hasPending ? 'Plan queued' : 'Choose plan'}
                  </Button>
                )}
              </div>
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
