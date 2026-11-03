import { describe, expect, it } from 'vitest';
import { hasPartnerHistory, linkEarns, withdrawBlock, type ReferralPartner } from './referral.types';

const partner = (over: Partial<ReferralPartner> = {}, balances: Partial<ReferralPartner['balances']> = {}): ReferralPartner => ({
  program: { enabled: true, minPayoutAmount: 500, rewardWaitDays: 7 },
  status: 'active',
  statusReason: null,
  canApply: false,
  code: 'ABCD123',
  codeActive: true,
  links: { registerUrl: 'https://x/register?ref=ABCD123', whatsappUrl: null, telegramUrl: null },
  appliedAt: '2026-11-01T00:00:00.000Z',
  approvedAt: '2026-11-02T00:00:00.000Z',
  terms: {
    vendor: { ratePercent: 1, durationMonths: 2 },
    customer: { ratePercent: 1, durationMonths: 2 },
    agency: { ratePercent: 1, durationMonths: 2 },
  },
  balances: { pending: 0, available: 800, reserve: 0, requested: 0, clawback: 0, currency: 'XAF', ...balances },
  balanceFrozen: false,
  canWithdraw: true,
  payoutDestination: { source: 'agency', editableHere: false, method: { method: 'mobile_money', mobile_money: { provider: 'mtn', account_name: 'A' } } },
  referred: { total: 0, earning: 0 },
  ...over,
});

describe('linkEarns', () => {
  it('is false while the program is off, though the server still says codeActive', () => {
    expect(linkEarns(partner({ program: { enabled: false, minPayoutAmount: 500, rewardWaitDays: 7 } }))).toBe(false);
  });

  it('is false for a suspended partner and true for an active one', () => {
    expect(linkEarns(partner({ status: 'suspended', codeActive: false }))).toBe(false);
    expect(linkEarns(partner())).toBe(true);
  });
});

describe('hasPartnerHistory', () => {
  it('hides the money only from a first-time applicant', () => {
    expect(hasPartnerHistory({ status: 'pending', approvedAt: null })).toBe(false);
    expect(hasPartnerHistory({ status: 'pending', approvedAt: '2026-11-02T00:00:00.000Z' })).toBe(true);
    expect(hasPartnerHistory({ status: 'rejected', approvedAt: null })).toBe(true);
    expect(hasPartnerHistory({ status: 'terminated', approvedAt: '2026-11-02T00:00:00.000Z' })).toBe(true);
  });
});

describe('withdrawBlock', () => {
  it('offers the button when the server says so', () => {
    expect(withdrawBlock(partner())).toBeNull();
  });

  it('keeps it for a suspended partner whose balance was released', () => {
    expect(withdrawBlock(partner({ status: 'suspended', codeActive: false }))).toBeNull();
  });

  it('refuses while a withdrawal is open, even when the server would offer it', () => {
    expect(withdrawBlock(partner({}, { requested: 300 }))).toBe('open');
  });

  it('names the reason when the server refuses', () => {
    expect(withdrawBlock(partner({ canWithdraw: false, balanceFrozen: true }))).toBe('frozen');
    expect(withdrawBlock(partner({ canWithdraw: false }, { available: 0, clawback: 40 }))).toBe('owes');
    expect(withdrawBlock(partner({ canWithdraw: false }, { available: 0 }))).toBe('noBalance');
    expect(withdrawBlock(partner({ canWithdraw: false }, { available: 499 }))).toBe('belowMinimum');
  });

  it('does not call an empty balance frozen, as for a rejected applicant', () => {
    expect(withdrawBlock(partner({ status: 'rejected', canWithdraw: false, balanceFrozen: true }, { available: 0 }))).toBe('noBalance');
  });

  it('asks for a destination only once there is money to send', () => {
    const destination = { source: null, editableHere: true, method: null } as const;
    expect(withdrawBlock(partner({ canWithdraw: false, payoutDestination: destination }))).toBe('noDestination');
  });
});
