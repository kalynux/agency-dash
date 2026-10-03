import { describe, expect, it } from 'vitest';
import { ApiError } from '@/types/api';
import { atCapacityRefusal, bulkItemError, isBulkOfferable, isForceableRefusal } from './bulkAssign';

describe('isBulkOfferable', () => {
  it('takes assigned and handing_over rows with no agent bound', () => {
    expect(isBulkOfferable({ status: 'assigned', agentId: null })).toBe(true);
    expect(isBulkOfferable({ status: 'handing_over', agentId: null })).toBe(true);
  });

  it('refuses an accepted row or any other status', () => {
    expect(isBulkOfferable({ status: 'assigned', agentId: 'a1' })).toBe(false);
    expect(isBulkOfferable({ status: 'picked_up', agentId: null })).toBe(false);
    expect(isBulkOfferable({ status: 'pending_agency_reassignment', agentId: null })).toBe(false);
  });
});

describe('bulkItemError + isForceableRefusal', () => {
  const row = (code: string, details?: unknown) =>
    bulkItemError({ code, message: 'refused', statusCode: 422, category: 'business_rule', details });

  it('keeps the code and details of the row', () => {
    const err = row('CONTRACT_COVERAGE_REGION_NOT_COVERED', { deliveryRegion: 'Centre', coveredRegions: [] });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('CONTRACT_COVERAGE_REGION_NOT_COVERED');
    expect(err.status).toBe(422);
    expect(err.details).toEqual({ deliveryRegion: 'Centre', coveredRegions: [] });
  });

  it('forces only the region and the COD cash limit', () => {
    expect(isForceableRefusal(row('CONTRACT_COVERAGE_REGION_NOT_COVERED'))).toBe(true);
    expect(isForceableRefusal(row('COD_AGENT_EXPOSURE_EXCEEDED'))).toBe(true);
    for (const code of [
      'SHIPMENT_ALREADY_HAS_AGENT',
      'SHIPMENT_ALREADY_HAS_PENDING_OFFER',
      'SHIPMENT_NOT_OFFERABLE',
      'CONTRACT_SHIPMENT_VALUE_EXCEEDED',
      'AGENT_KYC_NOT_VERIFIED',
      'COD_AGENT_TRUST_TOO_LOW',
      'SOMETHING_NEW',
    ]) {
      expect(isForceableRefusal(row(code))).toBe(false);
    }
  });
});

describe('atCapacityRefusal', () => {
  const capacity = (details?: unknown) => new ApiError(422, 'AGENT_AT_CAPACITY', 'full', details);

  it('reads freeSlots and requested', () => {
    expect(
      atCapacityRefusal(capacity({ activeShipmentCount: 3, maxActiveShipments: 5, freeSlots: 2, requested: 4 })),
    ).toEqual({ freeSlots: 2, requested: 4 });
  });

  it('keeps freeSlots when requested is missing', () => {
    expect(atCapacityRefusal(capacity({ freeSlots: 0 }))).toEqual({ freeSlots: 0, requested: null });
  });

  it('returns null without freeSlots, or for another code', () => {
    expect(atCapacityRefusal(capacity())).toBeNull();
    expect(atCapacityRefusal(new ApiError(422, 'AGENT_NOT_ELIGIBLE_FOR_ASSIGNMENT', 'no', { freeSlots: 1 }))).toBeNull();
    expect(atCapacityRefusal(new TypeError('network'))).toBeNull();
  });
});
