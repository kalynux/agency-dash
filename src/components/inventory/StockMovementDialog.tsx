/**
 * Record what actually happened on a shelf.
 *
 * FOUR VERBS, ONE DIALOG, because they differ in exactly two places — the number
 * being asked for, and whether the reason is required. Splitting them into four
 * components would duplicate the busy/error/close handling four times to express
 * that.
 *
 * ─── The one that is not like the others ──────────────────────────────────────
 *
 * `count` asks for the **absolute figure on the shelf**, not a correction. That
 * is not a UI preference: the platform computes the delta against whatever the
 * record says at that instant, *inside the same transaction that applies it*, so
 * a sale landing mid-count cannot turn a correction into a second error. Asking
 * for a delta here would hand that race back to the person holding the clipboard.
 *
 * It is also the only verb whose `reason` is required, and for a reason worth
 * repeating in the UI: it is the only one that moves stock with no physical event
 * behind it, so it is the only record that will ever explain the difference
 * between "we miscounted" and "a box is missing".
 *
 * ─── The transfer caveat ──────────────────────────────────────────────────────
 *
 * A transfer moves GOODS, not the arrangement. The product still names the depot
 * its vendor chose, so the next reconcile re-derives the original row. The dialog
 * says so, because an agency that expects the SKU to now *live* at the other
 * depot has to follow up with a depot move — in that order, since re-pointing
 * refuses while counted units sit on the old shelf.
 *
 * See api-doc/agency/inventory.md §6.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { inventoryService } from '@/services/inventory.service';
import { useMagazin } from '@/store/magazin.store';
import { getApiErrorMessage } from '@/lib/errors';
import { buildDepotOptions } from '@/components/inventory/depot-options';
import { tx } from '@/i18n/tx';
import type { InventoryDetail } from '@/types/inventory.types';

/** Which verb the dialog is running. `null` closes it. */
export type StockMovementKind = 'receipt' | 'return' | 'count' | 'transfer';

/** Mirrors `DepotMoveDialog` — a radio group cannot hold `null`. */
const FOLLOW_PRIMARY = '__primary__';

export interface StockMovementDialogProps {
  detail: InventoryDetail;
  kind: StockMovementKind | null;
  onClose: () => void;
  /** Refetch the row (and the list behind it) — every verb changes its balances. */
  onRecorded: () => void;
}

export function StockMovementDialog({
  detail,
  kind,
  onClose,
  onRecorded,
}: StockMovementDialogProps) {
  const { t } = useTranslation(['inventory', 'common']);
  const { data: magazin } = useMagazin();

  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [toLocation, setToLocation] = useState<string>(FOLLOW_PRIMARY);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh fields every time the dialog opens, and on a switch between verbs —
  // carrying "12" over from a receipt into a count would be a number nobody
  // typed for the question now being asked.
  useEffect(() => {
    setQuantity('');
    setReason('');
    setToLocation(FOLLOW_PRIMARY);
    setError(null);
  }, [kind]);

  if (!kind) return null;

  const isCount = kind === 'count';
  const isTransfer = kind === 'transfer';

  // A count of 0 is legitimate ("the shelf is empty, and I looked"); a receipt,
  // return or transfer of 0 is not an event.
  const parsed = Number(quantity);
  const quantityValid =
    quantity.trim() !== '' &&
    Number.isInteger(parsed) &&
    (isCount ? parsed >= 0 : parsed > 0);
  const reasonValid = !isCount || reason.trim().length > 0;
  const canSubmit = quantityValid && reasonValid && !isBusy;

  // The transfer destination must actually differ from where the stock is, or
  // the API answers `422 INVENTORY_TRANSFER_SAME_LOCATION`. Cheaper to say here.
  const depotOptions = buildDepotOptions(magazin?.headquartersAddresses ?? [], {
    primary: t('filters.primaryLocation'),
    branch: (number) => t('filters.branch', { number }),
  });

  const submit = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const trimmedReason = reason.trim() || undefined;
      const result = isCount
        ? await inventoryService.countStock(detail.id, {
            // The ABSOLUTE figure. See the header — never a delta.
            countedQuantity: parsed,
            reason: reason.trim(),
          })
        : isTransfer
          ? await inventoryService.transferStock(detail.id, {
              toLocationId: toLocation === FOLLOW_PRIMARY ? null : toLocation,
              quantity: parsed,
              reason: trimmedReason,
            })
          : kind === 'receipt'
            ? await inventoryService.receiveStock(detail.id, {
                quantity: parsed,
                reason: trimmedReason,
              })
            : await inventoryService.returnStock(detail.id, {
                quantity: parsed,
                reason: trimmedReason,
              });

      onClose();
      onRecorded();
      toast.success(
        t('movements.recordedToast', {
          onHand: result.data.quantityOnHand,
        }),
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !isBusy && !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tx(t, `inventory:movements.${kind}.title`)}</DialogTitle>
          <DialogDescription>{tx(t, `inventory:movements.${kind}.body`)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Where the shelf stands right now — the number the person is about to
              correct or add to. Shown for every verb, because "12 on hand" is
              what makes "I counted 10" a considered entry rather than a guess. */}
          <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            {detail.source === 'derived'
              ? t('movements.currentUncounted')
              : t('movements.current', {
                  onHand: detail.quantityOnHand,
                  reserved: detail.quantityReserved,
                })}
          </p>

          {isTransfer && (
            <div className="space-y-2">
              <Label>{t('movements.transfer.destination')}</Label>
              <RadioGroup value={toLocation} onValueChange={setToLocation} className="gap-2">
                <label
                  htmlFor="transfer-primary"
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-sm transition-colors hover:bg-muted/50"
                >
                  <RadioGroupItem value={FOLLOW_PRIMARY} id="transfer-primary" />
                  {t('depot.followPrimaryShort')}
                </label>
                {depotOptions
                  // Offering the depot the stock is already on would only earn a
                  // 422 — the API refuses a same-location transfer.
                  .filter((option) => option.value !== detail.location?.id)
                  .map((option) => (
                    <label
                      key={option.value}
                      htmlFor={`transfer-${option.value}`}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-sm transition-colors hover:bg-muted/50"
                    >
                      <RadioGroupItem value={option.value} id={`transfer-${option.value}`} />
                      <span className="min-w-0 truncate">{option.label}</span>
                    </label>
                  ))}
              </RadioGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="stock-quantity">
              {isCount ? t('movements.count.field') : t('movements.quantityField')}
            </Label>
            <Input
              id="stock-quantity"
              type="number"
              inputMode="numeric"
              min={isCount ? 0 : 1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              autoFocus
            />
            {isCount && (
              <p className="text-xs text-muted-foreground">{t('movements.count.fieldHint')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock-reason">
              {isCount ? t('movements.reasonRequired') : t('movements.reasonOptional')}
            </Label>
            <Textarea
              id="stock-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tx(t, `inventory:movements.${kind}.reasonPlaceholder`)}
            />
            {isCount && (
              <p className="text-xs text-muted-foreground">{t('movements.count.reasonHint')}</p>
            )}
          </div>

          {/* The first receipt is a state change, not just a number: it is what
              makes the platform start claiming — and billing — this shelf. */}
          {kind === 'receipt' && detail.source === 'derived' && (
            <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <p>{t('movements.receipt.firstReceiptNotice')}</p>
            </div>
          )}

          {isTransfer && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <p>{t('movements.transfer.arrangementNotice')}</p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isBusy}>
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={submit} disabled={!canSubmit} className="gap-1.5">
            {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {tx(t, `inventory:movements.${kind}.confirm`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
