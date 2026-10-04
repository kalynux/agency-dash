import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveModal } from '@/components/common/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { combinedDeliveryRequestsService } from '@/services/combined-delivery-requests.service';
import { getApiErrorMessage } from '@/lib/errors';
import { COMBINED_NOTE_MAX, type CombinedDeliveryRequest } from '@/types/combined-delivery-request.types';

export interface CombinedDeclineDialogProps {
  request: CombinedDeliveryRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

/** Decline a combined-price request: the fees stay as they are and the customer is told. */
export function CombinedDeclineDialog({ request, open, onOpenChange, onChanged }: CombinedDeclineDialogProps) {
  const { t } = useTranslation(['shipments', 'common']);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setNote('');
  }, [open, request?.id]);

  if (!request) return null;

  const submit = async () => {
    setSubmitting(true);
    try {
      await combinedDeliveryRequestsService.respond(request.id, {
        decline: true,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast.success(t('combined.declineDialog.success'));
    } catch (err) {
      // Every refusal here (already answered, cancelled, gone) means the list is
      // out of date, so the answer is the same: say why, then reload.
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
      onOpenChange(false);
      onChanged();
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('combined.declineDialog.title')}
      description={t('combined.declineDialog.description')}
      desktopClassName="sm:max-w-md"
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
          <Button
            type="button"
            variant="destructive"
            className="max-md:w-full"
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('combined.declineDialog.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor={`combined-decline-${request.id}`}>{t('combined.declineDialog.note')}</Label>
        <Textarea
          id={`combined-decline-${request.id}`}
          rows={2}
          maxLength={COMBINED_NOTE_MAX}
          placeholder={t('combined.declineDialog.notePlaceholder')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </ResponsiveModal>
  );
}
