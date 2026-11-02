import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { prepaidAmountOf, type ShipmentNextAction } from '@/components/shipments/shipment-actions';
import { formatCurrency } from '@/lib/format';
import { tx } from '@/i18n/tx';
import type { ShipmentCodInfo } from '@/types/shipment.types';

export interface FailureReasonReminderDialogProps {
  /** The `failed` / `returned` action waiting to run; `null` keeps the dialog closed. */
  action: ShipmentNextAction | null;
  cod: ShipmentCodInfo | null | undefined;
  onCancel: () => void;
  onConfirm: (action: ShipmentNextAction) => void;
}

/**
 * The pause before marking a parcel partly paid online as failed or returned.
 * The failure reason proposes who pays, and marking it here records none, so
 * this says to let the agent report it. Shared by the row menu and the detail
 * sheet so the wording cannot drift between them.
 */
export function FailureReasonReminderDialog({
  action,
  cod,
  onCancel,
  onConfirm,
}: FailureReasonReminderDialogProps) {
  const { t } = useTranslation(['shipments', 'common']);
  // Held past `action` going null so the wording doesn't change during the close animation.
  const [shown, setShown] = useState(action);
  if (action && action !== shown) setShown(action);

  return (
    <AlertDialog open={action !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {shown?.status === 'returned'
              ? t('actions.failureReminder.titleReturned')
              : t('actions.failureReminder.titleFailed')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                {cod &&
                  t('actions.failureReminder.whyItMatters', {
                    amount: formatCurrency(prepaidAmountOf(cod), cod.currency),
                  })}
              </p>
              <p>{t('actions.failureReminder.howToReport')}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => action && onConfirm(action)}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {shown && tx(t, shown.labelKey)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
