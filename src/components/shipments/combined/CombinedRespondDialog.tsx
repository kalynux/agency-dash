import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveModal } from '@/components/common/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { combinedDeliveryRequestsService } from '@/services/combined-delivery-requests.service';
import { getApiErrorMessage, getErrorCode, getErrorMessageForCode } from '@/lib/errors';
import { formatCurrency } from '@/lib/format';
import {
  COMBINED_NOTE_MAX,
  type CombinedDeliveryRequest,
  type CombinedDeliveryRespondResult,
} from '@/types/combined-delivery-request.types';
import { parcelLabel } from './parcelLabel';
import type { ParcelSummary } from './useParcelSummaries';

/** Answers that mean the request moved on under us — close and reload, never resend. */
const STALE_CODES = new Set(['COMBINED_DELIVERY_REQUEST_NOT_OPEN', 'COMBINED_DELIVERY_REQUEST_NOT_FOUND']);

export interface CombinedRespondDialogProps {
  request: CombinedDeliveryRequest | null;
  summaries: Record<string, ParcelSummary | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After an answer, or a refusal that means the list is stale. */
  onChanged: () => void;
}

/**
 * Lower the fees on some or all of a request's parcels. A field left empty keeps
 * that parcel's fee. The checks here only spare a round trip — the server judges
 * every fee against the parcel's fee *now* and says which one it refused.
 *
 * Nothing is totalled: the saving the customer gets is the server's figure, and
 * it is shown on the request once answered.
 */
export function CombinedRespondDialog({ request, summaries, open, onOpenChange, onChanged }: CombinedRespondDialogProps) {
  const { t } = useTranslation(['shipments', 'common']);
  const [fees, setFees] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFees({});
    setNote('');
    setErrors({});
    setFormError(null);
  }, [open, request?.id]);

  if (!request) return null;
  const currency = request.currency;

  /** The fee a new one must beat: the parcel's fee now when we know it, else the fee when asked. */
  const ceilingFor = (shipmentId: string, feeAtRequest: number) => summaries[shipmentId]?.currentFee ?? feeAtRequest;

  const validate = (): Array<{ shipmentId: string; proposedFee: number }> | null => {
    const nextErrors: Record<string, string> = {};
    const out: Array<{ shipmentId: string; proposedFee: number }> = [];
    for (const parcel of request.shipments) {
      const raw = (fees[parcel.shipmentId] ?? '').trim();
      if (!raw) continue;
      const value = Number(raw);
      const ceiling = ceilingFor(parcel.shipmentId, parcel.feeAtRequest);
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        nextErrors[parcel.shipmentId] = t('combined.respond.integer');
      } else if (value < 0) {
        nextErrors[parcel.shipmentId] = t('combined.respond.min');
      } else if (value >= ceiling) {
        nextErrors[parcel.shipmentId] = t('combined.respond.mustBeLower', { amount: formatCurrency(ceiling, currency) });
      } else {
        out.push({ shipmentId: parcel.shipmentId, proposedFee: value });
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;
    if (out.length === 0) {
      setFormError(t('combined.respond.atLeastOne'));
      return null;
    }
    setFormError(null);
    return out;
  };

  /** Some fees landed and some didn't (a parcel picked up meanwhile) — say which, never skip silently. */
  const reportPartial = (result: CombinedDeliveryRespondResult, sent: number) => {
    const indexOf = (id: string) => request.shipments.findIndex((s) => s.shipmentId === id);
    const rows = result.failed.map((f) =>
      t('combined.respond.failedRow', {
        parcel: parcelLabel(t, summaries[f.shipmentId] ?? null, indexOf(f.shipmentId)),
        reason: getErrorMessageForCode(f.code),
      }),
    );
    toast.warning(
      t('combined.respond.partial', { applied: result.request.answer?.fees.length ?? 0, total: sent }),
      { description: rows.join('\n'), duration: 12000 },
    );
  };

  const submit = async () => {
    const payloadFees = validate();
    if (!payloadFees) return;
    setSubmitting(true);
    try {
      const { data } = await combinedDeliveryRequestsService.respond(request.id, {
        fees: payloadFees,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      if (data.failed.length > 0) reportPartial(data, payloadFees.length);
      else toast.success(t('combined.respond.success'));
      onOpenChange(false);
      onChanged();
    } catch (err) {
      const message = getApiErrorMessage(err);
      const code = getErrorCode(err);
      if (code && STALE_CODES.has(code)) {
        toast.error(message);
        onOpenChange(false);
        onChanged();
      } else {
        setFormError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formId = `combined-respond-${request.id}`;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('combined.respond.title')}
      description={t('combined.respond.description')}
      desktopClassName="sm:max-w-lg"
      mobileClassName="h-auto max-h-[92dvh]"
      disableClose={submitting}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="max-md:w-full"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={formId} className="max-md:w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('combined.respond.submit')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <ul className="space-y-3">
          {request.shipments.map((parcel, index) => {
            const summary = summaries[parcel.shipmentId] ?? null;
            const inputId = `${formId}-${parcel.shipmentId}`;
            const error = errors[parcel.shipmentId];
            return (
              <li key={parcel.shipmentId} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_9rem] sm:items-end">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{parcelLabel(t, summary, index)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('combined.feeWhenAsked')}:{' '}
                    <span className="font-numeric">{formatCurrency(parcel.feeAtRequest, currency)}</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={inputId} className="text-xs">
                    {t('combined.respond.newFee', { currency })}
                  </Label>
                  <Input
                    id={inputId}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    placeholder={t('combined.respond.keepPlaceholder')}
                    value={fees[parcel.shipmentId] ?? ''}
                    onChange={(e) => setFees((prev) => ({ ...prev, [parcel.shipmentId]: e.target.value }))}
                    aria-invalid={!!error}
                  />
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-note`}>{t('combined.respond.note')}</Label>
          <Textarea
            id={`${formId}-note`}
            rows={2}
            maxLength={COMBINED_NOTE_MAX}
            placeholder={t('combined.respond.notePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
      </form>
    </ResponsiveModal>
  );
}
