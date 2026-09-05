/**
 * One shelf's ledger — every movement, newest first.
 *
 * WHY IT IS WORTH A PANEL. Two numbers on this screen are allowed to disagree:
 * the vendor's catalogue quantity and what is physically on the shelf. The
 * disagreement is information rather than an error — the vendor sells the same
 * SKU through other channels, a delivery arrived and was never booked in, a box
 * is missing. This is the only surface that says *which*.
 *
 * OUR ROWS AND THEIRS. `actorRole: 'agency'` rows are the four verbs an operator
 * drives; `'system'` rows are the order path, which we never write — a checkout
 * holding units, releasing them, a sale, a delivered parcel coming back. Both
 * belong here: a shelf that dropped by six because six were sold reads very
 * differently from one that dropped by six because somebody counted.
 *
 * `onHandAfter` is the balance THAT movement produced, so the column reads as a
 * running account rather than a list of deltas that have to be added up by eye.
 *
 * See api-doc/agency/inventory.md §7.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardCheck,
  Loader2,
  PackageMinus,
  PackagePlus,
  RotateCcw,
  ShoppingCart,
  Undo2,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { inventoryService } from '@/services/inventory.service';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime, formatNumber } from '@/lib/format';
import { tx } from '@/i18n/tx';
import { cn } from '@/lib/utils';
import type { StockMovement, StockMovementType } from '@/types/inventory.types';

const PAGE_LIMIT = 20;

/**
 * An icon per movement type, so the shape of a shelf's history is legible before
 * any of it is read. Exhaustive by construction — a new backend type cannot ship
 * without a decision here.
 */
const MOVEMENT_ICON: Record<StockMovementType, LucideIcon> = {
  receipt: PackagePlus,
  return_to_vendor: PackageMinus,
  count_adjustment: ClipboardCheck,
  transfer_out: ArrowUpRight,
  transfer_in: ArrowDownLeft,
  reservation: ShoppingCart,
  reservation_released: Undo2,
  sale: ShoppingCart,
  customer_return: RotateCcw,
};

export function MovementLedger({ stockLevelId }: { stockLevelId: string }) {
  const { t } = useTranslation(['inventory', 'common']);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Opened on demand: most visits to a row are not about its history. */
  const [opened, setOpened] = useState(false);

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await inventoryService.movements(stockLevelId, {
          page: nextPage,
          limit: PAGE_LIMIT,
        });
        setMovements((prev) => (append ? [...prev, ...res.data] : res.data));
        setPage(res.meta.page);
        setTotalPages(res.meta.totalPages);
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [stockLevelId],
  );

  // Reset when the sheet is pointed at a different shelf — a ledger belongs to
  // one row and showing another row's history would be worse than showing none.
  useEffect(() => {
    setOpened(false);
    setMovements([]);
    setPage(1);
    setTotalPages(1);
    setError(null);
  }, [stockLevelId]);

  const open = () => {
    setOpened(true);
    void load(1, false);
  };

  if (!opened) {
    return (
      <section>
        <Button variant="outline" size="sm" className="w-full" onClick={open}>
          {t('movements.ledger.show')}
        </Button>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('movements.ledger.title')}
      </h3>

      {error && (
        <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <p>{error}</p>
          <button type="button" onClick={() => load(page, false)} className="font-medium underline">
            {t('common:actions.retry')}
          </button>
        </div>
      )}

      {!error && movements.length === 0 && !isLoading && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t('movements.ledger.empty')}
        </p>
      )}

      <ul className="space-y-1.5">
        {movements.map((movement) => {
          const Icon = MOVEMENT_ICON[movement.type];
          const delta = movement.onHandDelta;
          return (
            <li
              key={movement.id}
              className="flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-sm"
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">
                    {tx(t, `inventory:movements.types.${movement.type}`)}
                  </span>
                  <span
                    className={cn(
                      'flex-shrink-0 font-mono text-xs',
                      // A delta of exactly 0 is a real and useful record — "we
                      // checked, and it was right" — so it is neither green nor
                      // red, just stated.
                      delta > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : delta < 0
                          ? 'text-destructive'
                          : 'text-muted-foreground',
                    )}
                  >
                    {delta > 0 ? `+${formatNumber(delta)}` : formatNumber(delta)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>
                    {t('movements.ledger.balance', { onHand: formatNumber(movement.onHandAfter) })}
                  </span>
                  <span>·</span>
                  <span>{formatDateTime(movement.createdAt)}</span>
                  {movement.actorRole === 'system' && (
                    <>
                      <span>·</span>
                      <span>{t('movements.ledger.automatic')}</span>
                    </>
                  )}
                </div>
                {movement.reason && (
                  <p className="mt-0.5 text-xs italic text-muted-foreground">{movement.reason}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('common:states.loading')}
        </div>
      )}

      {!isLoading && page < totalPages && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full"
          onClick={() => load(page + 1, true)}
        >
          {t('movements.ledger.loadMore')}
        </Button>
      )}
    </section>
  );
}
