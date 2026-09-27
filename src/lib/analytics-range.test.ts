import { describe, expect, it } from 'vitest';
import { presetRange, rangeDays, validateRange } from './analytics-range';

// 27 Sep 2026, local time.
const today = new Date(2026, 8, 27, 15, 30);

describe('presetRange', () => {
  it('this month runs from the 1st to today', () => {
    expect(presetRange('thisMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-27' });
  });

  it('last month is the whole previous calendar month', () => {
    expect(presetRange('lastMonth', today)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(presetRange('lastMonth', new Date(2026, 0, 10))).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('rolling windows include today', () => {
    const r = presetRange('last7', today)!;
    expect(r).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    expect(rangeDays(r)).toBe(7);
    expect(rangeDays(presetRange('last30', today)!)).toBe(30);
    expect(rangeDays(presetRange('last90', today)!)).toBe(90);
  });

  it('custom has no range of its own', () => {
    expect(presetRange('custom', today)).toBeNull();
  });
});

describe('validateRange', () => {
  it('accepts a single day and the 366-day ceiling', () => {
    expect(validateRange({ from: '2026-09-27', to: '2026-09-27' })).toBeNull();
    expect(validateRange({ from: '2025-09-27', to: '2026-09-27' })).toBeNull(); // 366 days inclusive
  });

  it('refuses a reversed, empty or too-long range', () => {
    expect(validateRange({ from: '2026-09-28', to: '2026-09-27' })).toBe('invalid');
    expect(validateRange({ from: '', to: '2026-09-27' })).toBe('invalid');
    expect(validateRange({ from: '2025-09-26', to: '2026-09-27' })).toBe('tooLong');
  });
});
