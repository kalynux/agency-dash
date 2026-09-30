// ─── Agency Billing — display constants & helpers ────────────────────────────────

import { formatNumber } from '@/lib/format';
import { getApiErrorMessage } from '@/lib/errors';
import { txStatic } from '@/i18n/tx';
import type { PaymentOptionKind, SubscriberPlanStatus } from '@/types/billing.types';
import type { PaymentMethodType } from '@/types/payment-method.types';

// Re-export the generic formatters so billing components have a single import surface.
export { formatMoney, formatDate } from '@/lib/utils';

// ─── Settings limits ──────────────────────────────────────────────────────────

export const NOTIFY_DAYS_MIN = 0;
export const NOTIFY_DAYS_MAX = 90;

// ─── Polling ────────────────────────────────────────────────────────────────────

/** How often to poll a pending payment's verify endpoint. */
export const PAYMENT_POLL_INTERVAL_MS = 4000;
/** Give up polling after this long (mobile money can take a couple of minutes). */
export const PAYMENT_POLL_TIMEOUT_MS = 3 * 60 * 1000;

// ─── Providers, not aggregators ──────────────────────────────────────────────────
// The agency picks what it pays *with* (MTN, Orange, a card); the server picks
// the company that moves the money, and an administrator can switch it with no
// release. So nothing here names an aggregator — the choices come from
// `GET /payments/options` (see `usePaymentOptions`), and the operator logos from
// `lib/payment-brands`. See api-doc/FRONTEND-CHANGELOG-payment-providers.md.

/** Currency each kind of charge lands in: mobile money in XAF, cards in USD. */
export const CHARGE_CURRENCY: Record<PaymentOptionKind, string> = {
  MOBILE_MONEY: 'XAF',
  CARD: 'USD',
};

/**
 * A stored row's `gateway` — which aggregator carried that money — as a label.
 *
 * Informational only: never branch on it. Names live in the locale files, not
 * here, and a value with no entry (a newly added aggregator) prints as sent
 * rather than breaking the row.
 */
export function gatewayLabel(gateway: string): string {
  const key = `billing:gateways.${gateway.toUpperCase()}`;
  const label = txStatic(key);
  return label === key ? gateway : label;
}

// ─── Saved payment-method display ────────────────────────────────────────────────

export function methodTypeLabel(type: PaymentMethodType): string {
  const key = `billing:methods.types.${type}`;
  const label = txStatic(key);
  return label === key ? type : label;
}

// ─── Plan tier accents ────────────────────────────────────────────────────────
// Keyed by agency plan `code`; falls back to a neutral accent for admin-created plans.

export const PLAN_ACCENTS: Record<string, string> = {
  agency_free: 'border-muted',
  agency_growth: 'border-primary',
  agency_scale: 'border-amber-500',
};

export function planAccent(code: string): string {
  return PLAN_ACCENTS[code] ?? 'border-border';
}

// ─── Status labels ───────────────────────────────────────────────────────────────

export function subscriberPlanStatusLabel(status: SubscriberPlanStatus): string {
  const key = `billing:plan.status.${status}`;
  const label = txStatic(key);
  return label === key ? status : label;
}

// ─── Term / cap / credits formatting ───────────────────────────────────────────────

export function formatTerm(termDays: number | null): string {
  if (termDays === null || termDays === undefined) return txStatic('billing:plan.term.never');
  if (termDays % 30 === 0) {
    const months = termDays / 30;
    return months === 1
      ? txStatic('billing:plan.term.monthly')
      : txStatic('billing:plan.term.everyMonths', { count: months });
  }
  return txStatic('billing:plan.term.everyDays', { count: termDays });
}

/** Render a shipment cap (`null` = unlimited). */
export function formatShipmentCap(cap: number | null): string {
  return cap === null || cap === undefined ? txStatic('billing:plan.unlimited') : formatNumber(cap);
}

export function formatCredits(n: number): string {
  return formatNumber(n);
}

/**
 * Format the exact amount Stripe will charge (in USD). Stripe charges in USD even
 * though the catalog price stays in XAF — render this for the card path. The
 * backend supplies the amount (`instructions.chargedAmount`); never convert it
 * on the frontend.
 */
export function formatCharged(amount: number, currency = 'usd'): string {
  const code = currency.toUpperCase();
  // Grouping and symbol placement follow the UI language; the currency code is
  // repeated because "$" alone is ambiguous outside the US.
  const locale =
    typeof document !== 'undefined' && document.documentElement.lang
      ? document.documentElement.lang
      : undefined;
  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
    }).format(amount);
    return `${formatted} ${code}`;
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

// ─── Stripe 3-D Secure return / resume ───────────────────────────────────────────
// A card payment that needs a full bank redirect (3-D Secure) leaves the SPA via
// Stripe's `return_url`. We persist a marker so that when the agency lands back in
// billing we can re-verify that purchase and refresh. The Stripe WEBHOOK is the
// authoritative finalizer server-side; this is only for immediate UX on return.

export type StripeResumeKind = 'plan' | 'topup';

export interface StripeResumeMarker {
  kind: StripeResumeKind;
  id: string;
  /** ms epoch — used to expire stale markers. */
  at: number;
}

const RESUME_KEY = 'billing.stripe.resume';
/** Drop resume markers older than this (a return that never happened). */
const RESUME_TTL_MS = 30 * 60 * 1000;

export function saveStripeResume(kind: StripeResumeKind, id: string): void {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify({ kind, id, at: Date.now() }));
  } catch {
    // localStorage unavailable (private mode / quota) — resume is best-effort.
  }
}

export function readStripeResume(): StripeResumeMarker | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StripeResumeMarker;
    if (!parsed?.id || !parsed?.kind) return null;
    if (Date.now() - (parsed.at ?? 0) > RESUME_TTL_MS) {
      clearStripeResume();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearStripeResume(): void {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {
    // ignore
  }
}

// ─── Error-code → friendly message ────────────────────────────────────────────────

/**
 * Every billing/payment code the API can return already has copy in the shared
 * `errors:codes.*` catalog, so this is a thin alias that keeps the billing
 * components' import surface intact.
 *
 * `fallback` is a *rendered* string, not a key — callers pass one when the
 * generic "something went wrong" is too vague for the action they just tried.
 */
export function billingErrorMessage(err: unknown, fallback?: string): string {
  const message = getApiErrorMessage(err);
  return fallback && message === txStatic('errors:generic') ? fallback : message;
}
