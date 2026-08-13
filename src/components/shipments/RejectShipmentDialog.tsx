import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useShipmentActions } from '@/hooks/useShipmentActions';
import { REJECTION_REASONS, REJECTION_NOTE_MAX } from '@/components/shipments/shipment-actions';
import { cn } from '@/lib/utils';
import type { ShipmentRejectionReason } from '@/types/shipment.types';

export interface RejectShipmentDialogProps {
  shipmentId: string | null;
  /** Shown in the header for context. */
  orderNumber?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful rejection so the caller can refresh. */
  onRejected: () => void;
}

/**
 * Reason picker for declining an assigned shipment. When `other` is chosen a
 * free-text message is required (and always allowed, optionally, for the four
 * concrete reasons). See shipments.md → POST .../reject.
 */
export function RejectShipmentDialog({
  shipmentId,
  orderNumber,
  open,
  onOpenChange,
  onRejected,
}: RejectShipmentDialogProps) {
  const { t } = useTranslation(['shipments', 'common']);
  const { reject, pendingKey } = useShipmentActions();
  const [reason, setReason] = useState<ShipmentRejectionReason | ''>('');
  const [note, setNote] = useState('');

  const reset = () => {
    setReason('');
    setNote('');
  };

  const isPending = shipmentId ? pendingKey === `reject:${shipmentId}` : false;
  const noteRequired = reason === 'other';
  const trimmedNote = note.trim();
  const canSubmit = !!reason && (!noteRequired || trimmedNote.length > 0) && !isPending;

  const handleSubmit = async () => {
    if (!shipmentId || !reason) return;
    // On a status conflict the shipment moved under us — an agent picked it up,
    // or another rejection landed first. Resending the same intent is wrong, so
    // close and refresh instead of leaving a form open over a stale view.
    const result = await reject(shipmentId, reason, trimmedNote || undefined, () => {
      reset();
      onOpenChange(false);
      onRejected();
    });
    if (result) {
      reset();
      onOpenChange(false);
      onRejected();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {orderNumber ? t('reject.titleWithOrder', { orderNumber }) : t('reject.title')}
          </DialogTitle>
          <DialogDescription>{t('reject.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>
              {t('reject.reason')} <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ShipmentRejectionReason)}>
              <SelectTrigger>
                <SelectValue placeholder={t('reject.reasonPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`reject.reasons.${value}` as 'reject.reasons.other')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason && (
            <div className="space-y-2">
              <Label htmlFor="reject-note">
                {t('reject.message')}{' '}
                {noteRequired ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-muted-foreground text-xs font-normal">
                    {t('reject.messageOptional')}
                  </span>
                )}
              </Label>
              <Textarea
                id="reject-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={REJECTION_NOTE_MAX}
                rows={3}
                placeholder={
                  noteRequired
                    ? t('reject.messagePlaceholderRequired')
                    : t('reject.messagePlaceholderOptional')
                }
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{noteRequired ? t('reject.messageRequiredHint') : ''}</span>
                <span className={cn(note.length >= REJECTION_NOTE_MAX && 'text-destructive')}>
                  {note.length}/{REJECTION_NOTE_MAX}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('reject.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
