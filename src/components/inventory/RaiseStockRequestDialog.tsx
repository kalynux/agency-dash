/**
 * Propose a new recorded quantity for a SKU we warehouse.
 *
 * THE NUMBER IS ABSOLUTE, NEVER A DELTA. A "-10" approved three days later applies
 * to a figure nobody agreed on; an absolute target states exactly what the shelf
 * will read whenever the vendor gets to it. `0` is a legitimate value — a
 * warehouse can be emptied.
 *
 * Nothing is written when this succeeds. It creates a proposal the vendor has to
 * approve; the stock moves in the transaction that records their approval.
 *
 * See api-doc/agency/stock-requests.md §1.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { stockRequestsService } from '@/services/stock-requests.service';
import { getApiErrorMessage } from '@/lib/errors';
import { ApiError } from '@/types/api';
import { formatNumber } from '@/lib/format';
import type { InventoryDetail } from '@/types/inventory.types';
import type { StockRequestAlreadyPendingDetails } from '@/types/stock-request.types';

const NOTE_MAX = 500;

export function RaiseStockRequestDialog({
  detail,
  open,
  onOpenChange,
  onRaised,
}: {
  detail: InventoryDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRaised: () => void;
}) {
  const { t } = useTranslation(['inventory', 'common']);
  const current = detail.catalogStock.quantity;
  const [quantity, setQuantity] = useState<string>(current == null ? '' : String(current));
  const [note, setNote] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set on 409: there is already an open request, and it is linkable. */
  const [conflict, setConflict] = useState<StockRequestAlreadyPendingDetails | null>(null);

  const parsed = Number(quantity);
  const isValid = quantity.trim() !== '' && Number.isInteger(parsed) && parsed >= 0;
  // The API refuses a no-op with `422 STOCK_REQUEST_NO_CHANGE`; catching it here
  // keeps a pointless round trip and a red error out of an ordinary typo.
  const isNoChange = isValid && current != null && parsed === current;

  const submit = async () => {
    if (!isValid || isNoChange) return;
    setIsBusy(true);
    setError(null);
    setConflict(null);
    try {
      await stockRequestsService.create({
        productId: detail.productId,
        variantId: detail.variantId,
        quantity: parsed,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onOpenChange(false);
      setNote('');
      onRaised();
      toast.success(t('requests.raisedToast'));
    } catch (err) {
      // One open request per SKU. `details.hint` says whether to withdraw ours or
      // answer theirs, and `requestId` is what to link them to — so this is a
      // signpost, not a dead end.
      if (err instanceof ApiError && err.code === 'STOCK_REQUEST_ALREADY_PENDING') {
        setConflict(err.details as StockRequestAlreadyPendingDetails);
      }
      setError(getApiErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('requests.raiseTitle')}</DialogTitle>
          <DialogDescription>{t('requests.raiseBody')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <span className="text-muted-foreground">{t('requests.currentlyRecorded')}</span>{' '}
            <span className="font-numeric font-semibold">
              {current == null ? '—' : formatNumber(current)}
            </span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="request-quantity" className="text-sm font-medium">
              {t('requests.quantityLabel')}
            </label>
            <Input
              id="request-quantity"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('requests.quantityHint')}</p>
            {isNoChange && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t('requests.noChangeHint')}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="request-note" className="text-sm font-medium">
              {t('requests.noteLabel')}
            </label>
            <Textarea
              id="request-note"
              value={note}
              rows={3}
              maxLength={NOTE_MAX}
              placeholder={t('requests.notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('requests.noteHint')}</p>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-sm text-destructive">
              <p>{conflict?.hint ?? error}</p>
              {conflict?.requestId && (
                <Link
                  to={`/dashboard/inventory/requests?open=${conflict.requestId}`}
                  className="mt-1 inline-block text-xs font-medium underline"
                  onClick={() => onOpenChange(false)}
                >
                  {t('requests.viewOpenRequest')}
                </Link>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={submit} disabled={isBusy || !isValid || isNoChange} className="gap-1.5">
            {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('requests.confirmRaise')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
