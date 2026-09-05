import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import i18n from "@/i18n"
import { formatCurrency, formatDate as formatDateBase, formatNumber } from "@/lib/format"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Byte-unit keys, smallest first. Listed as literals rather than built from the
 * unit name so the paths still type-check against `en/common.json`.
 *
 * The unit itself is translated, not just the number: French counts in octets
 * (o/Ko/Mo), so a hard-coded "MB" would be wrong there even though the digits
 * are identical.
 */
const BYTE_UNIT_KEYS = [
  'common:units.bytes.b',
  'common:units.bytes.kb',
  'common:units.bytes.mb',
  'common:units.bytes.gb',
  'common:units.bytes.tb',
] as const;

export function formatFileSize(bytes: number): string {
  const value = (n: number, unit: (typeof BYTE_UNIT_KEYS)[number]) =>
    i18n.t(unit, { value: formatNumber(n) });

  if (!Number.isFinite(bytes) || bytes <= 0) return value(0, BYTE_UNIT_KEYS[0]);
  const k = 1024;
  // Clamp so a petabyte-scale number lands on TB instead of running off the end.
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), BYTE_UNIT_KEYS.length - 1);
  return value(parseFloat((bytes / Math.pow(k, i)).toFixed(2)), BYTE_UNIT_KEYS[i]);
}

// ─── Storage usage helpers (api-doc/agency/storage.md) ───────────────────────

/** Percentage of the plan limit used, clamped 0–100. `null` limit (no cap) → 0. */
export function storagePercent(usedBytes: number, limitBytes: number | null): number {
  if (!limitBytes || limitBytes <= 0) return 0;
  return Math.min(100, Math.round((usedBytes / limitBytes) * 100));
}

/**
 * Tailwind color for the usage-bar indicator at the storage-alert bands
 * (storage.md §4): ≥90% danger, ≥80% warning, else normal.
 */
export function storageBarColor(percent: number): string {
  if (percent >= 90) return 'bg-destructive';
  if (percent >= 80) return 'bg-amber-500';
  return 'bg-primary';
}

/**
 * Whole-currency-unit amount (billing/plan/credit prices are whole XAF — never in
 * minor units). Delegates to the locale-aware {@link formatCurrency} so grouping,
 * separator and currency placement follow the active language.
 */
export function formatMoney(amount: number, currency = 'XAF'): string {
  return formatCurrency(amount, currency);
}

/** Absolute date, e.g. "Jun 1, 2026". Null/invalid → em dash. */
export function formatDate(iso: string | null): string {
  return formatDateBase(iso);
}
