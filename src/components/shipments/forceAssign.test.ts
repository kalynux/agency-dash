import { describe, expect, it } from 'vitest';
import { ApiError } from '@/types/api';
import { codLimitRefusal, coverageRefusal } from './forceAssign';

const refusal = (code: string, details?: unknown) => new ApiError(422, code, 'refused', details);

describe('coverageRefusal', () => {
  it('reads the regions off CONTRACT_COVERAGE_REGION_NOT_COVERED', () => {
    expect(
      coverageRefusal(
        refusal('CONTRACT_COVERAGE_REGION_NOT_COVERED', {
          deliveryRegion: 'Centre',
          coveredRegions: ['littoral', 'west'],
        }),
      ),
    ).toEqual({ deliveryRegion: 'Centre', coveredRegions: ['littoral', 'west'] });
  });

  it('survives missing or malformed details', () => {
    expect(coverageRefusal(refusal('CONTRACT_COVERAGE_REGION_NOT_COVERED'))).toEqual({
      deliveryRegion: null,
      coveredRegions: [],
    });
    expect(
      coverageRefusal(
        refusal('CONTRACT_COVERAGE_REGION_NOT_COVERED', { deliveryRegion: ' ', coveredRegions: ['x', 3, ''] }),
      ),
    ).toEqual({ deliveryRegion: null, coveredRegions: ['x'] });
  });

  // The refusals `force` can never skip must never be offered "Send anyway".
  it.each([
    'AGENT_MEMBERSHIP_NOT_APPROVED',
    'CONTRACT_SHIPMENT_VALUE_EXCEEDED',
    'AGENT_KYC_NOT_VERIFIED',
    'COD_AGENT_TRUST_TOO_LOW',
    'AGENT_NOT_ELIGIBLE_FOR_ASSIGNMENT',
    'COD_AGENT_EXPOSURE_EXCEEDED',
  ])('ignores %s', (code) => {
    expect(coverageRefusal(refusal(code, { deliveryRegion: 'Centre', coveredRegions: [] }))).toBeNull();
  });

  it('ignores non-API errors', () => {
    expect(coverageRefusal(new TypeError('network'))).toBeNull();
  });
});

describe('codLimitRefusal', () => {
  it('reads the numbers off COD_AGENT_EXPOSURE_EXCEEDED', () => {
    expect(
      codLimitRefusal(
        refusal('COD_AGENT_EXPOSURE_EXCEEDED', {
          currentExposure: 40000,
          additionalAmount: 15000,
          effectiveLimit: 50000,
          poolBinds: true,
        }),
      ),
    ).toEqual({ currentExposure: 40000, additionalAmount: 15000, effectiveLimit: 50000, poolBinds: true });
  });

  it('survives missing details', () => {
    expect(codLimitRefusal(refusal('COD_AGENT_EXPOSURE_EXCEEDED'))).toEqual({
      currentExposure: null,
      additionalAmount: null,
      effectiveLimit: null,
      poolBinds: false,
    });
  });

  // `force` does not waive these; offering "Assign anyway" would only fail again.
  it.each([
    'AGENT_KYC_NOT_VERIFIED',
    'COD_AGENT_TRUST_TOO_LOW',
    'AGENT_MEMBERSHIP_NOT_APPROVED',
    'CONTRACT_SHIPMENT_VALUE_EXCEEDED',
    'AGENT_NOT_ELIGIBLE_FOR_ASSIGNMENT',
    'CONTRACT_COVERAGE_REGION_NOT_COVERED',
  ])('ignores %s', (code) => {
    expect(codLimitRefusal(refusal(code, { currentExposure: 1, effectiveLimit: 1 }))).toBeNull();
  });
});
