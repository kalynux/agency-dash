/**
 * The buttons on a stock request.
 *
 * RENDERED FROM `availableActions`, NEVER FROM `status`. The server sends its
 * verdict for us on every row — `['withdraw']` when we raised it,
 * `['approve','reject']` when the vendor did, `[]` once resolved — and rendering
 * from anything else is how a client offers a verb the API refuses with
 * `403 STOCK_REQUEST_NOT_YOURS`.
 *
 * `STOCK_REQUEST_NOT_PENDING` MEANS RELOAD, NOT RETRY. It is a compare-and-set
 * miss: the row exists and the other party resolved it a moment ago. Re-sending
 * would apply an intent formed against a state that no longer holds, so the
 * handler below refetches and shows the outcome instead of offering another go.
 *
 * See api-doc/agency/stock-requests.md §4.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Loader2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { stockRequestsService } from '@/services/stock-requests.service';
import { getApiErrorMessage } from '@/lib/errors';
import { ApiError } from '@/types/api';
import { can } from '@/types/stock-request.types';
import type { StockRequest } from '@/types/stock-request.types';

const REASON_MAX = 500;

/**
 * These are the decision buttons, in a sheet footer, on a phone — so they take a
 * full touch target and split the row rather than sitting at `size="sm"`'s 32px
 * in one corner of it.
 */
const ACTION_BUTTON = 'h-11 min-w-[7rem] flex-1 gap-1.5 sm:h-10 sm:flex-none';

export function StockRequestActions({
  request,
  onResolved,
  className,
}: {
  request: StockRequest;
  /**
   * The request changed. Callers refetch rather than patch local state — after a
   * `STOCK_REQUEST_NOT_PENDING` the local copy is precisely what is wrong.
   */
  onResolved: () => void;
  className?: string;
}) {
  const { t } = useTranslation(['inventory', 'common']);
  const [busy, setBusy] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [staleNotice, setStaleNotice] = useState(false);

  const run = async (fn: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    setError(null);
    setStaleNotice(false);
    try {
      await fn();
      toast.success(successMessage);
      onResolved();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STOCK_REQUEST_NOT_PENDING') {
        // Somebody got there first. Reload and let them read the outcome — a
        // retry button here would re-resolve a request that is already resolved.
        setStaleNotice(true);
        onResolved();
      }
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const actions = request.availableActions ?? [];
  if (actions.length === 0 && !error) return null;

  return (
    <div className={className}>
      {reasonOpen && (
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={REASON_MAX}
          className="mb-2"
          placeholder={t('requests.reasonPlaceholder')}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {can(request, 'approve') && (
          <Button
            className={ACTION_BUTTON}
            disabled={busy}
            onClick={() =>
              run(() => stockRequestsService.approve(request.id), t('requests.approvedToast'))
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t('requests.approve')}
          </Button>
        )}

        {can(request, 'reject') &&
          // The reason is optional but it is what the vendor reads, so the first
          // click opens the box and the second sends — rather than firing a
          // reasonless rejection on a single click.
          (reasonOpen ? (
            <Button
              variant="outline"
              className={ACTION_BUTTON}
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    stockRequestsService.reject(
                      request.id,
                      reason.trim() ? { reason: reason.trim() } : {},
                    ),
                  t('requests.rejectedToast'),
                )
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              {t('requests.confirmReject')}
            </Button>
          ) : (
            <Button
              variant="outline"
              className={ACTION_BUTTON}
              disabled={busy}
              onClick={() => setReasonOpen(true)}
            >
              <X className="h-4 w-4" />
              {t('requests.reject')}
            </Button>
          ))}

        {can(request, 'withdraw') && (
          <Button
            variant="outline"
            className={ACTION_BUTTON}
            disabled={busy}
            onClick={() =>
              run(() => stockRequestsService.withdraw(request.id), t('requests.withdrawnToast'))
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            {t('requests.withdraw')}
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-destructive">
          {staleNotice ? t('requests.staleNotice') : error}
        </p>
      )}
    </div>
  );
}
