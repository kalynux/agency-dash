/**
 * The agency's one lever over a product it warehouses: take it off the storefront,
 * put it back.
 *
 * NOTHING HERE IS AUTOMATIC. The platform does not track storage payment and never
 * suspends on anyone's behalf. If rent goes unpaid that is settled between the
 * agency and the vendor; this is the button.
 *
 * THREE RULES, and each is a 422 if the UI guesses instead — all three are in
 * `canSuspend` / `canUnsuspend`, never re-derived here:
 *
 *  1. Only an `active` product can be suspended.
 *  2. Only OUR OWN suspension can be lifted. `suspension: null` with
 *     `productStatus: "suspended"` is a delivery-agency cascade — show it as
 *     suspended, hide the button.
 *  3. Unsuspending re-runs the activation gate, so it can legitimately fail. The
 *     blocker list that comes back is written to be shown.
 *
 * See api-doc/agency/inventory.md §5.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Ban, Loader2, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { inventoryService } from '@/services/inventory.service';
import { getApiErrorMessage } from '@/lib/errors';
import { ApiError } from '@/types/api';
import { formatDateTime } from '@/lib/format';
import { canSuspend, canUnsuspend, isSuspended } from '@/types/inventory.types';
import type { InventoryDetail, UnsuspendBlocker } from '@/types/inventory.types';

/** `note` is capped server-side; enforcing it here keeps the failure out of the network. */
const NOTE_MAX = 500;

export function SuspensionPanel({
  detail,
  onChanged,
}: {
  detail: InventoryDetail;
  onChanged: () => void;
}) {
  const { t } = useTranslation(['inventory', 'common']);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [note, setNote] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<UnsuspendBlocker[] | null>(null);

  const suspended = isSuspended(detail);
  const showSuspend = canSuspend(detail);
  const showUnsuspend = suspended && canUnsuspend(detail);

  const runSuspend = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await inventoryService.suspendProduct(detail.productId, note.trim() ? { note: note.trim() } : {});
      setSuspendOpen(false);
      setNote('');
      onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  };

  const runUnsuspend = async () => {
    setIsBusy(true);
    setError(null);
    setBlockers(null);
    try {
      await inventoryService.unsuspendProduct(detail.productId);
      onChanged();
    } catch (err) {
      // The gate refused. `details.blockers` is a checklist, not a single cause —
      // each `message` is written by the backend to be shown, and it is what tells
      // the agency what to raise with the vendor. The product stays suspended.
      if (err instanceof ApiError && err.code === 'INVENTORY_PRODUCT_UNSUSPEND_BLOCKED') {
        const details = err.details as { blockers?: UnsuspendBlocker[] } | undefined;
        setBlockers(details?.blockers ?? []);
      }
      setError(getApiErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  };

  // Nothing to say: the product is on sale and we could suspend it, but that
  // affordance lives in the footer rather than as a section of its own.
  if (!suspended && !showSuspend) return null;

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('suspension.title')}
      </h3>

      {suspended ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
            <Ban className="h-3.5 w-3.5 flex-shrink-0" />
            {t('suspension.suspended')}
          </p>

          {detail.suspension ? (
            <>
              <p className="mt-1 text-xs text-amber-700/90 dark:text-amber-400/90">
                {t('suspension.byYou', { when: formatDateTime(detail.suspension.suspendedAt) })}
              </p>
              {detail.suspension.note && (
                <p className="mt-1.5 rounded border border-amber-200/70 bg-white/50 p-2 text-xs italic text-amber-900 dark:border-amber-900/70 dark:bg-black/20 dark:text-amber-200">
                  {detail.suspension.note}
                </p>
              )}
            </>
          ) : (
            // Suspended by the platform, not by us — our unsuspend would 422, so
            // the button is absent rather than present-and-failing.
            <p className="mt-1 text-xs text-amber-700/90 dark:text-amber-400/90">
              {t('suspension.bySystem')}
            </p>
          )}

          {showUnsuspend && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3 gap-1.5"
              onClick={runUnsuspend}
              disabled={isBusy}
            >
              {isBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlayCircle className="h-3.5 w-3.5" />
              )}
              {t('suspension.unsuspend')}
            </Button>
          )}

          {blockers && <BlockerList blockers={blockers} />}
          {error && !blockers && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="rounded-lg border p-3">
          <p className="text-sm">{t('suspension.onSale')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('suspension.suspendHint')}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 gap-1.5"
            onClick={() => setSuspendOpen(true)}
          >
            <Ban className="h-3.5 w-3.5" />
            {t('suspension.suspend')}
          </Button>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>
      )}

      <Dialog open={suspendOpen} onOpenChange={(next) => !isBusy && setSuspendOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('suspension.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('suspension.dialogBody')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label htmlFor="suspend-note" className="text-sm font-medium">
              {t('suspension.noteLabel')}
            </label>
            <Textarea
              id="suspend-note"
              value={note}
              maxLength={NOTE_MAX}
              rows={3}
              placeholder={t('suspension.notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
            />
            {/* Optional in the API, but it is the ONLY explanation the vendor
                gets — so the hint pushes for one rather than shrugging. */}
            <p className="text-xs text-muted-foreground">
              {t('suspension.noteHint', { max: NOTE_MAX })}
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)} disabled={isBusy}>
              {t('common:actions.cancel')}
            </Button>
            <Button variant="destructive" onClick={runSuspend} disabled={isBusy} className="gap-1.5">
              {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('suspension.confirmSuspend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/**
 * Why the product cannot go back on sale.
 *
 * Rendered verbatim: every `message` is backend copy written for this list, and
 * paraphrasing it would lose the specific thing the agency has to go and ask the
 * vendor for.
 */
function BlockerList({ blockers }: { blockers: UnsuspendBlocker[] }) {
  const { t } = useTranslation('inventory');
  return (
    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
        {t('suspension.blockedTitle')}
      </p>
      {blockers.length > 0 ? (
        <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs text-destructive/90">
          {blockers.map((blocker, i) => (
            <li key={blocker.code || i}>{blocker.message}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-destructive/90">{t('suspension.blockedUnknown')}</p>
      )}
    </div>
  );
}
