import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, Check, Loader2 } from 'lucide-react';
import { ResponsiveModal } from '@/components/common/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useShipmentActions } from '@/hooks/useShipmentActions';
import { formatCurrency } from '@/lib/format';
import { useFeeProposals } from '@/store/feeProposals.store';
import {
  DELIVERY_FEE_PROPOSAL_STATUSES,
  PAYER_FEE_DECLINE_NOTE_MAX,
  type DeliveryFeeProposal,
} from '@/types/delivery-fee-proposal.types';

export interface PayerFeeAnswerProps {
  shipmentId: string;
  proposal: DeliveryFeeProposal;
  /** After an answer, and after a refusal that means the view is out of date. */
  onChanged: () => void;
}

/**
 * Accept / Decline on a fee the payer proposed (ADR-A12). Which of the two show
 * is `availableActions` and nothing else — not `proposedBy.role`, not our own
 * reading of the status. Once you accepted a higher fee that waits for the
 * customer's online payment the server offers only `reject`, which is how you
 * stop waiting. Renders nothing when neither verb is offered.
 */
export function PayerFeeAnswer({ shipmentId, proposal, onChanged }: PayerFeeAnswerProps) {
  const { t } = useTranslation(['shipments', 'common']);
  const { approveDeliveryFee, rejectDeliveryFee, pendingKey } = useShipmentActions();
  const { refetch: refetchBadge } = useFeeProposals();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [note, setNote] = useState('');

  // An unknown status is read-only, whatever `availableActions` says.
  const known = (DELIVERY_FEE_PROPOSAL_STATUSES as readonly string[]).includes(proposal.status);
  const canApprove = known && proposal.availableActions.includes('approve');
  const canReject = known && proposal.availableActions.includes('reject');
  if (!canApprove && !canReject) return null;

  const busy = pendingKey === `fee-answer:${proposal.id}`;
  const changed = () => {
    onChanged();
    void refetchBadge();
  };

  const approve = async () => {
    const result = await approveDeliveryFee(shipmentId, proposal, changed);
    if (result) changed();
  };

  const reject = async () => {
    const trimmed = note.trim();
    const result = await rejectDeliveryFee(shipmentId, proposal, trimmed || undefined, changed);
    setDeclineOpen(false);
    if (result) changed();
  };

  const fees = {
    before: formatCurrency(proposal.feeBefore, proposal.currency),
    after: formatCurrency(proposal.proposedFee, proposal.currency),
  };

  return (
    <>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {canReject && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={busy}
            onClick={() => {
              setNote('');
              setDeclineOpen(true);
            }}
          >
            <Ban className="h-3.5 w-3.5" />
            {t('deliveryFee.payer.decline')}
          </Button>
        )}
        {canApprove && (
          <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => void approve()}>
            {busy && !declineOpen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {t('deliveryFee.payer.accept', { amount: fees.after })}
          </Button>
        )}
      </div>

      <ResponsiveModal
        open={declineOpen}
        onOpenChange={(o) => !busy && setDeclineOpen(o)}
        title={t('deliveryFee.payer.declineTitle')}
        description={
          proposal.payerAcceptance
            ? t('deliveryFee.payer.declineAfterAcceptDescription', fees)
            : t('deliveryFee.payer.declineDescription', fees)
        }
        desktopClassName="sm:max-w-md"
        mobileClassName="h-auto max-h-[92dvh]"
        disableClose={busy}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="max-md:w-full"
              onClick={() => setDeclineOpen(false)}
              disabled={busy}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="max-md:w-full"
              onClick={() => void reject()}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('deliveryFee.payer.declineSubmit')}
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor={`payer-fee-decline-${proposal.id}`}>{t('deliveryFee.payer.declineNote')}</Label>
          <Textarea
            id={`payer-fee-decline-${proposal.id}`}
            rows={2}
            maxLength={PAYER_FEE_DECLINE_NOTE_MAX}
            placeholder={t('deliveryFee.payer.declineNotePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="text-end text-xs text-muted-foreground">
            {note.length}/{PAYER_FEE_DECLINE_NOTE_MAX}
          </p>
        </div>
      </ResponsiveModal>
    </>
  );
}
