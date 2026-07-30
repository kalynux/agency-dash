import { formatCurrency } from '@/lib/format';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Wallet, Users, PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { codCashService } from '@/services/cod-cash.service';
import { ApiError } from '@/types/api';
import type { CodSummary } from '@/types/cod-cash.types';

function StatCard({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryTab() {
  const [summary, setSummary] = useState<CodSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await codCashService.getSummary();
      setSummary(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load your cash position.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading cash position…
      </div>
    );
  }

  if (loadError || !summary) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground mb-4">{loadError ?? 'No data available.'}</p>
        <Button variant="outline" onClick={load}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Wallet}
          label="Owed to Platform"
          value={formatCurrency(summary.liability.balance, summary.liability.currency)}
          hint="Falls only when a remittance is confirmed"
        />
        <StatCard
          icon={PackageOpen}
          label="Unsettled Collections"
          value={formatCurrency(summary.unsettledCollections.amount, summary.liability.currency)}
          hint={`${summary.unsettledCollections.count} collection${summary.unsettledCollections.count === 1 ? '' : 's'} blocking earnings`}
        />
        <StatCard
          icon={Users}
          label="Held by Agents"
          value={formatCurrency(summary.agents.reduce((sum, a) => sum + a.cashHeld, 0), summary.liability.currency)}
          hint={`${summary.agents.filter((a) => a.cashHeld > 0).length} agent(s) currently holding cash`}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 text-sm font-medium">Agent</th>
                  <th className="text-left p-4 text-sm font-medium">Cash Held</th>
                </tr>
              </thead>
              <tbody>
                {summary.agents.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-8 text-center text-muted-foreground">
                      No agents on your roster yet
                    </td>
                  </tr>
                ) : (
                  summary.agents.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium"><span className="block max-w-[16rem] truncate" title={a.name}>{a.name}</span></td>
                      <td className="p-4">
                        {a.cashHeld > 0 ? (
                          <span className="text-amber-600 font-medium">{formatCurrency(a.cashHeld, summary.liability.currency)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
