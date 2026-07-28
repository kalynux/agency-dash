import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  Truck,
  Banknote,
  Users,
  ArrowRight,
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

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  isLoading?: boolean;
  onClick?: () => void;
}

function MetricCard({ title, value, icon: Icon, isLoading, onClick }: MetricCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {isLoading ? <Skeleton className="h-8 w-28" /> : <p className="text-2xl font-bold truncate">{value}</p>}
          </div>
          <div className="p-3 bg-primary/10 rounded-lg flex-shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
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
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground">Welcome back! Here&apos;s what&apos;s happening with your agency.</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Available Earnings"
          value={`${(balance?.available ?? 0).toLocaleString()} ${currency}`}
          icon={Wallet}
          isLoading={earningsLoading}
          onClick={() => navigate('/dashboard/account/payout')}
        />
        <MetricCard
          title="Shipments Needing Action"
          value={activeCount.toString()}
          icon={Truck}
          onClick={() => navigate('/dashboard/shipments')}
        />
        <MetricCard
          title="Owed to Platform (COD)"
          value={`${codLiability.toLocaleString()} ${currency}`}
          icon={Banknote}
          isLoading={dashboard.isLoading}
          onClick={() => navigate('/dashboard/cash/summary')}
        />
        <MetricCard
          title="Agents on Roster"
          value={roster.length.toString()}
          icon={Users}
          onClick={() => navigate('/dashboard/agents/roster')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent shipments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Shipments</CardTitle>
              <CardDescription>Latest shipments assigned to your agency</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/dashboard/shipments')}>
              View all
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {dashboard.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : recent.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No shipments yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recent.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => navigate('/dashboard/shipments')}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Truck className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.orderNumber}</p>
                        <p className="text-sm text-muted-foreground truncate">{s.customer.name}</p>
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
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks you might want to perform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => navigate('/dashboard/tickets', { state: { create: true } })}>
                  <TicketIcon className="w-4 h-4" />
                  <div className="text-left"><p className="font-medium">New Ticket</p><p className="text-xs text-muted-foreground">Get help</p></div>
                </Button>
                <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => navigate('/dashboard/account/locations')}>
                  <MapPin className="w-4 h-4" />
                  <div className="text-left"><p className="font-medium">Coverage</p><p className="text-xs text-muted-foreground">Update regions</p></div>
                </Button>
                <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => navigate('/dashboard/account/payout')}>
                  <Wallet className="w-4 h-4" />
                  <div className="text-left"><p className="font-medium">Earnings</p><p className="text-xs text-muted-foreground">Request payout</p></div>
                </Button>
                <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => navigate('/dashboard/cash/deposits')}>
                  <Banknote className="w-4 h-4" />
                  <div className="text-left"><p className="font-medium">COD Cash</p><p className="text-xs text-muted-foreground">Deposits</p></div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {(declaredCount > 0 || activeCount > 0 || pendingActionCount > 0) && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <AlertCircle className="w-5 h-5" />
                  Attention Needed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {declaredCount > 0 && (
                    <button onClick={() => navigate('/dashboard/cash/deposits')} className="w-full flex items-center justify-between p-2 rounded bg-white/50">
                      <span className="text-sm font-medium text-amber-900">{declaredCount} cash declaration{declaredCount === 1 ? '' : 's'} to answer</span>
                      <Badge variant="outline" className="text-amber-700 border-amber-300">2-day SLA</Badge>
                    </button>
                  )}
                  {activeCount > 0 && (
                    <button onClick={() => navigate('/dashboard/shipments')} className="w-full flex items-center justify-between p-2 rounded bg-white/50">
                      <span className="text-sm font-medium text-amber-900">{activeCount} shipment{activeCount === 1 ? '' : 's'} need action</span>
                      <Badge variant="outline" className="text-amber-700 border-amber-300">Shipments</Badge>
                    </button>
                  )}
                  {pendingActionCount > 0 && (
                    <button onClick={() => navigate('/dashboard/vendors/connections')} className="w-full flex items-center justify-between p-2 rounded bg-white/50">
                      <span className="text-sm font-medium text-amber-900">{pendingActionCount} vendor connection request{pendingActionCount === 1 ? '' : 's'}</span>
                      <Badge variant="outline" className="text-amber-700 border-amber-300">Vendors</Badge>
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
