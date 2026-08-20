import { formatCurrency } from '@/lib/format';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Wallet, Users, PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InfoHint } from '@/components/common/InfoHint';
import { RecordCard, RecordCardList } from '@/components/common/RecordCard';
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

interface Stat {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
}

function StatCard({ icon: Icon, label, value, hint }: Stat) {
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

/**
 * One stat as a row rather than a tile — the phone form of {@link StatCard}.
 *
 * Three tiles stacked cost ~270px before the agent list starts, which on a
 * 640px-tall viewport is the whole first screen spent on numbers nobody scrolled
 * here for. As rows the same three read in ~130px, and the hint that justified
 * each tile's third line moves behind the ⓘ.
 */
function StatRow({ icon: Icon, label, value, hint }: Stat) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-muted-foreground">
        <span className="truncate">{label}</span>
        <InfoHint label={label}>{hint}</InfoHint>
      </span>
      <span className="shrink-0 font-semibold tabular-nums">{value}</span>
    </div>
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

  const stats: Stat[] = [
    {
      icon: Wallet,
      label: t('summary.owedToPlatform'),
      value: formatCurrency(summary.liability.balance, summary.liability.currency),
      hint: t('summary.owedHint'),
    },
    {
      icon: PackageOpen,
      label: t('summary.unsettled'),
      value: formatCurrency(summary.unsettledCollections.amount, summary.liability.currency),
      hint: t('summary.unsettledHint', { count: summary.unsettledCollections.count }),
    },
    {
      icon: Users,
      label: t('summary.heldByAgents'),
      value: formatCurrency(
        summary.agents.reduce((sum, a) => sum + a.cashHeld, 0),
        summary.liability.currency,
      ),
      hint: t('summary.heldByAgentsHint', { count: agentsHoldingCash }),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tiles where there is width for them, rows where there is not. The
          breakpoint is `sm` because that is where the existing grid already
          went three-across. */}
      <div className="hidden gap-4 sm:grid sm:grid-cols-3">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>
      <Card className={cn(compactCardClass, 'sm:hidden')}>
        <CardContent className="divide-y p-0">
          {stats.map((s) => (
            <StatRow key={s.label} {...s} />
          ))}
        </CardContent>
      </Card>

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
          {/* Mobile: one card per agent. */}
          <RecordCardList>
            {visibleAgents.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {summary.agents.length === 0
                  ? t('summary.emptyRoster')
                  : t('summary.emptyFiltered')}
              </p>
            ) : (
              visibleAgents.map((a) => (
                <RecordCard
                  key={a.id}
                  title={a.name}
                  primary={
                    a.cashHeld > 0 ? (
                      <span className="text-amber-600">
                        {formatCurrency(a.cashHeld, summary.liability.currency)}
                      </span>
                    ) : (
                      <span className="font-normal text-muted-foreground">
                        {t('summary.settledUp')}
                      </span>
                    )
                  }
                />
              ))
            )}
          </RecordCardList>

          <div className="hidden overflow-x-auto md:block">
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
