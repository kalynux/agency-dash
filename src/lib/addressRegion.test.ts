import { describe, expect, it } from 'vitest';
import { ApiError } from '@/types/api';
import type { GeoAddress } from '@/types/geo.types';
import { addressRegionRefusal, refusedEntryIndex, withRegion } from './addressRegion';

const err = (details?: unknown, code = 'ADDRESS_REGION_INVALID') => new ApiError(400, code, 'refused', details);

const details = {
  index: 1,
  label: 'Bonabéri branch',
  region: 'Centre Region',
  city: null,
  countryCode: 'CM',
  allowedRegions: [
    { key: 'centre', name: { en: 'Centre', fr: 'Centre' } },
    { key: 'north_west', name: { en: 'North West', fr: 'Nord-Ouest' } },
    { key: 'bad' },
    'junk',
  ],
};

describe('addressRegionRefusal', () => {
  it('reads the entry and the picker, labelled in the active language', () => {
    expect(addressRegionRefusal(err(details), 'fr-FR')).toEqual({
      index: 1,
      label: 'Bonabéri branch',
      region: 'Centre Region',
      city: null,
      allowedRegions: [
        { key: 'centre', label: 'Centre' },
        { key: 'north_west', label: 'Nord-Ouest' },
        { key: 'bad', label: 'bad' },
      ],
    });
  });

  it('falls back to English for a language the server does not name', () => {
    expect(addressRegionRefusal(err(details), 'ar')?.allowedRegions[1].label).toBe('North West');
  });

  it('ignores other codes', () => {
    expect(addressRegionRefusal(err(details, 'ADDRESS_COUNTRY_MISMATCH'), 'en')).toBeNull();
    expect(addressRegionRefusal(new TypeError('x'), 'en')).toBeNull();
  });
});

describe('refusedEntryIndex', () => {
  const base = { index: null, label: null, region: null, city: null, allowedRegions: [] };

  it('trusts the index when it is in range', () => {
    expect(refusedEntryIndex({ ...base, index: 1 }, ['a', 'b'])).toBe(1);
  });

  it('falls back to a unique label match', () => {
    expect(refusedEntryIndex({ ...base, index: 5, label: 'b' }, ['a', ' b '])).toBe(1);
    expect(refusedEntryIndex({ ...base, label: 'a' }, ['a', 'a'])).toBeNull();
    expect(refusedEntryIndex(base, ['a'])).toBeNull();
  });
});

describe('withRegion', () => {
  it('sets geo.components.region and leaves the rest alone', () => {
    const geo = {
      formatted_address: 'Akwa, Douala',
      coordinates: { type: 'Point', coordinates: [9.7, 4.05] },
      components: { city: 'Douala', region: 'Centre Region', country_code: 'CM' },
    } as unknown as GeoAddress;
    const next = withRegion(geo, 'littoral');
    expect(next.components).toEqual({ city: 'Douala', region: 'littoral', country_code: 'CM' });
    expect(geo.components.region).toBe('Centre Region');
  });
});
