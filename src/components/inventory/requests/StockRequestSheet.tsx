/**
 * One stock request in full: the three quantities, the trail, and the verbs the
 * server says we may use.
 *
 * Always refetches on open rather than trusting the list row it was clicked from.
 * `currentQuantity` is resolved live by the detail endpoint, and it is exactly the
 * figure an approver must not read stale — the list can be a minute old.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  DriftNotice,
  QuantityChange,
  StockRequestStatusBadge,
} from '@/components/inventory/requests/StockRequestCard';
import { StockRequestActions } from '@/components/inventory/requests/StockRequestActions';
import { stockRequestsService } from '@/services/stock-requests.service';
import { useIsMobile } from '@/hooks/use-mobile';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { StockRequest } from '@/types/stock-request.types';

export function StockRequestSheet({
  requestId,
  open,
  onOpenChange,
  onResolved,
}: {
  requestId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: () => void;
}) {
  const { t } = useTranslation(['inventory', 'common']);
  const isMobile = useIsMobile();
  const [request, setRequest] = useState<StockRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await stockRequestsService.getById(id);
      setRequest(data);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && requestId) load(requestId);
    if (!open) {
      setRequest(null);
      setLoadError(null);
    }
  }, [open, requestId, load]);

  /** Re-read after an action: the outcome sub-document only exists server-side. */
  const handleResolved = () => {
    if (requestId) load(requestId);
    onResolved();
  };

  const body = isLoading ? (
    <>
      <SheetTitle className="sr-only">{t('requests.srTitle')}</SheetTitle>
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('requests.loading')}
      </div>
    </>
  ) : loadError ? (
    <>
      <SheetTitle className="sr-only">{t('requests.srTitle')}</SheetTitle>
      <div className="py-16 text-center">
        <p className="mb-4 text-sm text-muted-foreground">{loadError}</p>
        <Button variant="outline" onClick={() => requestId && load(requestId)}>
          {t('common:actions.retry')}
        </Button>
      </div>
    </>
  ) : request ? (
    <>
      <div className="flex-shrink-0 px-5 pb-3 pr-12 pt-3">
        <SheetTitle className="text-base leading-tight">{t('requests.sheetTitle')}</SheetTitle>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StockRequestStatusBadge status={request.status} />
          <span className="text-xs text-muted-foreground">
            {request.requestedByRole === 'agency'
              ? t('requests.raisedByYou')
              : t('requests.raisedByVendor')}
          </span>
        </div>
      </div>

      <Separator className="flex-shrink-0" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-5 px-5 py-4">
          {/* The proposal itself. */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('requests.proposal')}
            </h3>
            <div className="rounded-lg border p-3">
              <p className="text-lg">
                <QuantityChange from={request.quantityBefore} to={request.requestedQuantity} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t('requests.absoluteHint')}</p>
              <DriftNotice request={request} />
            </div>
          </section>

          {/* All three figures spelled out, because "before" and "now" being
              different is the whole reason there are three. */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('requests.quantities')}
            </h3>
            <dl className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
              <QuantityRow
                label={t('requests.quantityBefore')}
                hint={t('requests.quantityBeforeHint')}
                value={request.quantityBefore}
              />
              <QuantityRow
                label={t('requests.currentQuantity')}
                hint={t('requests.currentQuantityHint')}
                value={request.currentQuantity}
              />
              <QuantityRow
                label={t('requests.requestedQuantity')}
                hint={t('requests.requestedQuantityHint')}
                value={request.requestedQuantity}
                emphasis
              />
            </dl>
          </section>

          {request.note && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('requests.noteHeading')}
              </h3>
              <p className="rounded-lg bg-muted/50 p-3 text-sm italic">{request.note}</p>
            </section>
          )}

          <Outcome request={request} />

          {request.statusHistory?.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('requests.trail')}
              </h3>
              <ol className="space-y-2">
                {request.statusHistory.map((event, i) => (
                  <li key={`${event.status}-${event.changedAt}-${i}`} className="flex gap-2 text-xs">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground" />
                    <span className="min-w-0">
                      <span className="font-medium">
                        {t(`requests.statuses.${event.status}`)}
                      </span>{' '}
                      <span className="text-muted-foreground">
                        {t('requests.trailBy', {
                          role: t(`requests.roles.${event.changedByRole}`),
                          when: formatDateTime(event.changedAt),
                        })}
                      </span>
                      {event.note && (
                        <span className="mt-0.5 block italic text-muted-foreground">
                          {event.note}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>

      {/* The bottom sheet ends at the bottom of the screen, so on a phone with a
          home indicator the footer's own padding is all that keeps the approve
          button clear of it. Same floor as `SearchFilterBar`'s footer. */}
      {(request.availableActions?.length ?? 0) > 0 && (
        <div className="flex-shrink-0 border-t bg-background px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <StockRequestActions request={request} onResolved={handleResolved} />
        </div>
      )}
    </>
  ) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        aria-describedby={undefined}
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0',
          isMobile ? 'h-[90vh] rounded-t-2xl' : 'w-full sm:max-w-md',
        )}
      >
        {isMobile && (
          <div className="mx-auto mb-1 mt-2 h-1 w-10 flex-shrink-0 rounded-full bg-muted" />
        )}
        {body}
      </SheetContent>
    </Sheet>
  );
}

function QuantityRow({
  label,
  hint,
  value,
  emphasis,
}: {
  label: string;
  hint: string;
  value: number | null;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <dt className={cn('text-sm', emphasis && 'font-medium')}>{label}</dt>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <dd
        className={cn(
          'flex-shrink-0 font-numeric tabular-nums',
          emphasis ? 'text-base font-bold' : 'text-sm',
        )}
      >
        {value == null ? '—' : formatNumber(value)}
      </dd>
    </div>
  );
}

/**
 * How it ended. Exactly one of the three sub-documents is non-null once resolved,
 * and `approval.quantityAtApply` is the audit trail for drift — what the SKU
 * actually held the instant it was replaced.
 */
function Outcome({ request }: { request: StockRequest }) {
  const { t } = useTranslation('inventory');
  const { approval, rejection, withdrawal } = request;
  if (!approval && !rejection && !withdrawal) return null;

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('requests.outcome')}
      </h3>
      <div className="rounded-lg border p-3 text-sm">
        {approval && (
          <>
            <p className="font-medium">
              {t('requests.approvedBy', {
                role: t(`requests.roles.${approval.byRole}`),
                when: formatDateTime(approval.at),
              })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('requests.quantityAtApply', {
                quantity: formatNumber(approval.quantityAtApply),
              })}
            </p>
          </>
        )}
        {rejection && (
          <>
            <p className="font-medium">
              {t('requests.rejectedBy', {
                role: t(`requests.roles.${rejection.byRole}`),
                when: formatDateTime(rejection.at),
              })}
            </p>
            {rejection.reason && <p className="mt-1 text-xs italic">{rejection.reason}</p>}
          </>
        )}
        {withdrawal && (
          <p className="font-medium">
            {t('requests.withdrawnBy', {
              role: t(`requests.roles.${withdrawal.byRole}`),
              when: formatDateTime(withdrawal.at),
            })}
          </p>
        )}
      </div>
    </section>
  );
}
