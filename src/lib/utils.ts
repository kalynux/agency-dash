import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatCurrency, formatDate as formatDateBase } from "@/lib/format"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
