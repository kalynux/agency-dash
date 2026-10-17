/**
 * Payer fee proposals (ADR-A12, 2026-10-14 —
 * api-doc/agency/FRONTEND-CHANGELOG-payer-fee-proposals.md): the words around a
 * blocked pickup must say WHO is being waited on, and "accepted, waiting for the
 * customer's payment" must not read as "waiting for your answer".
 */
import { describe, it, expect } from 'vitest';
import {
  awaitingTopup,
  blockingProposal,
  isPayerProposal,
  payerAcceptedAwaitingPayment,
  pickupBlockedCopy,
} from './delivery-fee-rules';
import type { DeliveryFeeProposal } from '@/types/delivery-fee-proposal.types';

function proposal(over: Partial<DeliveryFeeProposal> = {}): DeliveryFeeProposal {
  return {
    id: 'p1',
    shipmentId: 's1',
    orderId: 'o1',
    agencyId: 'a1',
    proposedBy: { role: 'agency', userId: 'u1', agentId: null },
    approver: 'vendor',
    origin: 'agency',
    currency: 'XAF',
    feeBefore: 1500,
    proposedFee: 2500,
    reason: 'Two sacks',
    status: 'pending',
    respondedBy: null,
    rejectionNote: null,
    withdrawalReason: null,
    version: 1,
    availableActions: ['withdraw', 'edit'],
    createdAt: '2026-10-14T09:00:00.000Z',
    updatedAt: '2026-10-14T09:00:00.000Z',
    ...over,
  };
}

const payer = (role: 'vendor' | 'customer', over: Partial<DeliveryFeeProposal> = {}) =>
  proposal({
    proposedBy: { role, userId: 'u2', agentId: null },
    approver: 'agency',
    origin: 'payer',
    availableActions: ['approve', 'reject'],
    ...over,
  });

const accepted = payer('customer', {
  payerAcceptance: { role: 'agency', agentId: null, version: 1, at: '2026-10-14T10:00:00.000Z' },
  customerApproval: { approvedAt: '2026-10-14T10:00:00.000Z', version: 1 },
  topup: { amount: 1000, status: 'awaiting_payment', paidAt: null },
  availableActions: ['reject'],
});

describe('isPayerProposal', () => {
  it('reads origin, not who proposed', () => {
    expect(isPayerProposal(payer('vendor'))).toBe(true);
    expect(isPayerProposal(proposal())).toBe(false);
    // A vendor role without the payer origin is not a payer proposal.
    expect(isPayerProposal(proposal({ proposedBy: { role: 'vendor', userId: null, agentId: null } }))).toBe(false);
  });
});

describe('awaitingTopup', () => {
  it('covers both the customer accepting yours and you accepting theirs', () => {
    expect(awaitingTopup(accepted)).toBe(true);
    expect(
      awaitingTopup(
        proposal({
          approver: 'customer',
          customerApproval: { approvedAt: '2026-10-14T10:00:00.000Z', version: 1 },
          topup: { amount: 1000, status: 'awaiting_payment', paidAt: null },
        }),
      ),
    ).toBe(true);
  });

  it('is false once paid, or before anyone accepted', () => {
    expect(awaitingTopup({ ...accepted, topup: { amount: 1000, status: 'paid', paidAt: 'x' } })).toBe(false);
    expect(awaitingTopup({ ...accepted, status: 'approved' })).toBe(false);
    expect(awaitingTopup(payer('customer', { topup: { amount: 1000, status: 'awaiting_payment', paidAt: null } }))).toBe(false);
  });

  it('only flags the payer variant as "you accepted"', () => {
    expect(payerAcceptedAwaitingPayment(accepted)).toBe(true);
    expect(payerAcceptedAwaitingPayment(payer('customer'))).toBe(false);
  });
});

describe('blockingProposal', () => {
  it('prefers the shipment pointer, else the newest pending', () => {
    const list = [proposal({ id: 'a', status: 'rejected' }), proposal({ id: 'b' }), proposal({ id: 'c' })];
    expect(blockingProposal(list, 'c')?.id).toBe('c');
    expect(blockingProposal(list, null)?.id).toBe('b');
    expect(blockingProposal(list, 'gone')?.id).toBe('b');
    expect(blockingProposal(undefined, 'c')).toBeUndefined();
  });
});

describe('pickupBlockedCopy', () => {
  it('waits on you for a payer proposal, naming the payer', () => {
    expect(pickupBlockedCopy(payer('vendor')).key).toBe('payerVendor');
    expect(pickupBlockedCopy(payer('customer')).key).toBe('payerCustomer');
  });

  it('says "waiting for the customer to pay" once you accepted', () => {
    expect(pickupBlockedCopy(accepted)).toEqual({ key: 'payerTopup', amount: 1000, currency: 'XAF' });
  });

  it('keeps the wording for your own proposals', () => {
    expect(pickupBlockedCopy(proposal()).key).toBe('vendor');
    expect(pickupBlockedCopy(proposal({ approver: undefined })).key).toBe('vendor');
    expect(pickupBlockedCopy(proposal({ approver: 'customer' })).key).toBe('customer');
    expect(pickupBlockedCopy(undefined).key).toBe('generic');
  });
});
