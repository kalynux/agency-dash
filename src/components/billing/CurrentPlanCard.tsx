import { useTranslation } from 'react-i18next';
import { CalendarClock, Truck, Sparkles, Radio, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatNumber } from '@/lib/format';
import type { CurrentPlanData } from '@/types/billing.types';
import {
  formatMoney,
  formatDate,
  formatTerm,
  formatCredits,
  formatShipmentCap,
  subscriberPlanStatusLabel,
} from './billing.constants';

interface CurrentPlanCardProps {
  data: CurrentPlanData;
}

export function CurrentPlanCard({ data }: CurrentPlanCardProps) {
  const { t } = useTranslation('billing');
  const { plan, subscriberPlan } = data.active;
  const isFree = plan.price === 0;

  // Shipment usage comes straight from GET /agency/plan → shipments (no extra fetch).
  const cap = data.shipments?.maxUnterminatedShipments ?? plan.max_unterminated_shipments ?? null;
  const used = data.shipments?.currentUnterminated ?? 0;
  const remaining = data.shipments?.remaining ?? null;
  const pct = cap && cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  // Soft cap — never blocks deliveries; when at capacity we only nudge an upgrade.
  const atCapacity = cap !== null && remaining === 0;

  return (
    <Card className={sectionSurfaceClass}>
      <CardHeader className="max-md:px-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {plan.name}
              <Badge variant={subscriberPlan.status === 'active' ? 'default' : 'secondary'}>
                {subscriberPlanStatusLabel(subscriberPlan.status)}
              </Badge>
            </CardTitle>
            <CardDescription>
              {isFree
                ? t('plan.freePlan')
                : t('plan.priceAndTerm', {
                    price: formatMoney(plan.price, plan.currency),
                    term: formatTerm(plan.term_days),
                  })}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-md:px-0">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            icon={<CalendarClock className="h-4 w-4" />}
            label={t('plan.renewsOrExpires')}
            value={
              subscriberPlan.expires_at ? formatDate(subscriberPlan.expires_at) : t('plan.neverExpires')
            }
          />
          <Stat
            icon={<Sparkles className="h-4 w-4" />}
            label={t('plan.creditAllowance')}
            value={formatCredits(plan.credit_allowance)}
          />
          <Stat
            icon={<Radio className="h-4 w-4" />}
            label={t('plan.liveTracking')}
            value={plan.live_tracking_enabled ? t('plan.included') : t('plan.notIncluded')}
          />
        </div>

        {/* Unterminated-shipment usage meter (soft cap) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Truck className="h-4 w-4" /> {t('plan.activeShipments')}
            </span>
            <span className="font-medium">
              {t('plan.usage', { used: formatNumber(used), cap: formatShipmentCap(cap) })}
            </span>
          </div>
          {cap !== null && <Progress value={pct} />}
          <p className="text-xs text-muted-foreground">{t('plan.capHint')}</p>
        </div>

        {/* At-capacity nudge — deliveries keep flowing; this only prompts an upgrade. */}
        {atCapacity && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <p className="text-amber-700">{t('plan.atCapacity')}</p>
          </div>
        )}

        {/* Pending plan banner */}
        {data.pending && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <p className="font-medium text-primary">
              {t('plan.pendingQueued', { name: data.pending.plan.name })}
            </p>
            <p className="text-muted-foreground">
              {data.pending.subscriberPlan.started_at
                ? t('plan.pendingStartsOn', {
                    date: formatDate(data.pending.subscriberPlan.started_at),
                  })
                : t('plan.pendingStarts')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
