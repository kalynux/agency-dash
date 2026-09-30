// ─── Saved Payment Methods — types ───────────────────────────────────────────────
// Mirrors api-doc/agency/payment-methods.md. This is the shared, role-agnostic API
// mounted at `/api/me/payment-methods`. Since 2026-09-30 a method is described by
// the network the agency holds (`MTN`, `ORANGE`, `MOOV`) — the same vocabulary as
// the charge `provider` — never by the company that moves the money. The full
// phone number is never returned.

import type { PaymentProvider, PhoneOperator } from './billing.types';

/**
 * Drives which icon/UI to render for an instrument (`PaymentMethodMark`). Lower
 * case because payout entries share it; a saved method's own `kind` maps onto it
 * through {@link methodTypeOf}.
 */
export type PaymentMethodType = 'card' | 'mobile_money' | 'bank_transfer';

/** What a saved method is, as the API names it. `BANK_TRANSFER` occurs on older rows only. */
export type PaymentMethodKind = 'MOBILE_MONEY' | 'CARD' | 'BANK_TRANSFER';

/** The shape returned by every read/write endpoint. */
export interface SavedPaymentMethod {
  id: string;
  /**
   * What the agency holds. `CARD` is a card saved before 2026-09-30 (list it,
   * default it, delete it — never pre-fill a payment from it). `null` is an older
   * row whose network is unknown: list and delete only.
   */
  provider: PaymentProvider | null;
  kind: PaymentMethodKind;
  /** Text for lists and rows, e.g. `MTN Mobile Money · ••••4417`. */
  label: string;
  /** e.g. `+2376••••4417`. `null` for a card, and for an older row with no number. */
  maskedPhone: string | null;
  /** Last 4 digits of the number (or of the card, on an older card row). */
  last4: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * `POST /me/payment-methods`. Strict: any other key — including every field of
 * the old shape — is refused with `400 VALIDATION_ERROR`. Saving a card is not
 * available.
 */
export interface AddPaymentMethodPayload {
  provider: PhoneOperator;
  /** E.164, e.g. `+237670124417`. */
  phoneNumber: string;
  /** 1–100 chars. Omit rather than send blank: the server writes one when absent. */
  label?: string;
  isDefault?: boolean;
}

/** The icon family for a saved method's `kind`. */
export function methodTypeOf(kind: PaymentMethodKind): PaymentMethodType {
  switch (kind) {
    case 'CARD':
      return 'card';
    case 'BANK_TRANSFER':
      return 'bank_transfer';
    default:
      return 'mobile_money';
  }
}

// ─── Response envelopes ─────────────────────────────────────────────────────────

export interface PaymentMethodsListResponse {
  success: boolean;
  data: SavedPaymentMethod[];
}

export interface PaymentMethodResponse {
  success: boolean;
  data: SavedPaymentMethod;
  message?: string;
}

export interface DefaultPaymentMethodResponse {
  success: boolean;
  data: SavedPaymentMethod | null;
}
