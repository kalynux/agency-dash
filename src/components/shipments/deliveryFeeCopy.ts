import type { AnyTFunction } from '@/i18n/tx';
import { formatCurrency } from '@/lib/format';
import type { PickupBlockedCopy } from './delivery-fee-rules';

/** The sentence for {@link PickupBlockedCopy} — one wording for every place the block is explained. */
export function pickupBlockedText(t: AnyTFunction, copy: PickupBlockedCopy): string {
  switch (copy.key) {
    case 'vendor':
      return t('shipments:deliveryFee.pickupBlockedVendor');
    case 'customer':
      return t('shipments:deliveryFee.pickupBlockedCustomer');
    case 'topup':
      return t('shipments:deliveryFee.pickupBlockedTopup');
    case 'payerVendor':
      return t('shipments:deliveryFee.payer.pickupBlockedVendor');
    case 'payerCustomer':
      return t('shipments:deliveryFee.payer.pickupBlockedCustomer');
    case 'payerTopup':
      return t('shipments:deliveryFee.payer.awaitingPayment', {
        amount: formatCurrency(copy.amount, copy.currency),
      });
    default:
      return t('shipments:deliveryFee.pickupBlocked');
  }
}
