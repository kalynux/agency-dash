// Changing the email address / phone number an account SIGNS IN WITH.
//
// Role-agnostic, mounted under `/api/me`, and the identifiers live on the **User**
// record rather than on any role entity — so there is one email and one phone per
// *account* regardless of how many roles it holds. A confirmed change is carried
// onto every role profile, so the profile a notification reads and the identifier
// a sign-in resolves can never disagree.
//
// ─── The one rule that shapes everything ──────────────────────────────────────
//
// **The identifier does not move until the change is proved.**
//
// `POST /api/auth/login` resolves an account by `login_email` / `login_phone`. A
// flow that wrote the new value immediately and flagged it unverified would be
// unrecoverable from a typo: the account could no longer be signed into, and the
// correction form is behind the sign-in. So a request writes a PENDING change and
// nothing else — the current identifier still signs in, the new one does not, and
// confirming swaps them in a single write. There is no window in which both work,
// and none in which neither does.
//
// ─── Why the phone flow has no OTP, and never will ────────────────────────────
//
// This platform integrates **no SMS provider**, and a WhatsApp message to a number
// that has not messaged the bot is outside Meta's 24-hour service window — so it
// would have to be a paid, pre-approved template billed to a credit wallet.
//
// What the platform already has is the *inbound* direction. A messaging connection
// exists only because a message arrived FROM that number and the account holder
// redeemed the resulting code while signed in. That is a stronger proof of control
// than an OTP and it is already built, so the phone confirm requires it.
//
// Consequences a client must handle, not wait out:
//   * an account with **no WhatsApp connection cannot change its phone** — send
//     the user to the connections screen first;
//   * a **Telegram** connection does not count (a chat id bears no relation to a
//     phone number);
//   * the connected number must be **the number being claimed**, not merely any
//     connected number.
//
// ⚠ A contact change is NOT a credential change: it does not sign other devices
// out. Only `PATCH /api/me/password` does that.
//
// See api-doc/me/contact-change.md.

/** A change that has been requested and not yet proved. */
export interface PendingContactChange {
  /** The new address or number being claimed. */
  target: string;
  requestedAt: string;
  /** Email: 1 hour. Phone: 24 hours. */
  expiresAt: string;
}

/**
 * `GET /api/me/contact` — what the account signs in with, and what is waiting.
 *
 * `email` and `phone` are each nullable: an account may hold only one of the two.
 * **No token is ever returned**, here or anywhere else in this flow.
 */
export interface ContactState {
  email: string | null;
  phone: string | null;
  pendingEmail: PendingContactChange | null;
  pendingPhone: PendingContactChange | null;
}

export interface ContactStateResponse {
  success: true;
  data: ContactState;
}

/**
 * `PATCH /api/me/email`.
 *
 * The schema is `.strict()` — an unknown key is a `400`, not a silently stripped
 * field. `null` and `""` are refused: **clearing a login identifier is not a
 * self-service operation**, since an account must keep at least one.
 *
 * A second request **supersedes** the first and kills the earlier link. That is
 * the right behaviour for a mistyped address — retype it and the wrong link dies,
 * rather than two links racing.
 */
export interface ChangeEmailPayload {
  email: string;
}

export interface ChangeEmailResponse {
  success: true;
  data: { pendingEmail: PendingContactChange };
  message?: string;
}

/**
 * `PATCH /api/me/phone`. **Strict E.164** — a leading `+`, country code, no
 * spaces or punctuation. Same `.strict()` and same refusal of `null` / `""`.
 */
export interface ChangePhonePayload {
  phone: string;
}

export interface ChangePhoneResponse {
  success: true;
  data: { pendingPhone: PendingContactChange };
  message?: string;
}

export interface ConfirmPhoneResponse {
  success: true;
  data: { phone: string };
  message?: string;
}

export interface CancelPendingResponse {
  success: true;
  data: null;
  message?: string;
}

// ─── Error codes worth a real screen ──────────────────────────────────────────

/**
 * No WhatsApp connection on this account matches the pending number.
 *
 * **Not an error state so much as the next step**, and the one code here that
 * deserves a route rather than a message: the fix is to send `/connect` to the
 * bot *from the new number* and redeem the code.
 */
export const CONTACT_CHANGE_PHONE_UNPROVEN = 'CONTACT_CHANGE_PHONE_UNPROVEN';

/** Nothing in flight, or it was superseded by a newer request. */
export const CONTACT_CHANGE_NOT_PENDING = 'CONTACT_CHANGE_NOT_PENDING';
