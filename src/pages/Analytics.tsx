import { useEffect } from 'react';
import {
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Target,
  BarChart3,
  PieChart,
  LineChart,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnalyticsStore } from '@/store';
import { SalesChart } from '@/components/features/SalesChart';
import { CategoryChart } from '@/components/features/CategoryChart';
import { cn } from '@/lib/utils';

const dateRanges = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'This Month', value: 'month' },
];

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: React.ElementType;
}

function MetricCard({ title, value, change, changeType, icon: Icon }: MetricCardProps) {
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

export function Analytics() {
  const { metrics, dateRange, setDateRange, fetchAnalytics } = useAnalyticsStore();

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track your store performance and insights
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
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
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
        />
        <MetricCard
          title="Total Orders"
          value={metrics.totalOrders.value.toString()}
          change={metrics.totalOrders.change}
          changeType={metrics.totalOrders.changeType}
          icon={ShoppingCart}
        />
        <MetricCard
          title="Conversion Rate"
          value={`${metrics.conversionRate.value}%`}
          change={metrics.conversionRate.change}
          changeType={metrics.conversionRate.changeType}
          icon={Target}
        />
        <MetricCard
          title="Average Order Value"
          value={formatCurrency(metrics.averageOrderValue.value)}
          change={metrics.averageOrderValue.change}
          changeType={metrics.averageOrderValue.changeType}
          icon={Users}
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <LineChart className="w-4 h-4" />
            Sales
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <PieChart className="w-4 h-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2">
            <Users className="w-4 h-4" />
            Customers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
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

          {/* Top Products & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Top Products</CardTitle>
                  <CardDescription>Best performing products this period</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="gap-1">
                  View all
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: 'Wireless Bluetooth Headphones', sales: 12450, orders: 83 },
                    { name: 'Smart Watch Pro', sales: 9876, orders: 33 },
                    { name: 'Leather Crossbody Bag', sales: 5432, orders: 60 },
                    { name: 'Ceramic Coffee Mug Set', sales: 3210, orders: 92 },
                  ].map((product, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.orders} orders</p>
                        </div>
                      </div>
                      <span className="font-semibold">{formatCurrency(product.sales)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest actions in your store</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { action: 'New order received', detail: 'Order #1004 - $371.39', time: '2 hours ago' },
                    { action: 'Product stock updated', detail: 'Wireless Headphones - 45 units', time: '4 hours ago' },
                    { action: 'Customer registered', detail: 'Carol White joined', time: '6 hours ago' },
                    { action: 'Order shipped', detail: 'Order #1002 via UPS', time: '8 hours ago' },
                    { action: 'Review received', detail: '5 stars on Smart Watch Pro', time: '12 hours ago' },
                  ].map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="font-medium">{activity.action}</p>
                        <p className="text-sm text-muted-foreground">{activity.detail}</p>
                      </div>
                      <span className="text-sm text-muted-foreground">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Analytics</CardTitle>
              <CardDescription>Detailed sales breakdown by time period</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesChart />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Category Performance</CardTitle>
                <CardDescription>Sales breakdown by product category</CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryChart />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory Status</CardTitle>
                <CardDescription>Current stock levels overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { status: 'In Stock', count: 45, color: 'bg-green-500' },
                    { status: 'Low Stock', count: 8, color: 'bg-yellow-500' },
                    { status: 'Out of Stock', count: 3, color: 'bg-red-500' },
                    { status: 'On Order', count: 12, color: 'bg-blue-500' },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${item.color}`} />
                        <span>{item.status}</span>
                      </div>
                      <span className="font-semibold">{item.count} products</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Customer Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Customers</span>
                    <span className="text-2xl font-bold">1,234</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">New This Month</span>
                    <span className="text-lg font-semibold text-green-600">+89</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Returning</span>
                    <span className="text-lg font-semibold">67%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: 'Alice Johnson', orders: 12, spent: 2345 },
                    { name: 'Bob Smith', orders: 8, spent: 1890 },
                    { name: 'Carol White', orders: 15, spent: 3456 },
                  ].map((customer, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={`https://i.pravatar.cc/150?u=${index}`}
                          alt={customer.name}
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <p className="text-sm font-medium">{customer.name}</p>
                          <p className="text-xs text-muted-foreground">{customer.orders} orders</p>
                        </div>
                      </div>
                      <span className="text-sm font-medium">{formatCurrency(customer.spent)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Customer Acquisition</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { source: 'Direct', percentage: 35 },
                    { source: 'Organic Search', percentage: 28 },
                    { source: 'Social Media', percentage: 20 },
                    { source: 'Referral', percentage: 12 },
                    { source: 'Email', percentage: 5 },
                  ].map((source, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{source.source}</span>
                        <span className="font-medium">{source.percentage}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${source.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
