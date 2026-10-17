/**
 * Reading a shipment's delivery-fee proposals — the parts more than one screen
 * needs (the fee section, the detail sheet's pickup button, the payer inbox).
 *
 * None of this decides a BUTTON: buttons come from `availableActions` alone.
 * These only pick the words, from fields the server sets.
 * See api-doc/agency/shipments.md § Delivery-fee proposals and § Answering a fee
 * the PAYER proposed.
 */
import type { DeliveryFeeProposal } from '@/types/delivery-fee-proposal.types';

/** The vendor or the customer proposed it and you answer (ADR-A12). */
export function isPayerProposal(p: DeliveryFeeProposal): boolean {
  return p.origin === 'payer';
}

/**
 * Accepted, but the fee only applies — and pickup only unblocks — once the
 * customer pays the difference online. Either the customer accepted YOUR
 * increase (`customerApproval`) or you accepted THEIR higher figure
 * (`payerAcceptance`); the proposal stays `pending` meanwhile.
 */
export function awaitingTopup(p: DeliveryFeeProposal): boolean {
  return (
    p.status === 'pending' &&
    p.topup?.status === 'awaiting_payment' &&
    (!!p.customerApproval || !!p.payerAcceptance)
  );
}

/** You (or your agent) accepted a payer's figure and the customer still has to pay it. */
export function payerAcceptedAwaitingPayment(p: DeliveryFeeProposal): boolean {
  return isPayerProposal(p) && !!p.payerAcceptance && awaitingTopup(p);
}

/**
 * The proposal holding pickup: the one the shipment points at, else the first
 * pending one (the list is newest first). `undefined` when none is loaded.
 */
export function blockingProposal(
  proposals: DeliveryFeeProposal[] | undefined,
  pendingId?: string | null,
): DeliveryFeeProposal | undefined {
  const list = proposals ?? [];
  return (pendingId ? list.find((p) => p.id === pendingId) : undefined) ?? list.find((p) => p.status === 'pending');
}

export type PickupBlockedCopy =
  | { key: 'generic' | 'vendor' | 'customer' | 'topup' | 'payerVendor' | 'payerCustomer' }
  | { key: 'payerTopup'; amount: number; currency: string };

/**
 * Why `→ picked_up` is refused while a fee is pending, as specifically as the
 * loaded proposals allow. A payer's proposal waits on YOU; your own waits on
 * whoever pays. `proposedBy.role` only names the payer in the sentence.
 */
export function pickupBlockedCopy(p: DeliveryFeeProposal | undefined): PickupBlockedCopy {
  if (!p) return { key: 'generic' };
  if (isPayerProposal(p)) {
    if (payerAcceptedAwaitingPayment(p) && p.topup) {
      return { key: 'payerTopup', amount: p.topup.amount, currency: p.currency };
    }
    return { key: p.proposedBy.role === 'customer' ? 'payerCustomer' : 'payerVendor' };
  }
  if (awaitingTopup(p)) return { key: 'topup' };
  return { key: (p.approver ?? 'vendor') === 'customer' ? 'customer' : 'vendor' };
}
