import { useAnalyticsStore } from '@/store';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = [
  'hsl(var(--primary))',
  '#60a5fa',
  '#34d399',
  '#fbbf24',
];

export function CategoryChart() {
  const { categoryBreakdown } = useAnalyticsStore();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={categoryBreakdown}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={4}
            dataKey="sales"
          >
            {categoryBreakdown.map((_entry: unknown, index: number) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload as { category: string; sales: number; percentage: number };
                return (
                  <div className="bg-card border rounded-lg shadow-lg p-3">
                    <p className="text-sm font-medium">{data.category}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(data.sales)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {data.percentage}% of total
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
