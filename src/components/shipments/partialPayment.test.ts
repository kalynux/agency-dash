import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from '@/lib/errors';
import { ApiError } from '@/types/api';
import type { ShipmentCodInfo } from '@/types/shipment.types';
import { needsFailureReasonReminder, prepaidAmountOf } from './shipment-actions';

const cod = (prepaidAmount?: number): ShipmentCodInfo => ({
  expectedAmount: 14000,
  itemsAmount: 18000,
  deliveryFeeAmount: 2000,
  prepaidAmount,
  currency: 'XAF',
  status: null,
  collectedAt: null,
});

describe('prepaidAmountOf', () => {
  it('reads the server figure, and treats an older server as nothing prepaid', () => {
    expect(prepaidAmountOf(cod(6000))).toBe(6000);
    expect(prepaidAmountOf(cod())).toBe(0);
    expect(prepaidAmountOf(null)).toBe(0);
    expect(prepaidAmountOf(undefined)).toBe(0);
  });
});

describe('needsFailureReasonReminder', () => {
  it('stops a failure or a return on a parcel partly paid online', () => {
    expect(needsFailureReasonReminder('failed', cod(6000))).toBe(true);
    expect(needsFailureReasonReminder('returned', cod(6000))).toBe(true);
  });

  it('leaves every other transition alone', () => {
    expect(needsFailureReasonReminder('in_transit', cod(6000))).toBe(false);
    expect(needsFailureReasonReminder('agent_delivered', cod(6000))).toBe(false);
  });

  it('leaves a parcel with nothing prepaid alone: its reason decides no money', () => {
    expect(needsFailureReasonReminder('failed', cod(0))).toBe(false);
    expect(needsFailureReasonReminder('returned', cod())).toBe(false);
    expect(needsFailureReasonReminder('failed', null)).toBe(false);
  });
});

describe('SHIPMENT_REASSIGNMENT_CONFLICT', () => {
  const conflict = (details?: unknown) =>
    new ApiError(409, 'SHIPMENT_REASSIGNMENT_CONFLICT', 'English server copy', details);

  it('says the parcel cannot go out again once its refund is opened', () => {
    const message = getApiErrorMessage(conflict({ shipmentId: 's1' }));
    expect(message).toContain('refund');
    expect(message).toContain("can't be sent out again");
  });

  it('keeps telling a lost race to retry, because retrying is right there', () => {
    const race = conflict({ expectedAgentId: 'a1', expectedStatus: 'returned' });
    expect(getApiErrorMessage(race)).toContain('retry');
    expect(getApiErrorMessage(conflict())).toContain('retry');
  });
});
