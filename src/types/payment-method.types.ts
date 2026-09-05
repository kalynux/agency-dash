// ─── Saved Payment Methods — types ───────────────────────────────────────────────
// Mirrors api-doc/agency/payment-methods.md. This is the shared, role-agnostic API
// mounted at `/api/me/payment-methods`. Gateway token ids (gateway_customer_id /
// gateway_instrument_id) are write-only secrets and are NEVER returned in responses.

/** Drives which icon/UI to render for a saved instrument. */
export type PaymentMethodType = 'card' | 'mobile_money' | 'bank_transfer';

/** The shape returned by every read/write endpoint (never contains gateway token ids). */
export interface SavedPaymentMethod {
  id: string;
  /** Gateway/provider that owns the token, e.g. `stripe`, `notchpay`, `mycoolpay`. */
  provider: string;
  method_type: PaymentMethodType;
  /** Human label for lists/rows, e.g. `VISA •••• 8947` or `MTN •••• 1234`. */
  display_label: string;
  /** Card network or mobile operator, e.g. `visa`, `mastercard`, `MTN`, `ORANGE`. */
  brand: string | null;
  /** Last 4 digits of the card / phone number. */
  last4: string | null;
  /** Card expiry month, 1–12. Null for non-card methods. */
  exp_month: number | null;
  /** Card expiry 4-digit year, e.g. 2030. Null for non-card methods. */
  exp_year: number | null;
  holder_name: string | null;
  is_default: boolean;
}

/** POST body for adding a method. Token ids are stored server-side, never returned. */
export interface AddPaymentMethodPayload {
  provider: string;
  /** The gateway's customer/wallet id from tokenization. Stored, never returned. */
  gateway_customer_id: string;
  /** The gateway's card/instrument/payment-method id. Stored, never returned. */
  gateway_instrument_id: string;
  method_type: PaymentMethodType;
  display_label: string;
  brand?: string | null;
  last4?: string | null;
  exp_month?: number | null;
  exp_year?: number | null;
  holder_name?: string | null;
  is_default?: boolean;
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
