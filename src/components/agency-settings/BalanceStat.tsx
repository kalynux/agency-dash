import type { ElementType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { InfoHint } from '@/components/common/InfoHint';
import { formatCurrency } from '@/lib/format';

/**
 * One balance tile. Sized as a flex item so the row below can pair them up:
 * `basis` asks for half a row, while the amount's `whitespace-nowrap` sets the
 * tile's automatic minimum size. A tile whose figure needs more than half the
 * row therefore can't share one — see `BalanceRow`.
 *
 * The icon sits beside the label rather than beside the amount so the figure
 * gets the tile's full inner width; sharing a row with a 36px chip would leave
 * roughly 70px for it on a phone, and every balance would then claim a row.
 */
export function BalanceStat({
  icon: Icon,
  label,
  value,
  currency,
  hint,
}: {
  icon: ElementType;
  label: string;
  value: number;
  currency: string;
  hint: string;
}) {
  const { t } = useTranslation(['account', 'common']);
  return (
    <div className="flex grow basis-[calc(50%_-_0.5rem)] flex-col rounded-lg border p-3 sm:p-4 lg:basis-[calc(25%_-_0.75rem)]">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
          {label}
          {/* The hint is 2–3 wrapped lines in a half-width tile on a phone, which
              triples the tile's height for text the user reads once. */}
          <InfoHint
            className="md:hidden"
            label={t('earnings.balance.aboutLabel', { label: label.toLowerCase() })}
          >
            {hint}
          </InfoHint>
        </p>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-9 sm:w-9">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
      <p className="mt-2 whitespace-nowrap text-lg font-bold sm:text-2xl">{formatCurrency(value, currency)}</p>
      <p className="text-xs text-muted-foreground mt-1.5 max-md:hidden">{hint}</p>
    </div>
  );
}

/**
 * 2×2 on phones, one row of four from `lg`. A wrapping flex row rather than a
 * grid on purpose: grid tracks are fixed, so a long amount would either clip or
 * overflow its cell. Here each tile's minimum size is driven by its own
 * (non-wrapping) figure, so a balance too wide to sit beside a sibling pushes
 * itself onto its own full-width line instead.
 */
export function BalanceRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3 sm:gap-4">{children}</div>;
}
