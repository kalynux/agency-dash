/**
 * One storage statement, with every line.
 *
 * ⚠ **Nothing on this screen moves money.** "Settle" records that the vendor
 * paid out of band; "Void" says the statement was issued in error. Both are
 * compare-and-set from `open`, so a statement already settled or voided answers
 * `409 STORAGE_INVOICE_NOT_OPEN` — never a 404, because it is right there, it is
 * just not in that state. Both buttons therefore disappear once the statement
 * leaves `open` rather than failing when pressed.
 *
 * There is deliberately **no un-settle**, and void is not a substitute for one:
 * voiding says the *statement* was wrong, not that the payment was.
 *
 * Every value on a line is **frozen at issue** — rate, quantity, SKU label,
 * depot name. Nothing here is re-resolved against live data, which is the whole
 * point: raising the rate must not restate a month a vendor already paid.
 *
 * See api-doc/agency/storage-invoices.md.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Ban, CheckCircle2, Info, Loader2 } from 'lucide-react';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { storageInvoicesService } from '@/services/storage-invoices.service';
import { useIsMobile } from '@/hooks/use-mobile';
import { getApiErrorMessage } from '@/lib/errors';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { canAct, type StorageInvoiceDetail } from '@/types/storage-invoice.types';

type PendingAction = 'settle' | 'void' | null;

export interface StorageStatementSheetProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function StorageStatementSheet({
  invoiceId,
  open,
  onOpenChange,
  onChanged,
}: StorageStatementSheetProps) {
  const { t } = useTranslation(['inventory', 'common']);
  const isMobile = useIsMobile();

  const [detail, setDetail] = useState<StorageInvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [action, setAction] = useState<PendingAction>(null);
  const [note, setNote] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await storageInvoicesService.getById(id);
      setDetail(data);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && invoiceId) void load(invoiceId);
    if (!open) {
      setDetail(null);
      setLoadError(null);
      setAction(null);
      setNote('');
      setActionError(null);
    }
  }, [open, invoiceId, load]);

  // Void requires a reason; settle's note is optional.
  const canConfirm = action === 'void' ? note.trim().length > 0 && !isBusy : !isBusy;

  const runAction = async () => {
    if (!detail || !action) return;
    setIsBusy(true);
    setActionError(null);
    try {
      const { data } =
        action === 'settle'
          ? await storageInvoicesService.settle(detail.id, { note: note.trim() || undefined })
          : await storageInvoicesService.void(detail.id, { reason: note.trim() });
      setDetail((prev) => (prev ? { ...prev, ...data } : prev));
      setAction(null);
      setNote('');
      onChanged();
      toast.success(
        action === 'settle' ? t('statements.settledToast') : t('statements.voidedToast'),
      );
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  };

  const body = isLoading ? (
    <>
      <SheetTitle className="sr-only">{t('statements.srTitle')}</SheetTitle>
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('common:states.loading')}
      </div>
    </>
  ) : loadError ? (
    <>
      <SheetTitle className="sr-only">{t('statements.srTitle')}</SheetTitle>
      <div className="p-8 text-center">
        <p className="mb-4 text-muted-foreground">{loadError}</p>
        <Button variant="outline" onClick={() => invoiceId && load(invoiceId)}>
          {t('common:actions.retry')}
        </Button>
      </div>
    </>
  ) : detail ? (
    <>
      <div className="flex-shrink-0 px-5 pb-2 pe-12 pt-2">
        <SheetTitle className="text-base">
          {t('statements.detailTitle', { period: detail.periodKey })}
        </SheetTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('statements.issued', { date: formatDate(detail.issuedAt) })}
          {detail.settledAt && ` · ${t('statements.settledOn', { date: formatDate(detail.settledAt) })}`}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5">
        <div className="flex items-baseline justify-between rounded-lg border bg-muted/40 p-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {t('statements.total')}
          </span>
          <span className="font-mono text-lg font-semibold">{formatCurrency(detail.total)}</span>
        </div>

        {/* Restated inside the detail, because this is the screen where somebody
            is about to press Settle. */}
        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <p>{t('statements.recordNotice')}</p>
        </div>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('statements.lines')}
          </h3>
          {/* Frozen at issue — see the header. `quantity` is what was on the
              shelf when the statement was cut, not a monthly average: the
              platform keeps no daily snapshot of a shelf, and this is a claim a
              vendor will check. */}
          <p className="mb-2 text-xs text-muted-foreground">{t('statements.linesFrozen')}</p>
          <ul className="divide-y rounded-lg border">
            {detail.lines.map((line) => (
              <li key={line.stockLevelId} className="flex items-start gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {line.productTitle ?? (
                      <span className="italic text-muted-foreground">
                        {t('statements.unnamedProduct')}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {line.sku ?? '—'}
                    {line.locationLabel && ` · ${line.locationLabel}`}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('statements.lineBasis', {
                      quantity: formatNumber(line.quantity),
                      rate: formatCurrency(line.monthlyRatePerSku),
                    })}
                  </p>
                </div>
                <span className="flex-shrink-0 font-mono text-sm">
                  {formatCurrency(line.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {detail.note && (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {detail.status === 'void' ? t('statements.voidReason') : t('statements.settleNote')}
            </h3>
            <p className="rounded-lg bg-muted/50 p-3 text-sm">{detail.note}</p>
          </section>
        )}
      </div>

      {/* Absent, not disabled, once the statement leaves `open` — a compare-and-set
          verb that can only 409 is not a control. */}
      {canAct(detail) && (
        <div className="flex flex-shrink-0 gap-2 border-t p-4">
          <Button variant="outline" className="flex-1 gap-1.5" onClick={() => setAction('void')}>
            <Ban className="h-3.5 w-3.5" />
            {t('statements.voidAction')}
          </Button>
          <Button className="flex-1 gap-1.5" onClick={() => setAction('settle')}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('statements.settleAction')}
          </Button>
        </div>
      )}

      <Dialog open={action !== null} onOpenChange={(next) => !isBusy && !next && setAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {action === 'settle' ? t('statements.settleTitle') : t('statements.voidTitle')}
            </DialogTitle>
            <DialogDescription>
              {action === 'settle' ? t('statements.settleBody') : t('statements.voidBody')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="statement-note">
              {action === 'settle' ? t('statements.settleNoteLabel') : t('statements.voidReasonLabel')}
            </Label>
            {action === 'settle' ? (
              <Input
                id="statement-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('statements.settleNotePlaceholder')}
                autoFocus
              />
            ) : (
              <Textarea
                id="statement-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('statements.voidReasonPlaceholder')}
                autoFocus
              />
            )}
            {action === 'void' && (
              // Voiding does not free the month for re-issue: the identity
              // (agency, vendor, month) is still held by the voided row.
              <p className="text-xs text-muted-foreground">{t('statements.voidNoReissue')}</p>
            )}
          </div>

          {actionError && <p className="text-sm text-destructive">{actionError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={isBusy}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              onClick={runAction}
              disabled={!canConfirm}
              variant={action === 'void' ? 'destructive' : 'default'}
              className="gap-1.5"
            >
              {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {action === 'settle' ? t('statements.settleConfirm') : t('statements.voidConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
