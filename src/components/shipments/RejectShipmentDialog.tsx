import { useState } from 'react';
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
    const result = await reject(shipmentId, reason, trimmedNote || undefined);
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
          <DialogTitle>Reject shipment{orderNumber ? ` · ${orderNumber}` : ''}</DialogTitle>
          <DialogDescription>
            Decline this assignment before pickup. The vendor is notified with your reason so they can
            reroute it to another agency.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>
              Reason <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ShipmentRejectionReason)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason…" />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason && (
            <div className="space-y-2">
              <Label htmlFor="reject-note">
                Message{' '}
                {noteRequired ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-muted-foreground text-xs font-normal">(optional)</span>
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
                    ? 'Explain why you’re rejecting this shipment…'
                    : 'Add any details for the vendor…'
                }
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{noteRequired ? 'Required when the reason is “Other”.' : ''}</span>
                <span className={cn(note.length >= REJECTION_NOTE_MAX && 'text-destructive')}>
                  {note.length}/{REJECTION_NOTE_MAX}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reject shipment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
