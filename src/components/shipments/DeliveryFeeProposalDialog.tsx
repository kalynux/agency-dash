import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useShipmentActions } from '@/hooks/useShipmentActions';
import { formatCurrency } from '@/lib/format';
import type { AnyTFunction } from '@/i18n/tx';
import type { DeliveryFeeProposal } from '@/types/delivery-fee-proposal.types';

const REASON_MIN = 3;
const REASON_MAX = 500;

/**
 * A factory, not a module constant: a schema built at import time would freeze
 * its messages in whatever language was active at boot.
 *
 * `currentFee` is the fee the shipment carries now — the server refuses an equal
 * one (`DELIVERY_FEE_PROPOSAL_NO_CHANGE`), so say it before sending. `null` when
 * we can't tell; the server still checks.
 */
function buildSchema(t: AnyTFunction, currentFee: number | null) {
  return z.object({
    proposedFee: z
      .number({ message: t('shipments:deliveryFee.validation.number') })
      .int(t('shipments:deliveryFee.validation.integer'))
      .min(0, t('shipments:deliveryFee.validation.min'))
      .refine((v) => currentFee === null || v !== currentFee, t('shipments:deliveryFee.validation.sameAsCurrent')),
    reason: z
      .string()
      .trim()
      .min(REASON_MIN, t('shipments:deliveryFee.validation.reasonMin', { min: REASON_MIN }))
      .max(REASON_MAX, t('shipments:deliveryFee.validation.reasonMax', { max: REASON_MAX })),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export interface DeliveryFeeProposalDialogProps {
  shipmentId: string;
  /** The fee the shipment carries now, or `null` when unknown. */
  currentFee: number | null;
  currency: string;
  /** Present → edit this pending proposal; absent → a new one. */
  proposal?: DeliveryFeeProposal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After a save, or after a refusal that means the view is stale. */
  onChanged: () => void;
}

/**
 * Propose a different delivery fee for one shipment, or edit a pending
 * proposal (yours or your agent's — editing an agent's makes it yours). The
 * vendor must approve every change; pickup is blocked until they answer.
 * See api-doc/agency/shipments.md § Delivery-fee proposals.
 */
export function DeliveryFeeProposalDialog({
  shipmentId,
  currentFee,
  currency,
  proposal,
  open,
  onOpenChange,
  onChanged,
}: DeliveryFeeProposalDialogProps) {
  const { t } = useTranslation(['shipments', 'common']);
  const { proposeDeliveryFee, editDeliveryFee, pendingKey } = useShipmentActions();
  const isEdit = !!proposal;
  const schema = useMemo(() => buildSchema(t, currentFee), [t, currentFee]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { proposedFee: undefined as unknown as number, reason: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      proposal
        ? { proposedFee: proposal.proposedFee, reason: proposal.reason }
        : { proposedFee: undefined as unknown as number, reason: '' },
    );
  }, [open, proposal, reset]);

  const isPending = pendingKey === `fee:${shipmentId}`;

  const close = () => onOpenChange(false);
  const stale = () => {
    close();
    onChanged();
  };

  const onSubmit = async (values: FormValues) => {
    let result;
    if (proposal) {
      // Send only what changed, plus the version we rendered, so a concurrent
      // edit answers 409 instead of being silently overwritten.
      const changes = {
        ...(values.proposedFee !== proposal.proposedFee ? { proposedFee: values.proposedFee } : {}),
        ...(values.reason !== proposal.reason ? { reason: values.reason } : {}),
      };
      if (Object.keys(changes).length === 0) return close();
      result = await editDeliveryFee(
        shipmentId,
        proposal.id,
        { ...changes, ...(typeof proposal.version === 'number' ? { version: proposal.version } : {}) },
        stale,
      );
    } else {
      result = await proposeDeliveryFee(shipmentId, values, stale);
    }
    if (result) {
      close();
      onChanged();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? t('deliveryFee.editTitle') : t('deliveryFee.proposeTitle')}</DialogTitle>
            <DialogDescription>{t('deliveryFee.dialogDescription')}</DialogDescription>
          </DialogHeader>

          {currentFee !== null && (
            <p className="text-sm text-muted-foreground">
              {t('deliveryFee.currentFee', { amount: formatCurrency(currentFee, currency) })}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fee-proposed">{t('deliveryFee.proposedFee', { currency })}</Label>
            <Input
              id="fee-proposed"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              {...register('proposedFee', { valueAsNumber: true })}
              aria-invalid={!!errors.proposedFee}
            />
            {errors.proposedFee && <p className="text-xs text-destructive">{errors.proposedFee.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fee-reason">{t('deliveryFee.reason')}</Label>
            <Textarea
              id="fee-reason"
              rows={3}
              maxLength={REASON_MAX}
              placeholder={t('deliveryFee.reasonPlaceholder')}
              {...register('reason')}
              aria-invalid={!!errors.reason}
            />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={isPending}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={isPending || (isEdit && !isDirty)}>
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isEdit ? (
                t('deliveryFee.saveEdit')
              ) : (
                t('deliveryFee.send')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
