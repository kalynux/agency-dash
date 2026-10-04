/**
 * The inventory screen header.
 *
 * SERVER-TOTALLED, over the whole FILTERED set rather than the visible page.
 * These used to be computed client-side from `meta.total` plus a second
 * `list({locationId:'unassigned', limit:1})` call, which could only ever count what
 * the current page's filter happened to include — and could not express
 * "suspended products" or "what all this is worth per month" at all.
 *
 * See api-doc/agency/inventory.md §2.
 */

import { useTranslation } from 'react-i18next';
import { Ban, Boxes, ClipboardList, MapPinOff, ScanLine, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { InfoHint } from '@/components/common/InfoHint';
import { compactCardClass, compactCardContentClass } from '@/components/layout/PageContainer';
import { formatCurrency, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { InventorySummary } from '@/types/inventory.types';

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  onClick,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warning';
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        compactCardClass,
        // Below `md` the tiles are cells of one panel (see the grid below):
        // no frame of their own, so four figures read as one overview rather
        // than four boxes competing for the eye.
        'max-md:rounded-none max-md:border-0 max-md:shadow-none',
        onClick && 'cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted/60',
        className,
      )}
    >
      <CardContent
        className={cn(
          compactCardContentClass,
          // A step tighter than the shared compact box: five of these sit in one
          // row above the table they summarise, and each is only a label, a
          // figure and a hint — the default p-4/p-5 spends more height on air
          // than on any of the three.
          'p-3 sm:p-4',
          'flex h-full items-start justify-between gap-3',
        )}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      >
        <div className="min-w-0">
          {/* Label and figure are one unit — the gap that matters is the one
              before the hint, which is a separate thought. On a phone the hint
              moves behind the ⓘ: a sentence under each of four figures is what
              made this block taller than the list it summarises. */}
          <p className="flex items-center gap-1 text-xs leading-snug text-muted-foreground md:text-sm">
            <span className="truncate">{label}</span>
            {hint && (
              <InfoHint className="md:hidden" title={label}>
                {hint}
              </InfoHint>
            )}
          </p>
          <p
            className={cn(
              'mt-0.5 font-numeric text-xl font-bold leading-tight md:text-2xl',
              tone === 'warning' && 'text-amber-600 dark:text-amber-400',
            )}
          >
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-xs leading-snug text-muted-foreground max-md:hidden">{hint}</p>
          )}
        </div>
        <div
          className={cn(
            // The icon is decoration a half-width phone cell can't afford.
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg max-md:hidden',
            tone === 'warning' ? 'bg-amber-500/15' : 'bg-primary/10',
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4',
              tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-primary',
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Every tile is either a fact about the stock or a to-do with its count — "not
 * counted yet", "waiting for your answer", "location deleted" — and both to-do
 * counts come straight off the summary (`uncountedRows`,
 * `awaitingMyDecisionCount`) rather than being subtracted or re-counted here.
 */
export function InventorySummaryCards({
  summary,
  storageOffered,
  onShowUnassigned,
  onShowAwaiting,
}: {
  /** Null while the first load is in flight, or if the summary call failed. */
  summary: InventorySummary | null;
  /**
   * Whether we warehouse at all (`storageFee.storageBasedEnabled` from any row).
   * When false the monthly-estimate tile is hidden rather than showing `0`, which
   * would read as "free storage" instead of "not offered".
   */
  storageOffered: boolean;
  onShowUnassigned: () => void;
  /** Opens the stock-request inbox. */
  onShowAwaiting: () => void;
}) {
  const { t } = useTranslation('inventory');
  const unassigned = summary?.unassignedCount ?? 0;
  const suspended = summary?.suspendedCount ?? 0;
  const uncounted = summary?.uncountedRows ?? 0;
  const awaiting = summary?.awaitingMyDecisionCount ?? 0;

  return (
    // Phone: ONE panel split into cells by 1px hairlines (the `gap-px` over a
    // border-coloured ground), the rent figure spanning the full width beneath.
    // From `md` up: the separate tiles the desktop has always had, three a row.
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border md:gap-3 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent lg:grid-cols-3">
      <StatCard
        icon={Boxes}
        label={t('summary.skus')}
        value={formatNumber(summary?.skuCount ?? 0)}
        hint={t('summary.skusHint')}
      />
      <StatCard
        icon={ScanLine}
        tone={uncounted > 0 ? 'warning' : 'default'}
        label={t('summary.uncounted')}
        value={formatNumber(uncounted)}
        hint={t('summary.uncountedHint')}
      />
      <StatCard
        icon={ClipboardList}
        tone={awaiting > 0 ? 'warning' : 'default'}
        label={t('summary.awaiting')}
        value={formatNumber(awaiting)}
        hint={t('summary.awaitingHint')}
        onClick={awaiting > 0 ? onShowAwaiting : undefined}
      />
      <StatCard
        icon={MapPinOff}
        tone={unassigned > 0 ? 'warning' : 'default'}
        label={t('summary.unassigned')}
        value={formatNumber(unassigned)}
        hint={t('summary.unassignedHint')}
        onClick={unassigned > 0 ? onShowUnassigned : undefined}
      />
      <StatCard
        icon={Ban}
        tone={suspended > 0 ? 'warning' : 'default'}
        label={t('summary.suspended')}
        // Products, not rows — a product with three variants is one suspension.
        value={formatNumber(suspended)}
        hint={t('summary.suspendedHint')}
        // Without the rent tile this is the fifth, alone on a two-column row.
        className={storageOffered ? undefined : 'max-lg:col-span-2'}
      />
      {storageOffered && (
        <StatCard
          icon={Wallet}
          label={t('summary.monthlyEstimate')}
          value={formatCurrency(summary?.totalMonthlyEstimate ?? 0)}
          // The statement's basis (counted stock × rate), but live — never "due"
          // or "owed": the monthly statement, not this tile, is the record.
          hint={t('summary.monthlyEstimateHint')}
        />
      )}
    </div>
  );
}
