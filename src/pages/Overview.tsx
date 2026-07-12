import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Truck,
  Users,
  Target,
  Calendar,
  ArrowRight,
  Ticket as TicketIcon,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalyticsStore, useOrderStore, useTicketStore } from '@/store';
import { SalesChart } from '@/components/features/SalesChart';
import { CategoryChart } from '@/components/features/CategoryChart';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { cn } from '@/lib/utils';
import type { Order } from '@/types';

const dateRanges = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Custom', value: 'custom' },
];

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: React.ElementType;
  isLoading?: boolean;
}

function MetricCard({ title, value, change, changeType, icon: Icon, isLoading }: MetricCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="animate-fade-in">
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold">{value}</p>
              <div className="flex items-center gap-1">
                {changeType === 'increase' ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : changeType === 'decrease' ? (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                ) : null}
                <span
                  className={cn(
                    'text-sm font-medium',
                    changeType === 'increase' && 'text-green-500',
                    changeType === 'decrease' && 'text-red-500',
                    changeType === 'neutral' && 'text-muted-foreground'
                  )}
                >
                  {change > 0 ? '+' : ''}{change}%
                </span>
                <span className="text-sm text-muted-foreground">vs last period</span>
              </div>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function Overview() {
  const navigate = useNavigate();
  const { metrics, dateRange, setDateRange, fetchAnalytics, isLoading } = useAnalyticsStore();
  const { orders, fetchOrders } = useOrderStore();
  const { tickets, fetchTickets } = useTicketStore();

  useEffect(() => {
    fetchAnalytics();
    fetchOrders();
    fetchTickets();
  }, [fetchAnalytics, fetchOrders, fetchTickets]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const recentOrders = orders.slice(0, 5);
  const attentionOrders = orders.filter((o: Order) => o.riskLevel === 'high' || (o.riskLevel === 'medium' && o.status === 'pending'));
  const openTickets = tickets.filter((t) => t.status === 'open' || t.priority === 'urgent');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s what&apos;s happening with your agency.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-muted rounded-lg p-1">
            {dateRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setDateRange({ ...dateRange, label: range.label })}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  dateRange.label === range.label
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon">
            <Calendar className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(metrics.totalSales.value)}
          change={metrics.totalSales.change}
          changeType={metrics.totalSales.changeType}
          icon={DollarSign}
          isLoading={isLoading}
        />
        <MetricCard
          title="Total Deliveries"
          value={metrics.totalOrders.value.toString()}
          change={metrics.totalOrders.change}
          changeType={metrics.totalOrders.changeType}
          icon={Truck}
          isLoading={isLoading}
        />
        <MetricCard
          title="On-Time Rate"
          value={`${metrics.conversionRate.value}%`}
          change={metrics.conversionRate.change}
          changeType={metrics.conversionRate.changeType}
          icon={Target}
          isLoading={isLoading}
        />
        <MetricCard
          title="Average Delivery Value"
          value={formatCurrency(metrics.averageOrderValue.value)}
          change={metrics.averageOrderValue.change}
          changeType={metrics.averageOrderValue.changeType}
          icon={Users}
          isLoading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Delivery Performance</CardTitle>
              <CardDescription>Daily revenue and delivery volume trends</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <div className="w-2 h-2 rounded-full bg-primary" />
                Revenue
              </Badge>
              <Badge variant="outline" className="gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                Deliveries
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <SalesChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Region</CardTitle>
            <CardDescription>Breakdown by coverage area</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryChart />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Deliveries */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Deliveries</CardTitle>
              <CardDescription>Latest deliveries assigned to your agency</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/dashboard/shipments')}>
              View all
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.map((order: Order) => (
                <div
                  key={order.id}
                  onClick={() => navigate('/dashboard/shipments')}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Truck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-sm text-muted-foreground">{order.customer.name}</p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-medium">{formatCurrency(order.total)}</p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Attention Needed */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks you might want to perform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => navigate('/dashboard/tickets', { state: { create: true } })}>
                  <TicketIcon className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-medium">New Ticket</p>
                    <p className="text-xs text-muted-foreground">Get help from support</p>
                  </div>
                </Button>
                <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => navigate('/dashboard/account/business')}>
                  <MapPin className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-medium">Coverage Areas</p>
                    <p className="text-xs text-muted-foreground">Update your regions</p>
                  </div>
                </Button>
                <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => navigate('/dashboard/transactions')}>
                  <DollarSign className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-medium">View Payouts</p>
                    <p className="text-xs text-muted-foreground">Track earnings</p>
                  </div>
                </Button>
                <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => navigate('/dashboard/analytics')}>
                  <TrendingUp className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-medium">View Reports</p>
                    <p className="text-xs text-muted-foreground">Analytics & insights</p>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Attention Needed */}
          {(attentionOrders.length > 0 || openTickets.length > 0) && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <AlertCircle className="w-5 h-5" />
                  Attention Needed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {attentionOrders.slice(0, 2).map((order) => (
                    <div
                      key={order.id}
                      onClick={() => navigate('/dashboard/shipments')}
                      className="flex items-center justify-between p-2 rounded bg-white/50 cursor-pointer"
                    >
                      <span className="text-sm font-medium text-amber-900">Delivery {order.orderNumber} at risk</span>
                      <Badge variant="outline" className="text-amber-700 border-amber-300">
                        {order.riskLevel} risk
                      </Badge>
                    </div>
                  ))}
                  {openTickets.slice(0, 2).map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => navigate('/dashboard/tickets')}
                      className="flex items-center justify-between p-2 rounded bg-white/50 cursor-pointer"
                    >
                      <span className="text-sm font-medium text-amber-900 truncate">{ticket.subject}</span>
                      <Badge variant="outline" className="text-amber-700 border-amber-300">
                        open ticket
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
