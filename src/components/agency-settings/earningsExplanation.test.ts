import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import i18n, { changeLanguage } from '@/i18n';
import type { AgencyDamageClaim, EarningsAdjustment } from '@/types/earnings.types';
import { explainAdjustment, explainClaim } from './earningsExplanation';

const t = i18n.getFixedT(null, 'account');

const adjustment = (over: Partial<EarningsAdjustment>): EarningsAdjustment => ({
  id: 'a1',
  kind: 'refund_clawback',
  amount: 1500,
  currency: 'XAF',
  takenFrom: { pending: 1500, reserve: 0, available: 0, debt: 0 },
  feeAmount: 0,
  reasonCode: 'refund_delivery_fault',
  reasonParams: {
    orderNumber: 'ORD-1',
    trackingNumber: 'TRK-1',
    amount: 1500,
    currency: 'XAF',
    raisedAt: '2026-10-20T10:00:00.000Z',
    deliveredAt: '2026-10-19T10:00:00.000Z',
    windowDays: 2,
  },
  explanation: 'ENGLISH FROM SERVER',
  refundRequestId: null,
  agencyClaimId: null,
  sourceType: 'shipment',
  sourceId: 's1',
  createdAt: '2026-10-21T10:00:00.000Z',
  ...over,
});

const claim: AgencyDamageClaim = {
  id: 'c1',
  kind: 'damage',
  shipmentId: 's1',
  orderId: 'o1',
  orderNumber: 'ORD-1',
  trackingNumber: 'TRK-1',
  itemCount: 2,
  maxPerItem: 5000,
  cap: 10000,
  amount: 10000,
  investigationFee: 1000,
  currency: 'XAF',
  deliveredAt: '2026-10-19T10:00:00.000Z',
  raisedAt: '2026-10-20T10:00:00.000Z',
  windowDays: 2,
  reasonCode: 'damage_claim',
  reasonParams: {},
  explanation: 'ENGLISH FROM SERVER',
  createdAt: '2026-10-21T10:00:00.000Z',
};

describe('earnings explanations', () => {
  it('shows the server sentence as-is in English', () => {
    expect(explainAdjustment(t, 'en', adjustment({}))).toBe('ENGLISH FROM SERVER');
    expect(explainClaim(t, 'en', claim)).toBe('ENGLISH FROM SERVER');
  });

  describe('in French', () => {
    beforeAll(() => changeLanguage('fr'));
    afterAll(() => changeLanguage('en'));

    it('rebuilds a delivery-fault refund from its params', () => {
      const out = explainAdjustment(t, 'fr', adjustment({}));
      expect(out).toContain('la commande ORD-1');
      expect(out).toContain('colis TRK-1');
      expect(out).toContain('jugée fautive');
      expect(out).not.toContain('{{');
    });

    it('pluralises the damage claim and adds the investigation fee', () => {
      const out = explainClaim(t, 'fr', claim);
      expect(out).toContain('2 articles endommagés');
      expect(out).toContain("frais d'enquête");
      expect(out).not.toContain('{{');
    });

    it('rebuilds a partial-return fault charge, naming only the charges that apply', () => {
      const out = explainAdjustment(t, 'fr', adjustment({
        reasonCode: 'partial_return_fault',
        reasonParams: { orderNumber: 'ORD-1', currency: 'XAF', returnFee: 0, fees: 240 },
      }));
      expect(out).toContain('la commande ORD-1');
      expect(out).toContain('par votre faute');
      expect(out).toContain('240');
      expect(out).toContain('frais de paiement et de transfert');
      expect(out).not.toContain('course de retour');
      expect(out).not.toContain('{{');
    });

    it('falls back to the English sentence for a partial-return charge it cannot rebuild', () => {
      const nothingCharged = { orderNumber: 'ORD-1', currency: 'XAF', returnFee: 0, fees: 0 };
      expect(explainAdjustment(t, 'fr', adjustment({ reasonCode: 'partial_return_fault', reasonParams: nothingCharged })))
        .toBe('ENGLISH FROM SERVER');
      expect(explainAdjustment(t, 'fr', adjustment({ reasonCode: 'partial_return_fault', reasonParams: { orderNumber: 'ORD-1' } })))
        .toBe('ENGLISH FROM SERVER');
    });

    it('localises a pre-2026-10-22 row from its kind', () => {
      const out = explainAdjustment(t, 'fr', adjustment({ kind: 'write_off', reasonCode: null, reasonParams: null }));
      expect(out).toContain('Wi-Mall a annulé');
    });

    it('falls back to the English sentence for a code or params it cannot render', () => {
      expect(explainAdjustment(t, 'fr', adjustment({ reasonCode: 'refund_beyond_share' }))).toBe('ENGLISH FROM SERVER');
      expect(explainAdjustment(t, 'fr', adjustment({ reasonParams: { orderNumber: 'ORD-1' } }))).toBe('ENGLISH FROM SERVER');
      expect(explainAdjustment(t, 'fr', adjustment({ reasonCode: 'something_new' }))).toBe('ENGLISH FROM SERVER');
    });
  });
});
