import { useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Target,
  Calendar,
  ArrowRight,
  Package,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalyticsStore, useOrderStore, useProductStore } from '@/store';
import { SalesChart } from '@/components/features/SalesChart';
import { CategoryChart } from '@/components/features/CategoryChart';
import { cn } from '@/lib/utils';

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

export function Overview () {
  const { metrics, dateRange, setDateRange, fetchAnalytics, isLoading } = useAnalyticsStore();
  const { orders, fetchOrders } = useOrderStore();
  const { products, fetchProducts } = useProductStore();

  useEffect(() => {
    fetchAnalytics();
    fetchOrders();
    fetchProducts();
  }, [fetchAnalytics, fetchOrders, fetchProducts]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const recentOrders = orders.slice(0, 5);
  const lowStockProducts = products.filter(
    (p: Product) => p.inventory.tracked && p.inventory.quantity <= p.inventory.lowStockThreshold
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s what&apos;s happening with your store.
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
          title="Total Sales"
          value={formatCurrency(metrics.totalSales.value)}
          change={metrics.totalSales.change}
          changeType={metrics.totalSales.changeType}
          icon={DollarSign}
          isLoading={isLoading}
        />
        <MetricCard
          title="Total Orders"
          value={metrics.totalOrders.value.toString()}
          change={metrics.totalOrders.change}
          changeType={metrics.totalOrders.changeType}
          icon={ShoppingCart}
          isLoading={isLoading}
        />
        <MetricCard
          title="Conversion Rate"
          value={`${metrics.conversionRate.value}%`}
          change={metrics.conversionRate.change}
          changeType={metrics.conversionRate.changeType}
          icon={Target}
          isLoading={isLoading}
        />
        <MetricCard
          title="Average Order Value"
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
              <CardTitle>Sales Performance</CardTitle>
              <CardDescription>Daily sales and order trends</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <div className="w-2 h-2 rounded-full bg-primary" />
                Sales
              </Badge>
              <Badge variant="outline" className="gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                Orders
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <SalesChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales by Category</CardTitle>
            <CardDescription>Revenue breakdown by product category</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryChart />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest orders from your customers</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1">
              View all
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.map((order: Order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-sm text-muted-foreground">{order.customer.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(order.total)}</p>
                    <Badge
                      variant={
                        order.status === 'delivered'
                          ? 'default'
                          : order.status === 'pending'
                          ? 'secondary'
                          : order.status === 'cancelled'
                          ? 'destructive'
                          : 'outline'
                      }
                      className="text-xs"
                    >
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Alerts */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks you might want to perform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="justify-start gap-2 h-auto py-3">
                  <Package className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-medium">Add Product</p>
                    <p className="text-xs text-muted-foreground">Create new listing</p>
                  </div>
                </Button>
                <Button variant="outline" className="justify-start gap-2 h-auto py-3">
                  <RefreshCw className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-medium">Process Refund</p>
                    <p className="text-xs text-muted-foreground">Handle returns</p>
                  </div>
                </Button>
                <Button variant="outline" className="justify-start gap-2 h-auto py-3">
                  <AlertCircle className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-medium">Abandoned Carts</p>
                    <p className="text-xs text-muted-foreground">12 need attention</p>
                  </div>
                </Button>
                <Button variant="outline" className="justify-start gap-2 h-auto py-3">
                  <TrendingUp className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-medium">View Reports</p>
                    <p className="text-xs text-muted-foreground">Analytics & insights</p>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Low Stock Alert */}
          {lowStockProducts.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <AlertCircle className="w-5 h-5" />
                  Low Stock Alert
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lowStockProducts.slice(0, 3).map((product: Product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-2 rounded bg-white/50"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-8 h-8 rounded object-cover"
                        />
                        <span className="text-sm font-medium text-amber-900">{product.name}</span>
                      </div>
                      <Badge variant="outline" className="text-amber-700 border-amber-300">
                        {product.inventory.quantity} left
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

//  functionOverview

// Import types
import type { Product, Order } from '@/types';import { de } from "date-fns/locale";

