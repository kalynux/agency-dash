import { formatCurrency } from '@/lib/format';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Wallet, Users, PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import {
  compactCardClass,
  compactCardContentClass,
  listSurfaceClass,
} from '@/components/layout/PageContainer';
import { cn } from '@/lib/utils';
import { codCashService } from '@/services/cod-cash.service';
import { getApiErrorMessage } from '@/lib/errors';
import type { CodSummary } from '@/types/cod-cash.types';

type HoldingFilter = 'all' | 'holding' | 'settled';

function StatCard({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string; hint?: string }) {
  return (
    <Card className={compactCardClass}>
      <CardContent className={cn(compactCardContentClass, 'flex items-start justify-between gap-3')}>
        <div className="min-w-0">
          <p className="text-sm leading-snug text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold leading-tight mt-0.5">{value}</p>
          {hint && <p className="text-xs leading-snug text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryTab() {
  const { t } = useTranslation(['cash', 'common']);
  const [summary, setSummary] = useState<CodSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [holding, setHolding] = useState<HoldingFilter>('all');

  const holdingOptions = useMemo(
    () => [
      { value: 'all' as const, label: t('summary.allAgents') },
      { value: 'holding' as const, label: t('summary.holdingCash') },
      { value: 'settled' as const, label: t('summary.settledUp') },
    ],
    [t],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await codCashService.getSummary();
      setSummary(data);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
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
        <Loader2 className="w-4 h-4 animate-spin" /> {t('summary.loading')}
      </div>
    );
  }

  if (loadError || !summary) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground mb-4">{loadError ?? t('summary.noData')}</p>
        <Button variant="outline" onClick={load}>{t('common:actions.retry')}</Button>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const visibleAgents = summary.agents.filter((a) => {
    if (holding === 'holding' && a.cashHeld <= 0) return false;
    if (holding === 'settled' && a.cashHeld > 0) return false;
    return !query || a.name.toLowerCase().includes(query);
  });

  const agentsHoldingCash = summary.agents.filter((a) => a.cashHeld > 0).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          icon={Wallet}
          label={t('summary.owedToPlatform')}
          value={formatCurrency(summary.liability.balance, summary.liability.currency)}
          hint={t('summary.owedHint')}
        />
        <StatCard
          icon={PackageOpen}
          label={t('summary.unsettled')}
          value={formatCurrency(summary.unsettledCollections.amount, summary.liability.currency)}
          hint={t('summary.unsettledHint', { count: summary.unsettledCollections.count })}
        />
        <StatCard
          icon={Users}
          label={t('summary.heldByAgents')}
          value={formatCurrency(summary.agents.reduce((sum, a) => sum + a.cashHeld, 0), summary.liability.currency)}
          hint={t('summary.heldByAgentsHint', { count: agentsHoldingCash })}
        />
      </div>

      <SearchFilterBar
        value={search}
        onChange={setSearch}
        placeholder={t('summary.searchPlaceholder')}
        searchLabel={t('summary.searchLabel')}
        activeCount={holding === 'all' ? 0 : 1}
        onReset={() => setHolding('all')}
        filterDescription={t('summary.filterDescription')}
        resultCount={visibleAgents.length}
        resultNounKey="common:nouns.agent"
      >
        <FilterSection label={t('summary.cashPosition')}>
          <FilterOptionGroup value={holding} onChange={setHolding} options={holdingOptions} />
        </FilterSection>
      </SearchFilterBar>

      <Card className={listSurfaceClass}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-start p-4 text-sm font-medium">{t('summary.agent')}</th>
                  <th className="text-start p-4 text-sm font-medium">{t('summary.cashHeld')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleAgents.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-8 text-center text-muted-foreground">
                      {summary.agents.length === 0
                        ? t('summary.emptyRoster')
                        : t('summary.emptyFiltered')}
                    </td>
                  </tr>
                ) : (
                  visibleAgents.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium"><span className="block max-w-[16rem] truncate" title={a.name}>{a.name}</span></td>
                      <td className="p-4">
                        {a.cashHeld > 0 ? (
                          <span className="text-amber-600 font-medium">{formatCurrency(a.cashHeld, summary.liability.currency)}</span>
                        ) : (
                          <span className="text-muted-foreground">{t('common:values.notAvailable')}</span>
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
