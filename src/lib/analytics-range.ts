/**
 * Date ranges for `GET /agency/analytics`, which takes local calendar days
 * (`YYYY-MM-DD`, both ends inclusive) and refuses a span over 366 days.
 *
 * Days are built from the device's calendar. The server counts them in the
 * agency's zone (`Africa/Douala` by default), which is the same day for the
 * people using this dashboard.
 */

export type AnalyticsPreset = 'thisMonth' | 'lastMonth' | 'last7' | 'last30' | 'last90' | 'custom';

export const ANALYTICS_PRESETS: readonly AnalyticsPreset[] = [
  'thisMonth',
  'lastMonth',
  'last7',
  'last30',
  'last90',
  'custom',
];

/** The server's ceiling, inclusive of both ends. */
export const MAX_RANGE_DAYS = 366;

export interface DayRange {
  from: string;
  to: string;
}

/** `YYYY-MM-DD` for a local date. */
export function toISODay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** The range a preset stands for, as of `today`. `null` for `custom`, which the user picks. */
export function presetRange(preset: AnalyticsPreset, today: Date = new Date()): DayRange | null {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (preset) {
    case 'thisMonth':
      return { from: toISODay(new Date(t.getFullYear(), t.getMonth(), 1)), to: toISODay(t) };
    case 'lastMonth':
      return {
        from: toISODay(new Date(t.getFullYear(), t.getMonth() - 1, 1)),
        to: toISODay(new Date(t.getFullYear(), t.getMonth(), 0)),
      };
    case 'last7':
      return { from: toISODay(addDays(t, -6)), to: toISODay(t) };
    case 'last30':
      return { from: toISODay(addDays(t, -29)), to: toISODay(t) };
    case 'last90':
      return { from: toISODay(addDays(t, -89)), to: toISODay(t) };
    case 'custom':
      return null;
  }
}

/** Calendar days in `from..to`, both included. Computed in UTC so DST cannot shift it. */
export function rangeDays({ from, to }: DayRange): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Why a picked range cannot be sent, or `null` when it can. */
export function validateRange(range: DayRange): 'invalid' | 'tooLong' | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.from) || !/^\d{4}-\d{2}-\d{2}$/.test(range.to)) return 'invalid';
  const days = rangeDays(range);
  if (!Number.isFinite(days) || days < 1) return 'invalid';
  if (days > MAX_RANGE_DAYS) return 'tooLong';
  return null;
}
