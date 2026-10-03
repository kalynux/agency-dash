import { formatCurrency } from '@/lib/format';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Gauge, Loader2, Wallet, Users, PackageOpen, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { withCreateParam } from '@/hooks/useOpenParam';
import { RecordCard, RecordCardList } from '@/components/common/RecordCard';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
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
import type { CodLimit, CodSummary } from '@/types/cod-cash.types';
import { usePageRefresh } from '@/store/pageRefresh.store';

type HoldingFilter = 'all' | 'holding' | 'settled';

/**
 * The three numbers are not equals, and the layout says so.
 *
 * "Owed to platform" is the agency's one liability and the only one it can act
 * on from here (by declaring a remittance), so it is the hero: full width on a
 * phone, primary-filled, with the action beside it. The other two explain
 * where that money is — still out with agents, or collected but unsettled —
 * and sit side by side underneath as a pair.
 *
 * This replaces three identical tiles on desktop and a list of rows on a phone
 * that hid every explanation behind an ⓘ. The hints are one short line each,
 * and on a money screen they are part of the number, not a footnote.
 */
function OwedCard({
  value,
  hint,
  canRemit,
  className,
}: {
  value: string;
  hint: string;
  canRemit: boolean;
  className?: string;
}) {
  const { t } = useTranslation('cash');
  return (
    <Card className={cn(compactCardClass, 'border-primary bg-primary text-primary-foreground', className)}>
      <CardContent className={cn(compactCardContentClass, 'flex h-full flex-col gap-3')}>
        <div className="flex items-center gap-2 text-sm text-primary-foreground/80">
          <Wallet className="h-4 w-4" />
          {t('summary.owedToPlatform')}
        </div>
        <p className="text-3xl font-bold leading-none tabular-nums break-words">{value}</p>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2">
          <p className="text-xs leading-snug text-primary-foreground/75">{hint}</p>
          {canRemit && (
            <Button asChild size="sm" variant="secondary" className="gap-1.5">
              <Link to={withCreateParam('/dashboard/cash/remittances')}>
                <Send className="h-3.5 w-3.5" />
                {t('summary.declareRemittance')}
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className={compactCardClass}>
      <CardContent className={cn(compactCardContentClass, 'flex h-full flex-col gap-1.5')}>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="leading-tight">{label}</span>
        </div>
        {/* `break-words`: "1 250 000 FCFA" in a half-width phone column must
            wrap rather than push the card wider than the screen. */}
        <p className="text-lg font-semibold leading-tight tabular-nums break-words sm:text-2xl">{value}</p>
        <p className="mt-auto text-xs leading-snug text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/**
 * The agency's COD cash limit (`GET /agency/cod/limit`) — the only signal it
 * gets about it: there is no notification when it goes over (brief G-2).
 *
 * It loads on its own and fails on its own: a limit that cannot be fetched
 * shows a one-line retry here and leaves the cash position below untouched.
 */
function CodLimitCard() {
  const { t } = useTranslation(['cash', 'common']);
  const [limit, setLimit] = useState<CodLimit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await codCashService.getCodLimit();
      setLimit(data);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePageRefresh(load, isLoading);

  if (!limit) {
    return (
      <Card className={compactCardClass}>
        <CardContent className={cn(compactCardContentClass, 'flex flex-wrap items-center justify-between gap-2')}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
            {isLoading ? t('summary.limit.loading') : (loadError ?? t('summary.limit.loadFailed'))}
          </div>
          {!isLoading && (
            <Button size="sm" variant="outline" onClick={load}>{t('common:actions.retry')}</Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const { exposure, overLimit } = limit;
  const percent =
    limit.limit > 0
      ? Math.min(100, Math.max(0, (exposure.total / limit.limit) * 100))
      : exposure.total > 0 ? 100 : 0;
  const sourceBadge =
    limit.source === 'override'
      ? t('summary.limit.sourceOverride')
      : limit.source === 'default'
        ? t('summary.limit.sourceDefault')
        : null;

  return (
    <Card className={cn(compactCardClass, overLimit && 'border-destructive')}>
      <CardContent className={cn(compactCardContentClass, 'space-y-3')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Gauge className={cn('h-4 w-4', overLimit ? 'text-destructive' : 'text-primary')} />
            {t('summary.limit.title')}
          </div>
          {sourceBadge && <Badge variant="secondary">{sourceBadge}</Badge>}
        </div>

        <div className="space-y-1.5">
          <p className={cn('text-lg font-semibold leading-tight tabular-nums break-words', overLimit && 'text-destructive')}>
            {t('summary.limit.held', {
              total: formatCurrency(exposure.total),
              limit: formatCurrency(limit.limit),
            })}
          </p>
          <Progress
            value={percent}
            aria-label={t('summary.limit.title')}
            className={overLimit ? 'bg-destructive/20' : undefined}
            indicatorClassName={overLimit ? 'bg-destructive' : undefined}
          />
          <p className="text-xs leading-snug text-muted-foreground tabular-nums">
            {t('summary.limit.inFlight', {
              amount: formatCurrency(exposure.inFlight),
              count: exposure.inFlightCount,
            })}
            {' · '}
            {t('summary.limit.collected', {
              amount: formatCurrency(exposure.collectedUnremitted),
              count: exposure.collectedCount,
            })}
          </p>
        </div>

        {overLimit ? (
          <p className="flex items-start gap-1.5 text-sm font-medium text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {t('summary.limit.overLimit')}
          </p>
        ) : (
          <p className="text-sm">
            {t('summary.limit.headroom', { headroom: formatCurrency(limit.headroom) })}
          </p>
        )}

        <Link
          to="/dashboard/cash/remittances"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('summary.limit.remitFrees')}
          <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>

        <p className="text-xs leading-snug text-muted-foreground">{t('summary.limit.explain')}</p>
      </CardContent>
    </Card>
  );
}

export function SummaryTab() {
  return (
    <div className="space-y-6">
      <CodLimitCard />
      <CashPosition />
    </div>
  );
}

function CashPosition() {
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

  usePageRefresh(load, isLoading);

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

  const currency = summary.liability.currency;
  const heldByAgents = summary.agents.reduce((sum, a) => sum + a.cashHeld, 0);

  return (
    <div className="space-y-6">
      {/* Hero full width + a pair on a phone; three across from `md`. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <OwedCard
          className="col-span-2 md:col-span-1"
          value={formatCurrency(summary.liability.balance, currency)}
          hint={t('summary.owedHint')}
          canRemit={summary.liability.balance > 0}
        />
        <MiniStat
          icon={Users}
          label={t('summary.heldByAgents')}
          value={formatCurrency(heldByAgents, currency)}
          hint={t('summary.heldByAgentsHint', { count: agentsHoldingCash })}
        />
        <MiniStat
          icon={PackageOpen}
          label={t('summary.unsettled')}
          value={formatCurrency(summary.unsettledCollections.amount, currency)}
          hint={t('summary.unsettledHint', { count: summary.unsettledCollections.count })}
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
                  titleAdornment={<VerifiedBadge verified={a.verified} />}
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
                      <td className="p-4 font-medium">
                        <span className="flex max-w-[16rem] items-center gap-1">
                          <span className="truncate" title={a.name}>{a.name}</span>
                          <VerifiedBadge verified={a.verified} />
                        </span>
                      </td>
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
