// ─── Agency Billing — display constants & helpers ────────────────────────────────

import type {
  PaymentGateway,
  PhoneOperator,
  SubscriberPlanStatus,
} from '@/types/billing.types';
import type { PaymentMethodType } from '@/types/payment-method.types';
import { ApiError } from '@/types/api';

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

export const PHONE_OPERATORS: { value: PhoneOperator; label: string }[] = [
  { value: 'MTN', label: 'MTN Mobile Money' },
  { value: 'ORANGE', label: 'Orange Money' },
  { value: 'MOOV', label: 'Moov Money' },
];

/** Gateway used for mobile-money charges (default operator gateway). */
export const MOBILE_MONEY_GATEWAY: PaymentGateway = 'NOTCHPAY';
export const CARD_GATEWAY: PaymentGateway = 'STRIPE';

// ─── Gateway catalog (drives the gateway-first checkout chips) ───────────────────
// Each gateway maps to the method type it collects: mobile-money gateways need a
// phone + operator; the card gateway (Stripe) tokenises a card. The Stripe chip is
// only shown when a publishable key is configured (see PaymentDialog).

export interface GatewayMeta {
  value: PaymentGateway;
  label: string;
  /** Which channel fields this gateway collects. */
  methodType: Extract<PaymentMethodType, 'card' | 'mobile_money'>;
  /** Short helper line shown under the chip row. */
  description: string;
  /** Currency the agency is actually charged in (mobile money: XAF, card: USD). */
  chargeCurrency: 'XAF' | 'USD';
}

export const GATEWAYS: GatewayMeta[] = [
  { value: 'NOTCHPAY', label: 'NotchPay', methodType: 'mobile_money', description: 'Mobile money — charged in XAF', chargeCurrency: 'XAF' },
  { value: 'MYCOOLPAY', label: 'MyCoolPay', methodType: 'mobile_money', description: 'Mobile money — charged in XAF', chargeCurrency: 'XAF' },
  { value: 'STRIPE', label: 'Card', methodType: 'card', description: 'Visa, Mastercard & more — charged in USD', chargeCurrency: 'USD' },
];

export function gatewayLabel(gateway: PaymentGateway): string {
  return GATEWAYS.find((g) => g.value === gateway)?.label ?? gateway;
}

// ─── Saved payment-method display ────────────────────────────────────────────────

const METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  card: 'Card',
  mobile_money: 'Mobile money',
  bank_transfer: 'Bank transfer',
};

export function methodTypeLabel(type: PaymentMethodType): string {
  return METHOD_TYPE_LABELS[type] ?? type;
}

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
  switch (status) {
    case 'active':
      return 'Active';
    case 'pending_activation':
      return 'Queued';
    case 'expired':
      return 'Expired';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

// ─── Term / cap / credits formatting ───────────────────────────────────────────────

export function formatTerm(termDays: number | null): string {
  if (termDays === null || termDays === undefined) return 'Never expires';
  if (termDays % 30 === 0) {
    const months = termDays / 30;
    return months === 1 ? 'Monthly' : `Every ${months} months`;
  }
  return `Every ${termDays} days`;
}

/** Render a shipment cap (`null` = unlimited). */
export function formatShipmentCap(cap: number | null): string {
  return cap === null || cap === undefined ? 'Unlimited' : new Intl.NumberFormat().format(cap);
}

export function formatCredits(n: number): string {
  return new Intl.NumberFormat().format(n);
}

/**
 * Format the exact amount Stripe will charge (in USD). Stripe charges in USD even
 * though the catalog price stays in XAF — render this for the card path. The
 * backend supplies the amount (`instructions.chargedAmount`); never convert it
 * on the frontend.
 */
export function formatCharged(amount: number, currency = 'usd'): string {
  const code = currency.toUpperCase();
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
    }).format(amount);
    return `${formatted} ${code}`;
  } catch {
    return `$${amount.toFixed(2)} ${code}`;
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

const BILLING_ERROR_MESSAGES: Record<string, string> = {
  BILLING_PLAN_NOT_FOUND: 'That plan is no longer available.',
  BILLING_PLAN_INACTIVE: "That plan isn't available for purchase yet.",
  BILLING_PLAN_ROLE_MISMATCH: 'That plan is not an agency plan.',
  BILLING_PLAN_NOT_PURCHASABLE: 'The free plan is the default tier and cannot be purchased.',
  BILLING_PENDING_PLAN_EXISTS: 'You already have a plan queued to start when your current one ends. Wait for it to activate before buying another.',
  BILLING_TOPUP_PACK_NOT_FOUND: 'That credit pack is no longer available.',
  BILLING_INSUFFICIENT_CREDITS: 'Not enough credits for this action.',
  PAYMENT_GATEWAY_NOT_SUPPORTED: 'That payment method is not supported.',
  PAYMENT_INITIATION_FAILED: 'The payment provider could not start the payment. Please try again.',
  PAYMENT_CARD_DECLINED: 'Your card was declined. Check the details or try another card.',
  BILLING_TOPUP_INVALID_STATE: 'This payment cannot be verified yet. Please retry in a moment.',
  BILLING_PURCHASE_INVALID_STATE: 'This payment cannot be verified yet. Please retry in a moment.',
  PAYMENT_METHOD_NOT_FOUND: 'That payment method could not be found.',
  PAYMENT_METHOD_LIMIT_REACHED: 'You can save up to 10 payment methods. Remove one to add another.',
  VALIDATION_ERROR: 'Please check the details and try again.',
};

export function billingErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) {
    return BILLING_ERROR_MESSAGES[err.code] ?? err.message ?? fallback;
  }
  return fallback;
}
