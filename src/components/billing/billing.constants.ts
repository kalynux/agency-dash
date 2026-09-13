// ─── Agency Billing — display constants & helpers ────────────────────────────────

import { formatNumber } from '@/lib/format';
import { getApiErrorMessage } from '@/lib/errors';
import { txStatic } from '@/i18n/tx';
import type { PaymentGateway, SubscriberPlanStatus } from '@/types/billing.types';
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

// ─── Mobile-money operators ──────────────────────────────────────────────────────
// The operator roster and its logos live in `lib/payment-brands` — one registry
// shared with checkout, the saved-methods list and payout setup.

/** Gateway used for mobile-money charges (default operator gateway). */
export const MOBILE_MONEY_GATEWAY: PaymentGateway = 'NOTCHPAY';
export const CARD_GATEWAY: PaymentGateway = 'STRIPE';

// ─── Gateway catalog (drives the gateway-first checkout chips) ───────────────────
// Each gateway maps to the method type it collects: mobile-money gateways need a
// phone + operator; the card gateway (Stripe) tokenises a card. The Stripe chip is
// only shown when a publishable key is configured (see PaymentDialog).

export interface GatewayMeta {
  value: PaymentGateway;
  /** `billing:` key, resolved at render — this table is module-scope data. */
  labelKey: string;
  /** Which channel fields this gateway collects. */
  methodType: Extract<PaymentMethodType, 'card' | 'mobile_money'>;
  /** `billing:` key for the short helper line shown under the chip row. */
  descriptionKey: string;
  /** Currency the agency is actually charged in (mobile money: XAF, card: USD). */
  chargeCurrency: 'XAF' | 'USD';
}

export const GATEWAYS: GatewayMeta[] = [
  { value: 'NOTCHPAY', labelKey: 'billing:gateways.NOTCHPAY', methodType: 'mobile_money', descriptionKey: 'billing:gateways.mobileMoneyDescription', chargeCurrency: 'XAF' },
  { value: 'MYCOOLPAY', labelKey: 'billing:gateways.MYCOOLPAY', methodType: 'mobile_money', descriptionKey: 'billing:gateways.mobileMoneyDescription', chargeCurrency: 'XAF' },
  { value: 'STRIPE', labelKey: 'billing:gateways.STRIPE', methodType: 'card', descriptionKey: 'billing:gateways.cardDescription', chargeCurrency: 'USD' },
];

/**
 * Whether My-CoolPay's Orange Money one-time-code step can actually complete.
 *
 * `true` since 2026-09-13. It was `false` for exactly one reason: that flow
 * answers `instructions.requiresOtp` with no USSD code, and the only documented
 * place to relay the code was `POST /payments/:transactionId/authorize` — which
 * resolves its argument against `PaymentTransaction` rows that a billing purchase
 * deliberately never creates, so it answered `404`. The payment was reachable and
 * could not be finished, for vendors and agents as well as agencies.
 *
 * The backend fixed it by adding the step to the **owner-scoped billing** routes
 * instead of widening the payments one — `POST /agency/credits/topups/:id/authorize`
 * and `POST /agency/plan-purchases/:id/authorize`, beside the `/verify` already
 * polled here. Widening the payments route would have opened an anonymous money
 * endpoint: it is unauthenticated because an order's payment link is shareable,
 * and a billing top-up has no such story. api-doc/agency/billing.md carries the
 * correction, dated.
 *
 * Kept as a named flag rather than deleted: it is the one switch that takes the
 * gateway back out if its OTP flow misbehaves in production.
 */
export const MYCOOLPAY_BILLING_OTP_ROUTABLE = true;

/**
 * The processors that can actually collect a mobile-money charge for billing.
 *
 * Filtered rather than removed from {@link GATEWAYS}: `gatewayLabel` still has
 * to name My-CoolPay on a historical transaction that was paid through it.
 */
export const MOBILE_MONEY_GATEWAYS: GatewayMeta[] = GATEWAYS.filter(
  (g) =>
    g.methodType === 'mobile_money' &&
    (g.value !== 'MYCOOLPAY' || MYCOOLPAY_BILLING_OTP_ROUTABLE),
);

export function gatewayLabel(gateway: PaymentGateway): string {
  const meta = GATEWAYS.find((g) => g.value === gateway);
  return meta ? txStatic(meta.labelKey) : gateway;
}

// ─── Saved payment-method display ────────────────────────────────────────────────

export function methodTypeLabel(type: PaymentMethodType): string {
  const key = `billing:methods.types.${type}`;
  const label = txStatic(key);
  return label === key ? type : label;
}

// Payment providers are brands — not translated.
const PROVIDER_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  notchpay: 'NotchPay',
  mycoolpay: 'MyCoolPay',
  mtn_momo: 'MTN MoMo',
  orange_money: 'Orange Money',
};

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider.toLowerCase()] ?? provider;
}

/** Provider/operator string for the gateway used to tokenise a mobile-money method. */
export function gatewayProvider(gateway: PaymentGateway): string {
  return gateway.toLowerCase();
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
