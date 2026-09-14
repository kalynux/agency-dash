// Proving a phone number with a six-digit WhatsApp code — `/api/me/phone/verify/*`.
//
// ─── Why this exists BESIDE the connection proof ──────────────────────────────
//
// There are two proofs of a phone number on this platform, and they are not
// alternatives you pick between — each serves accounts the other cannot reach:
//
//   * `POST /api/me/phone/confirm` (contact.types.ts) proves the number with an
//     existing WhatsApp CONNECTION on it. Stronger — a message actually arrived
//     FROM that number — and it is the customer path, because customers reach
//     the platform through the bot in the first place.
//
//   * `POST /api/me/phone/verify/confirm` (here) proves it with a code we sent.
//     Weaker, and it is the path for **vendor · agency · agent · admin**.
//
// An agency never registers through the bot, so it holds no connection, the
// connection proof can never succeed for it, and `phone_verified` could never
// have become true. That is what this flow is for — and it is why this
// dashboard's phone half is built on THIS surface, with the connection confirm
// kept only as the shortcut for an account that happens to have one.
//
// ⚠ **The target is chosen server-side** — the pending number if a change is in
// flight, otherwise the number already on the account. The confirm body is
// `.strict()` and accepts only `code`: sending `phone` alongside it is a 400,
// not a stripped field. A caller that could name the number could prove control
// of one and have another marked verified.
//
// See api-doc/me/phone-verification.md.

/**
 * `GET /api/me/phone/verify` — what is verifiable, and whether a code is already
 * in flight. Free, no side effect, so it is safe to read on mount.
 *
 * `phoneMasked` is `null` when the account holds no number at all — the same
 * state {@link PHONE_VERIFICATION_NO_TARGET} refuses a request with.
 */
export interface PhoneVerificationState {
  phoneMasked: string | null;
  /**
   * **The field that decides the copy.**
   *
   * `true` — a phone change is in flight and the code proves the NEW number;
   * confirming swaps the account's sign-in identifier. `false` — the code merely
   * proves the number already on the account.
   */
  completesPendingChange: boolean;
  /** A code is live right now (possibly requested from another device). */
  pending: boolean;
  expiresAt: string | null;
}

export interface PhoneVerificationStateResponse {
  success: true;
  data: PhoneVerificationState;
}

/**
 * `POST /api/me/phone/verify/request` — no body.
 *
 * `delivery` is `"text"` inside Meta's 24-hour service window and `"template"`
 * outside it. It is reported because it is the first thing to ask in support
 * when a code did not arrive — see the deployment limitation on
 * {@link PHONE_VERIFICATION_DELIVERY_FAILED}.
 */
export interface PhoneVerificationRequestResult {
  phoneMasked: string;
  expiresAt: string;
  delivery: 'text' | 'template';
}

export interface PhoneVerificationRequestResponse {
  success: true;
  data: PhoneVerificationRequestResult;
  message?: string;
}

/**
 * `POST /api/me/phone/verify/confirm`.
 *
 * `changed: true` means the account's login phone MOVED; `false` means the
 * number already on the account was verified in place. Two different sentences
 * to say, so the two are reported separately rather than inferred.
 */
export interface PhoneVerificationConfirmResult {
  phone: string;
  changed: boolean;
}

export interface PhoneVerificationConfirmResponse {
  success: true;
  data: PhoneVerificationConfirmResult;
  message?: string;
}

// ─── Refusals worth branching on ──────────────────────────────────────────────

/** 422 — no number on the account. The remedy is `PATCH /api/me/phone` first. */
export const PHONE_VERIFICATION_NO_TARGET = 'PHONE_VERIFICATION_NO_TARGET';

/**
 * 422 — wrong code. Carries `details.attemptsLeft`.
 *
 * Deliberately DISTINCT from {@link PHONE_VERIFICATION_CODE_EXPIRED}, because
 * the remedies differ: retype versus request a new code. Collapsing them sends
 * people hunting for a typo that is not there — the same reasoning
 * `CONNECTION_CODE_EXPIRED` makes.
 */
export const PHONE_VERIFICATION_CODE_INVALID = 'PHONE_VERIFICATION_CODE_INVALID';

/** 422 — past its TTL, or nothing in flight at all. Offer a new code. */
export const PHONE_VERIFICATION_CODE_EXPIRED = 'PHONE_VERIFICATION_CODE_EXPIRED';

/**
 * 429 — the attempt limit is spent and **the code is destroyed**. Clear the box:
 * retyping cannot work. The attempt limit, not the six digits, is the security
 * of this code.
 */
export const PHONE_VERIFICATION_TOO_MANY_ATTEMPTS = 'PHONE_VERIFICATION_TOO_MANY_ATTEMPTS';

/** 429 — resend cooldown. `details.retryAfterSeconds` says for how long. */
export const PHONE_VERIFICATION_RESEND_TOO_SOON = 'PHONE_VERIFICATION_RESEND_TOO_SOON';

/**
 * 502 — WhatsApp refused the send. Retryable, but usually not by retrying alone.
 *
 * ⛔ **Outside Meta's 24-hour window this does not work on the current
 * deployment** (measured 2026-09-14): only an approved template may be sent
 * there and this WABA holds zero. So a user who has not messaged the platform in
 * the last 24 hours gets this every time, and the way out is for them to message
 * the bot once — which opens the window, and incidentally also creates the
 * connection the stronger proof wants.
 */
export const PHONE_VERIFICATION_DELIVERY_FAILED = 'PHONE_VERIFICATION_DELIVERY_FAILED';

/**
 * Refusals that SPEND the live code, so the box must be cleared and a new code
 * requested. `CODE_INVALID` is deliberately not one of them — that is the one
 * the user recovers from by retyping.
 */
export const CODE_DESTROYING_ERRORS: ReadonlySet<string> = new Set([
  PHONE_VERIFICATION_CODE_EXPIRED,
  PHONE_VERIFICATION_TOO_MANY_ATTEMPTS,
]);

/**
 * `details.attemptsLeft` off a {@link PHONE_VERIFICATION_CODE_INVALID}.
 *
 * Disclosed on purpose: it tells the holder of the real code that they mistyped
 * and how much room is left, and tells an attacker only what they could count
 * themselves. The secret is the code, not the counter.
 */
export function readAttemptsLeft(details: unknown): number | undefined {
  if (!details || typeof details !== 'object') return undefined;
  const value = (details as { attemptsLeft?: unknown }).attemptsLeft;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
