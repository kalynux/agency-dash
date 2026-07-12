import { useEffect } from 'react';
import {
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Truck,
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
  const { metrics, dateRange, setDateRange, fetchAnalytics, categoryBreakdown } = useAnalyticsStore();

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
            Track your delivery performance and earnings
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
          title="Total Revenue"
          value={formatCurrency(metrics.totalSales.value)}
          change={metrics.totalSales.change}
          changeType={metrics.totalSales.changeType}
          icon={DollarSign}
        />
        <MetricCard
          title="Total Deliveries"
          value={metrics.totalOrders.value.toString()}
          change={metrics.totalOrders.change}
          changeType={metrics.totalOrders.changeType}
          icon={Truck}
        />
        <MetricCard
          title="On-Time Rate"
          value={`${metrics.conversionRate.value}%`}
          change={metrics.conversionRate.change}
          changeType={metrics.conversionRate.changeType}
          icon={Target}
        />
        <MetricCard
          title="Average Delivery Value"
          value={formatCurrency(metrics.averageOrderValue.value)}
          change={metrics.averageOrderValue.change}
          changeType={metrics.averageOrderValue.changeType}
          icon={Users}
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="deliveries" className="gap-2">
            <LineChart className="w-4 h-4" />
            Deliveries
          </TabsTrigger>
          <TabsTrigger value="coverage" className="gap-2">
            <PieChart className="w-4 h-4" />
            Coverage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Top Coverage Regions</CardTitle>
                  <CardDescription>Best performing regions this period</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="gap-1">
                  View all
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categoryBreakdown.map((region, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium">{region.category}</p>
                          <p className="text-sm text-muted-foreground">{region.percentage}% of revenue</p>
                        </div>
                      </div>
                      <span className="font-semibold">{formatCurrency(region.sales)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest actions on your agency account</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { action: 'New delivery assigned', detail: 'Order #1004 - $371.39', time: '2 hours ago' },
                    { action: 'Delivery status updated', detail: 'Order #1003 - Processing', time: '4 hours ago' },
                    { action: 'Ticket resolved', detail: 'How to add a coverage region', time: '6 hours ago' },
                    { action: 'Delivery completed', detail: 'Order #1002 via UPS', time: '8 hours ago' },
                    { action: 'Payout processed', detail: '$3,245.67 to Mobile Money', time: '12 hours ago' },
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

        <TabsContent value="deliveries" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Analytics</CardTitle>
              <CardDescription>Detailed delivery breakdown by time period</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesChart />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coverage" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Coverage Performance</CardTitle>
                <CardDescription>Revenue breakdown by region</CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryChart />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Delivery Status Breakdown</CardTitle>
                <CardDescription>Current delivery pipeline overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { status: 'Delivered', count: 45, color: 'bg-green-500' },
                    { status: 'Shipped', count: 8, color: 'bg-indigo-500' },
                    { status: 'Processing', count: 12, color: 'bg-purple-500' },
                    { status: 'Pending', count: 6, color: 'bg-yellow-500' },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${item.color}`} />
                        <span>{item.status}</span>
                      </div>
                      <span className="font-semibold">{item.count} deliveries</span>
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
