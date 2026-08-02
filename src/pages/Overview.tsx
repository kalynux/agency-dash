import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  Truck,
  Banknote,
  Users,
  ArrowRight,
  ArrowUpRight,
  Ticket as TicketIcon,
  MapPin,
  AlertCircle,
  Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShipmentStatusBadge } from '@/components/shipments/ShipmentStatusBadge';
import { useEarnings } from '@/hooks/useEarnings';
import { useResource } from '@/hooks/useResource';
import { useShipments } from '@/store/shipments.store';
import { useAgentsRoster } from '@/store/agents.store';
import { useVendorConnections } from '@/store/vendorConnections.store';
import { shipmentsService } from '@/services/shipments.service';
import { codCashService } from '@/services/cod-cash.service';
import { cn } from '@/lib/utils';
import {
  PageHeader,
  listSurfaceClass,
  sectionRuleClass,
  sectionSurfaceClass,
} from '@/components/layout/PageContainer';
import { SectionHeading } from '@/components/common/InfoHint';
import { formatCurrency } from '@/lib/format';

type MetricAccent = 'emerald' | 'blue' | 'gold';

const ACCENT_TILE: Record<MetricAccent, string> = {
  emerald: 'bg-primary/10 text-primary',
  blue: 'bg-info-500/10 text-info-600 dark:text-info-500',
  gold: 'bg-gold-500/15 text-gold-700 dark:text-gold-400',
};

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  isLoading?: boolean;
  onClick?: () => void;
  hint?: string;
  accent?: MetricAccent;
  hero?: boolean;
}

/**
 * Title + icon on one row, the figure beneath it — the same stack for the hero
 * and the supporting tiles. Two of these sit side by side on a phone, so the
 * label can't share a row with the value: it would leave the amount ~70px to
 * render in. Everything steps up a size from `sm:`.
 */
function MetricCard({ title, value, icon: Icon, isLoading, onClick, hint, accent = 'emerald', hero }: MetricCardProps) {
  return (
    <Card
      className={cn(
        // The Card's own `py-6` doubles up with the content padding; drop it on
        // phones so four tiles in a 2×2 don't cost a screenful of whitespace.
        'cursor-pointer py-0 transition-all hover:-translate-y-0.5 md:py-6',
        hero
          ? 'relative overflow-hidden border-0 bg-brand-gradient text-white shadow-brand'
          : 'hover:shadow-lg',
      )}
      onClick={onClick}
    >
      {hero && <div className="pointer-events-none absolute inset-0 bg-brand-sheen" />}
      <CardContent className="relative p-4 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-xs font-medium leading-snug sm:text-sm',
              hero ? 'text-white/80' : 'text-muted-foreground',
            )}
          >
            {title}
          </p>
          <div
            className={cn(
              'flex-shrink-0 rounded-lg p-2 sm:rounded-xl sm:p-2.5',
              hero ? 'bg-white/15 backdrop-blur-sm' : ACCENT_TILE[accent],
            )}
          >
            <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', hero && 'text-white')} />
          </div>
        </div>
        {isLoading ? (
          <Skeleton className={cn('mt-4 h-7 w-24 sm:mt-5 sm:h-8 sm:w-36', hero && 'bg-white/25')} />
        ) : (
          // Half a phone screen is not always enough for a seven-figure amount.
          // Wrap rather than truncate — the grid stretches every tile to the
          // tallest row, so a second line costs nothing and keeps the figure whole.
          <p className="mt-4 break-words font-numeric text-base font-bold tracking-tight sm:mt-5 sm:text-2xl">
            {value}
          </p>
        )}
        {hint && (
          <p
            className={cn(
              'mt-1.5 flex items-center gap-1 text-[11px] font-medium sm:text-xs',
              hero ? 'text-white/75' : 'text-muted-foreground',
            )}
          >
            <span className="truncate">{hint}</span>
            {hero && <ArrowUpRight className="h-3 w-3 flex-shrink-0 rtl:-scale-x-100" />}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function Overview() {
  const navigate = useNavigate();
  const { balance, isLoading: earningsLoading } = useEarnings();
  const { activeCount } = useShipments();
  const { roster } = useAgentsRoster();
  const { pendingActionCount } = useVendorConnections();

  const dashboard = useResource(async () => {
    const [recent, cod, declared] = await Promise.all([
      shipmentsService.list({ page: 1, limit: 5 }),
      codCashService.getSummary(),
      codCashService.listDeposits({ status: 'declared', page: 1, limit: 1 }),
    ]);
    return {
      recent: recent.data,
      cod: cod.data,
      declaredCount: declared.meta.total,
    };
  }, []);

  const currency = balance?.currency ?? 'XAF';
  const codLiability = dashboard.data?.cod.liability.balance ?? 0;
  const declaredCount = dashboard.data?.declaredCount ?? 0;
  const recent = dashboard.data?.recent ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Overview"
        description="Welcome back! Here's what's happening with your agency."
        shortDescription="Welcome back!"
      />

      {/* Metrics — one filled hero (money), three supporting counts. 2×2 on phones. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard
          hero
          title="Available Earnings"
          value={formatCurrency(balance?.available ?? 0, currency)}
          icon={Wallet}
          isLoading={earningsLoading}
          hint="Ready to withdraw"
          onClick={() => navigate('/dashboard/account/payout')}
        />
        <MetricCard
          title="Shipments Needing Action"
          value={activeCount.toString()}
          icon={Truck}
          accent="blue"
          hint="Awaiting your dispatch"
          onClick={() => navigate('/dashboard/shipments')}
        />
        <MetricCard
          title="Owed to Platform (COD)"
          value={formatCurrency(codLiability, currency)}
          icon={Banknote}
          accent="gold"
          isLoading={dashboard.isLoading}
          hint="Cash to remit"
          onClick={() => navigate('/dashboard/cash/summary')}
        />
        <MetricCard
          title="Agents on Roster"
          value={roster.length.toString()}
          icon={Users}
          accent="emerald"
          hint="Active riders"
          onClick={() => navigate('/dashboard/agents/connections')}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent shipments */}
        <Card className={cn(listSurfaceClass, 'gap-4 md:gap-6')}>
          <CardHeader className="flex flex-row items-center justify-between px-4 pt-4 md:px-6 md:pt-0">
            <div>
              <CardTitle>Recent Shipments</CardTitle>
              <CardDescription>Latest shipments assigned to your agency</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/dashboard/shipments')}>
              View all
              <ArrowRight className="w-4 h-4 rtl:-scale-x-100" />
            </Button>
          </CardHeader>
          <CardContent className="px-0 md:px-6">
            {dashboard.isLoading ? (
              <div className="space-y-3 px-4 md:px-0">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : recent.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <Package className="h-6 w-6 opacity-60" />
                </div>
                <p className="text-sm font-medium">No shipments yet</p>
                <p className="text-xs text-muted-foreground">New assignments from vendors will appear here.</p>
              </div>
            ) : (
              <div className="divide-y md:space-y-2 md:divide-y-0">
                {recent.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => navigate('/dashboard/shipments')}
                    className="group flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-muted/60 md:rounded-xl md:border md:border-transparent md:px-3 md:hover:border-border"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Truck className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{s.orderNumber}</p>
                        <p className="truncate text-sm text-muted-foreground">{s.customer.name}</p>
                      </div>
                    </div>
                    <ShipmentStatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions + attention */}
        <div className="space-y-6">
          {/* The tinted "Attention Needed" card below keeps its frame — the
              colour is the signal. Quick Actions is ordinary content, so on a
              phone it sheds the frame and is ruled off from the list above. */}
          <Card className={cn(sectionSurfaceClass, sectionRuleClass)}>
            <SectionHeading
              title="Quick Actions"
              description="Common tasks you might want to perform"
              short="Common tasks"
            />
            <CardContent className="max-md:px-0">
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-auto justify-start gap-3 py-3" onClick={() => navigate('/dashboard/tickets', { state: { create: true } })}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><TicketIcon className="w-4 h-4" /></span>
                  <div className="text-left"><p className="font-semibold">New Ticket</p><p className="text-xs font-normal text-muted-foreground">Get help</p></div>
                </Button>
                <Button variant="outline" className="h-auto justify-start gap-3 py-3" onClick={() => navigate('/dashboard/account/locations')}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-info-500/10 text-info-600 dark:text-info-500"><MapPin className="w-4 h-4" /></span>
                  <div className="text-left"><p className="font-semibold">Coverage</p><p className="text-xs font-normal text-muted-foreground">Update regions</p></div>
                </Button>
                <Button variant="outline" className="h-auto justify-start gap-3 py-3" onClick={() => navigate('/dashboard/account/payout')}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Wallet className="w-4 h-4" /></span>
                  <div className="text-left"><p className="font-semibold">Earnings</p><p className="text-xs font-normal text-muted-foreground">Request payout</p></div>
                </Button>
                <Button variant="outline" className="h-auto justify-start gap-3 py-3" onClick={() => navigate('/dashboard/cash/deposits')}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500/15 text-gold-700 dark:text-gold-400"><Banknote className="w-4 h-4" /></span>
                  <div className="text-left"><p className="font-semibold">COD Cash</p><p className="text-xs font-normal text-muted-foreground">Deposits</p></div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {(declaredCount > 0 || activeCount > 0 || pendingActionCount > 0) && (
            <Card className="border-gold-400/50 bg-gold-50/70 dark:border-gold-500/25 dark:bg-gold-500/10">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-gold-700 dark:text-gold-400">
                  <AlertCircle className="w-5 h-5" />
                  Attention Needed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {declaredCount > 0 && (
                    <button onClick={() => navigate('/dashboard/cash/deposits')} className="flex w-full items-center justify-between rounded-lg bg-background/70 p-2.5 text-left transition-colors hover:bg-background dark:bg-background/40">
                      <span className="text-sm font-medium">{declaredCount} cash declaration{declaredCount === 1 ? '' : 's'} to answer</span>
                      <Badge variant="outline" className="border-gold-400/60 text-gold-700 dark:text-gold-400">2-day SLA</Badge>
                    </button>
                  )}
                  {activeCount > 0 && (
                    <button onClick={() => navigate('/dashboard/shipments')} className="flex w-full items-center justify-between rounded-lg bg-background/70 p-2.5 text-left transition-colors hover:bg-background dark:bg-background/40">
                      <span className="text-sm font-medium">{activeCount} shipment{activeCount === 1 ? '' : 's'} need action</span>
                      <Badge variant="outline" className="border-gold-400/60 text-gold-700 dark:text-gold-400">Shipments</Badge>
                    </button>
                  )}
                  {pendingActionCount > 0 && (
                    <button onClick={() => navigate('/dashboard/vendors/connections')} className="flex w-full items-center justify-between rounded-lg bg-background/70 p-2.5 text-left transition-colors hover:bg-background dark:bg-background/40">
                      <span className="text-sm font-medium">{pendingActionCount} vendor connection request{pendingActionCount === 1 ? '' : 's'}</span>
                      <Badge variant="outline" className="border-gold-400/60 text-gold-700 dark:text-gold-400">Vendors</Badge>
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
