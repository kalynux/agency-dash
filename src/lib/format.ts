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

const DASH = '—';

function activeLocale(explicit?: string): string | undefined {
  if (explicit) return explicit;
  if (typeof document !== 'undefined' && document.documentElement.lang) {
    return document.documentElement.lang;
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
