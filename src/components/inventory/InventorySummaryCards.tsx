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
import { Ban, Boxes, MapPinOff, Wallet, Warehouse } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warning';
  onClick?: () => void;
}) {
  return (
    <Card className={cn(compactCardClass, onClick && 'cursor-pointer transition-colors hover:bg-muted/50')}>
      <CardContent
        className={cn(
          compactCardContentClass,
          // A step tighter than the shared compact box: five of these sit in one
          // row above the table they summarise, and each is only a label, a
          // figure and a hint — the default p-4/p-5 spends more height on air
          // than on any of the three.
          'p-3 sm:p-4',
          'flex items-start justify-between gap-3',
        )}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      >
        <div className="min-w-0">
          {/* Label and figure are one unit — the gap that matters is the one
              before the hint, which is a separate thought. */}
          <p className="text-sm leading-snug text-muted-foreground">{label}</p>
          <p
            className={cn(
              'mt-0.5 font-numeric text-2xl font-bold leading-tight',
              tone === 'warning' && 'text-amber-600 dark:text-amber-400',
            )}
          >
            {value}
          </p>
          {hint && <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
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

export function InventorySummaryCards({
  summary,
  depotCount,
  storageOffered,
  onShowUnassigned,
}: {
  /** Null while the first load is in flight, or if the summary call failed. */
  summary: InventorySummary | null;
  depotCount: number;
  /**
   * Whether we warehouse at all (`storageFee.storageBasedEnabled` from any row).
   * When false the monthly-estimate tile is hidden rather than showing `0`, which
   * would read as "free storage" instead of "not offered".
   */
  storageOffered: boolean;
  onShowUnassigned: () => void;
}) {
  const { t } = useTranslation('inventory');
  const unassigned = summary?.unassignedCount ?? 0;
  const suspended = summary?.suspendedCount ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard
        icon={Boxes}
        label={t('summary.skus')}
        value={formatNumber(summary?.skuCount ?? 0)}
        hint={t('summary.skusHint')}
      />
      <StatCard
        icon={Warehouse}
        label={t('summary.depots')}
        value={formatNumber(depotCount)}
        hint={t('summary.depotsHint')}
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
      />
      {storageOffered && (
        <StatCard
          icon={Wallet}
          label={t('summary.monthlyEstimate')}
          value={formatCurrency(summary?.totalMonthlyEstimate ?? 0)}
          // "What you should be charging", never "due" or "owed" — the platform
          // does not track, invoice or chase any of it.
          hint={t('summary.monthlyEstimateHint')}
        />
      )}
    </div>
  );
}
