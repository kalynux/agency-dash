/**
 * `policies.pricing.max_fee_per_shipment` / `accepts_cash_delivery_fee` (ADR-A11).
 *
 * The PUT (onboarding) and the PATCH (settings) both replace the whole
 * `policies` object, and both forms submit what this schema PARSED — zod drops
 * keys it doesn't know. So a field missing from the schema is silently reset to
 * its default on every save of any other field. These tests pin the round trip.
 */
import { describe, expect, it } from 'vitest';
import type { AnyTFunction } from '@/i18n/tx';
import { buildPoliciesSchema } from './onboarding.schemas';

const t = ((key: string) => key) as unknown as AnyTFunction;

/** What a loaded agency profile's policies look like after the form seeds them. */
const loaded = {
  pricing: {
    storage_based: {
      enabled: true,
      monthly_storage_fee_per_sku: 500,
      pick_pack_fee_per_order: 300,
      local_delivery_fee: 1500,
      out_of_region_delivery_fee: 3000,
    },
    pickup_based: { enabled: true, base_rate_first_kg: 1000, additional_per_kg: 250, out_of_region_surcharge: 2000 },
    additional_fees: {
      cod_handling_fee: { type: 'percentage', value: 2 },
      failed_delivery_fee: 500,
      rto_fee: 700,
      peak_season_surcharge: 0,
    },
    max_fee_per_shipment: 6000,
    accepts_cash_delivery_fee: true,
    notes: 'Bulk orders above 50kg get 10% off.',
  },
  returns: { payer: 'vendor', handling_fee: 1000, return_window_days: 7, notes: '' },
  damage: { claim_deadline_days: 3, max_refund_per_item: 50000, notes: '' },
  cod: { enabled: true, max_order_amount: null },
};

describe('policies schema — ceiling and cash payment of the delivery fee', () => {
  const schema = buildPoliciesSchema(t);

  it('sends both new fields back untouched when another field is edited', () => {
    const edited = { ...loaded, returns: { ...loaded.returns, handling_fee: 1200 } };
    const parsed = schema.parse(edited);
    expect(parsed.pricing.max_fee_per_shipment).toBe(6000);
    expect(parsed.pricing.accepts_cash_delivery_fee).toBe(true);
    // …and nothing else in `pricing` was lost on the way.
    expect(parsed.pricing.pickup_based.additional_per_kg).toBe(250);
    expect(parsed.pricing.notes).toBe(loaded.pricing.notes);
  });

  it('reads an empty ceiling as "no maximum" (null), the input\'s string form as a number', () => {
    const blank = schema.parse({ ...loaded, pricing: { ...loaded.pricing, max_fee_per_shipment: '' } });
    expect(blank.pricing.max_fee_per_shipment).toBeNull();
    const typed = schema.parse({ ...loaded, pricing: { ...loaded.pricing, max_fee_per_shipment: '4500' } });
    expect(typed.pricing.max_fee_per_shipment).toBe(4500);
  });

  it('refuses a ceiling of 0 or a fraction, as the server does', () => {
    for (const bad of [0, '0', 12.5, -1]) {
      const result = schema.safeParse({ ...loaded, pricing: { ...loaded.pricing, max_fee_per_shipment: bad } });
      expect(result.success).toBe(false);
      expect(result.error!.issues.some((i) => i.path.join('.') === 'pricing.max_fee_per_shipment')).toBe(true);
    }
  });

  it('keeps the cash toggle off when it is off', () => {
    const parsed = schema.parse({ ...loaded, pricing: { ...loaded.pricing, accepts_cash_delivery_fee: false } });
    expect(parsed.pricing.accepts_cash_delivery_fee).toBe(false);
  });
});
