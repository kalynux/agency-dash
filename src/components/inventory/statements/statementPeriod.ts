import { formatDate } from '@/lib/format';

/**
 * `periodKey` is `YYYY-MM`, a UTC calendar month — printed as "September 2026".
 * Formatted in UTC so a viewer west of Greenwich doesn't see the month before.
 */
export function formatPeriod(periodKey: string): string {
  const formatted = formatDate(`${periodKey}-01T00:00:00Z`, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return formatted === '—' ? periodKey : formatted;
}
