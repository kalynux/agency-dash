/**
 * Locale-aware formatting for the multi-country rollout. Amounts default to XAF
 * but the platform spans several currencies/locales, so format through `Intl`
 * rather than hand-building `"1,284,500 XAF"` strings — placement, grouping
 * separators, and the currency display all follow the active locale.
 *
 * `locale` defaults to the document's active language (set via lib/direction),
 * falling back to the runtime locale. Non-finite numbers and invalid/empty dates
 * render as an em dash rather than "NaN" / "Invalid Date", so a missing field can
 * never leak raw junk into the UI.
 */

import { intlLocaleFor } from '@/i18n/config';

const DASH = '—';

/**
 * The `Intl` locale to format in. Derived from the active UI language rather
 * than the browser's, so switching the dashboard to French also moves dates and
 * currency to French conventions. `<html lang>` is kept in step by
 * `applyDocumentDirection`, which every language change goes through.
 */
function activeLocale(explicit?: string): string | undefined {
  if (explicit) return intlLocaleFor(explicit);
  if (typeof document !== 'undefined' && document.documentElement.lang) {
    return intlLocaleFor(document.documentElement.lang);
  }
  return undefined; // Intl falls back to the runtime default
}

/** Whole-currency amounts (COD, earnings). XAF has no minor unit, so no decimals. */
export function formatCurrency(
  amount: number,
  currency = 'XAF',
  locale?: string,
): string {
  if (!Number.isFinite(amount)) return DASH;
  try {
    return new Intl.NumberFormat(activeLocale(locale), {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Unknown currency code → graceful, still locale-grouped.
    return `${amount.toLocaleString(activeLocale(locale))} ${currency}`;
  }
}

export function formatNumber(value: number, locale?: string): string {
  if (!Number.isFinite(value)) return DASH;
  return new Intl.NumberFormat(activeLocale(locale)).format(value);
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DATE_MEDIUM: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
const DATE_TIME: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};
const TIME_ONLY: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

/** Locale-aware absolute date, e.g. "Jul 5, 2026" / "5 juil. 2026". */
export function formatDate(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = DATE_MEDIUM,
  locale?: string,
): string {
  const d = toDate(value);
  if (!d) return DASH;
  return new Intl.DateTimeFormat(activeLocale(locale), options).format(d);
}

/** Locale-aware date + time, e.g. "Jul 5, 2026, 4:30 PM". */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = DATE_TIME,
  locale?: string,
): string {
  const d = toDate(value);
  if (!d) return DASH;
  return new Intl.DateTimeFormat(activeLocale(locale), options).format(d);
}

/**
 * "just now" / "5 min ago" / "3 days ago", in the active language.
 *
 * Uses `Intl.RelativeTimeFormat` rather than a translation key per unit: it
 * already knows every language's plural rules and its own wording for each
 * unit, so there is nothing for a translator to get wrong. Beyond `maxDays`
 * a relative phrase stops being useful ("47 days ago"), so it falls back to an
 * absolute date.
 */
export function formatRelativeTime(
  value: string | number | Date | null | undefined,
  { maxDays = 7, locale }: { maxDays?: number; locale?: string } = {},
): string {
  const d = toDate(value);
  if (!d) return DASH;

  const seconds = Math.round((d.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(seconds);
  if (absSeconds >= maxDays * 86_400) return formatDate(d, DATE_MEDIUM, locale);

  const rtf = new Intl.RelativeTimeFormat(activeLocale(locale), { numeric: 'auto' });
  if (absSeconds < 60) return rtf.format(0, 'second'); // → "now"
  if (absSeconds < 3_600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (absSeconds < 86_400) return rtf.format(Math.round(seconds / 3_600), 'hour');
  return rtf.format(Math.round(seconds / 86_400), 'day');
}

/** Locale-aware time only, e.g. "4:30 PM" / "16:30". */
export function formatTime(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = TIME_ONLY,
  locale?: string,
): string {
  const d = toDate(value);
  if (!d) return DASH;
  return new Intl.DateTimeFormat(activeLocale(locale), options).format(d);
}
