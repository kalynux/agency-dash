import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  HandCoins,
  PackageX,
  Send,
  Undo2,
  Wallet,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveSelect } from '@/components/common/ResponsiveSelect';
import { RecordCard, RecordCardList } from '@/components/common/RecordCard';
import { ErrorState, LoadingState } from '@/components/common/state-views';
import {
  PageHeader,
  PageSection,
  compactCardClass,
  compactCardContentClass,
  listSurfaceClass,
} from '@/components/layout/PageContainer';
import { analyticsService } from '@/services/analytics.service';
import { usePageRefresh } from '@/store/pageRefresh.store';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';
import {
  ANALYTICS_PRESETS,
  presetRange,
  validateRange,
  type AnalyticsPreset,
  type DayRange,
} from '@/lib/analytics-range';
import { cn } from '@/lib/utils';
import type { AgencyAnalytics, AgencyAnalyticsMeta } from '@/types/analytics.types';

/**
 * Agency analytics over a date range (`GET /agency/analytics`).
 *
 * Every figure is what the platform actually credited, so nothing here carries
 * an "estimate" caveat. Cash on delivery is deliberately its own section below
 * the earnings: collected cash is owed to the platform, and showing it beside
 * the fees would read a liability as income. See api-doc/agency/analytics.md.
 *
 * Mobile first: below `md` every group of figures is one full-bleed list of
 * rows (label left, value right, a single hairline between them) rather than a
 * grid of cards — a card per number inside the page gutter spends a third of a
 * phone's width on frames and padding. From `md` up the rows become tiles.
 */
export function Analytics() {
  const { t } = useTranslation(['analytics', 'common']);
  const [preset, setPreset] = useState<AnalyticsPreset>('thisMonth');
  const [custom, setCustom] = useState<DayRange>(() => presetRange('thisMonth')!);

  const range = preset === 'custom' ? custom : presetRange(preset)!;
  const rangeError = validateRange(range);

  const [data, setData] = useState<AgencyAnalytics | null>(null);
  const [meta, setMeta] = useState<AgencyAnalyticsMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    if (validateRange(range)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analyticsService.get(range);
      setData(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
    // `range` is rebuilt every render; its two strings are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  usePageRefresh(rangeError ? null : load, loading);

  const presetOptions = useMemo(
    () => ANALYTICS_PRESETS.map((p) => ({ value: p, label: t(`range.presets.${p}`) })),
    [t],
  );

  const onPresetChange = (next: AnalyticsPreset) => {
    // Custom starts from whatever was on screen, so switching to it changes nothing yet.
    if (next === 'custom') setCustom(range);
    setPreset(next);
  };

  const currency = meta?.currency ?? 'XAF';
  const money = (value: number) => formatCurrency(value, currency);

  const isEmpty =
    !!data &&
    data.earnings.deliveriesCredited === 0 &&
    data.deliveries.delivered + data.deliveries.returned + data.deliveries.failed === 0 &&
    data.cod.collectedByAgents === 0 &&
    data.cod.liabilityNow === 0 &&
    data.payouts.paidInPeriod === 0 &&
    data.perAgent.length === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('page.title')}
        description={t('page.description')}
        shortDescription={t('page.descriptionShort')}
      />

      {/* Range — full width on a phone, the two dates side by side under it. */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <div className="col-span-2 space-y-1.5 sm:w-56">
            <Label>{t('range.label')}</Label>
            <ResponsiveSelect
              value={preset}
              onValueChange={onPresetChange}
              options={presetOptions}
              title={t('range.label')}
            />
          </div>
          {preset === 'custom' && (
            <>
              <div className="min-w-0 space-y-1.5 sm:w-44">
                <Label htmlFor="analytics-from">{t('range.from')}</Label>
                <Input
                  id="analytics-from"
                  type="date"
                  value={custom.from}
                  max={custom.to || undefined}
                  onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                />
              </div>
              <div className="min-w-0 space-y-1.5 sm:w-44">
                <Label htmlFor="analytics-to">{t('range.to')}</Label>
                <Input
                  id="analytics-to"
                  type="date"
                  value={custom.to}
                  min={custom.from || undefined}
                  onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                />
              </div>
            </>
          )}
        </div>
        {rangeError && (
          <p className="text-sm text-destructive" role="alert">
            {t(`range.${rangeError}`)}
          </p>
        )}
      </div>

      {rangeError ? null : loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={load} />
      ) : data ? (
        <div
          className={cn('space-y-8 md:space-y-10', loading && 'opacity-60 transition-opacity')}
          aria-busy={loading}
        >
          {/* A line, not a framed empty state: the zeros below are still the answer. */}
          {isEmpty && <p className="text-sm text-muted-foreground">{t('empty')}</p>}

          <EarningsSection data={data} money={money} />
          <DeliveriesSection data={data} />
          <CodSection data={data} money={money} />
          <PerAgentSection data={data} money={money} />
          <PayoutsSection data={data} money={money} />

          {meta && (
            <p className="text-xs text-muted-foreground">
              {t('range.footer', {
                computedAt: formatDateTime(meta.computedAt),
                timezone: meta.timezone,
              })}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── Building blocks ──────────────────────────────────────────────────────────

const GROUP_COLS = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' } as const;

/**
 * A run of figures. Below `md`: one full-bleed list — the negative margins
 * mirror the page gutter (`CONTENT_FRAME` in App.tsx, same as `listSurfaceClass`)
 * so rows read edge to edge. From `md`: a grid of tiles.
 */
function StatGroup({ cols, children }: { cols: keyof typeof GROUP_COLS; children: ReactNode }) {
  return (
    <div
      className={cn(
        '-mx-4 divide-y divide-border/70 border-y border-border/70 sm:-mx-6',
        'md:mx-0 md:grid md:gap-4 md:divide-y-0 md:border-y-0',
        GROUP_COLS[cols],
      )}
    >
      {children}
    </div>
  );
}

/**
 * One figure: a row on a phone (label and hint left, value right), a tile from
 * `md`. Grid on mobile so the value can sit beside both label and hint; flex
 * column on desktop so it reads label → value → hint.
 */
function Stat({
  icon: Icon,
  label,
  value,
  hint,
  valueClassName,
}: {
  icon?: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 px-4 py-3 sm:px-6',
        'md:flex md:flex-col md:items-stretch md:gap-1.5 md:rounded-xl md:border md:border-border/70',
        'md:bg-card md:p-5 md:shadow-sm',
      )}
    >
      <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-1.5 text-sm md:text-xs md:text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />}
        <span className="leading-tight">{label}</span>
      </div>
      <p
        className={cn(
          'col-start-2 row-start-1 text-end font-semibold leading-tight tabular-nums',
          'md:text-start md:text-2xl md:break-words',
          valueClassName,
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="col-start-1 row-start-2 text-xs leading-snug text-muted-foreground md:mt-auto">{hint}</p>
      )}
    </div>
  );
}

/** A section's way onward — a plain link under its figures, so it never squeezes the heading. */
function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
      {children}
      <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
    </Link>
  );
}

type SectionProps = { data: AgencyAnalytics; money: (value: number) => string };

// ─── Earnings ────────────────────────────────────────────────────────────────

function EarningsSection({ data, money }: SectionProps) {
  const { t } = useTranslation('analytics');
  const e = data.earnings;
  // `null` means the COD fee could not be split from a delivery fee — never 0.
  const separable = (value: number | null) => (value === null ? t('earnings.notSeparable') : money(value));
  const hasNull = e.deliveryFeesEarned === null || e.codFees === null;

  return (
    <PageSection title={t('earnings.title')} description={t('earnings.description')}>
      {/* The one card on a phone: the headline figure earns its frame. */}
      <Card className={cn(compactCardClass, 'border-primary bg-primary text-primary-foreground')}>
        <CardContent className={cn(compactCardContentClass, 'flex flex-wrap items-end justify-between gap-x-4 gap-y-2')}>
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-primary-foreground/80">
              <Wallet className="h-4 w-4" />
              {t('earnings.net')}
            </div>
            <p className="text-3xl font-bold leading-none tabular-nums break-words">{money(e.netEarnings)}</p>
            <p className="text-xs text-primary-foreground/75">
              {e.reversedInPeriod > 0
                ? t('earnings.netHint', { agencyNet: money(e.agencyNet), reversed: money(e.reversedInPeriod) })
                : t('earnings.netHintNoReversal')}
            </p>
          </div>
          <p className="text-sm text-primary-foreground/80">
            {t('earnings.deliveriesCredited', { count: e.deliveriesCredited })}
          </p>
        </CardContent>
      </Card>

      <StatGroup cols={4}>
        <Stat label={t('earnings.feesEarned')} value={separable(e.deliveryFeesEarned)} hint={t('earnings.feesEarnedHint')} />
        <Stat label={t('earnings.agentShares')} value={`−${money(e.agentShares)}`} hint={t('earnings.agentSharesHint')} />
        <Stat label={t('earnings.codFees')} value={separable(e.codFees)} hint={t('earnings.codFeesHint')} />
        <Stat label={t('earnings.agencyNet')} value={money(e.agencyNet)} hint={t('earnings.agencyNetHint')} />
      </StatGroup>

      {hasNull && <p className="text-xs text-muted-foreground">{t('earnings.notSeparableHint')}</p>}

      {/* No frame on a phone — a sub-heading and three rows need none. */}
      <div className="space-y-2 md:max-w-md md:rounded-xl md:border md:border-border/70 md:bg-card md:p-5 md:shadow-sm">
        <p className="text-sm font-medium">{t('earnings.whereNow')}</p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
          {(['held', 'released', 'reversed'] as const).map((status) => (
            <div key={status} className="contents">
              <dt className="text-muted-foreground">{t(`earnings.status.${status}`)}</dt>
              <dd className="text-end font-medium tabular-nums">{money(e.byStatus[status])}</dd>
            </div>
          ))}
        </dl>
      </div>
    </PageSection>
  );
}

// ─── Deliveries ──────────────────────────────────────────────────────────────

function DeliveriesSection({ data }: { data: AgencyAnalytics }) {
  const { t } = useTranslation('analytics');
  const d = data.deliveries;
  return (
    <PageSection title={t('deliveries.title')} description={t('deliveries.description')}>
      <StatGroup cols={3}>
        <Stat icon={CheckCircle2} label={t('deliveries.delivered')} value={formatNumber(d.delivered)} />
        <Stat icon={Undo2} label={t('deliveries.returned')} value={formatNumber(d.returned)} />
        <Stat icon={PackageX} label={t('deliveries.failed')} value={formatNumber(d.failed)} />
      </StatGroup>
      {d.returned > 0 && <p className="text-xs text-muted-foreground">{t('deliveries.returnedCodNote')}</p>}
    </PageSection>
  );
}

// ─── COD cash (a liability, kept apart) ──────────────────────────────────────

function CodSection({ data, money }: SectionProps) {
  const { t } = useTranslation('analytics');
  const c = data.cod;
  return (
    <PageSection title={t('cod.title')} description={t('cod.description')}>
      <StatGroup cols={4}>
        <Stat icon={Banknote} label={t('cod.collected')} value={money(c.collectedByAgents)} />
        <Stat icon={HandCoins} label={t('cod.deposited')} value={money(c.depositsConfirmed)} />
        <Stat icon={Send} label={t('cod.remitted')} value={money(c.remittedToPlatform)} />
        <Stat
          icon={Wallet}
          label={t('cod.owedNow')}
          value={money(c.liabilityNow)}
          hint={t('cod.owedNowHint')}
          valueClassName={c.liabilityNow > 0 ? 'text-gold-700 dark:text-gold-400' : undefined}
        />
      </StatGroup>
      <SectionLink to="/dashboard/cash/summary">{t('cod.manage')}</SectionLink>
    </PageSection>
  );
}

// ─── Per agent ───────────────────────────────────────────────────────────────

function PerAgentSection({ data, money }: SectionProps) {
  const { t } = useTranslation('analytics');
  const rows = useMemo(
    () => [...data.perAgent].sort((a, b) => b.deliveriesCredited - a.deliveriesCredited || b.codCollected - a.codCollected),
    [data.perAgent],
  );

  return (
    <PageSection title={t('perAgent.title')} description={t('perAgent.description')}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('perAgent.empty')}</p>
      ) : (
        // `md:py-0`: the table's own header row is the top edge — the card's
        // padding would only open an empty band above it.
        <Card className={cn(listSurfaceClass, 'overflow-hidden md:py-0')}>
          <CardContent className="p-0">
            <RecordCardList>
              {rows.map((r) => (
                <RecordCard
                  key={r.agentId}
                  title={r.name}
                  primary={money(r.agentShare)}
                  fields={[
                    { label: t('perAgent.deliveries'), value: formatNumber(r.deliveriesCredited) },
                    { label: t('perAgent.cash'), value: money(r.codCollected) },
                  ]}
                />
              ))}
            </RecordCardList>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-4 text-start font-medium">{t('perAgent.agent')}</th>
                    <th className="p-4 text-end font-medium">{t('perAgent.deliveries')}</th>
                    <th className="p-4 text-end font-medium">{t('perAgent.share')}</th>
                    <th className="p-4 text-end font-medium">{t('perAgent.cash')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.agentId} className="border-b last:border-0">
                      <td className="p-4 font-medium">{r.name}</td>
                      <td className="p-4 text-end tabular-nums">{formatNumber(r.deliveriesCredited)}</td>
                      <td className="p-4 text-end tabular-nums">{money(r.agentShare)}</td>
                      <td className="p-4 text-end tabular-nums">{money(r.codCollected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </PageSection>
  );
}

// ─── Payouts ─────────────────────────────────────────────────────────────────

function PayoutsSection({ data, money }: SectionProps) {
  const { t } = useTranslation('analytics');
  return (
    <PageSection title={t('payouts.title')}>
      <StatGroup cols={2}>
        <Stat label={t('payouts.paidInPeriod')} value={money(data.payouts.paidInPeriod)} />
        <Stat label={t('payouts.lifetime')} value={money(data.payouts.lifetimePaidOut)} hint={t('payouts.lifetimeHint')} />
      </StatGroup>
      <SectionLink to="/dashboard/account/payout">{t('payouts.manage')}</SectionLink>
    </PageSection>
  );
}
