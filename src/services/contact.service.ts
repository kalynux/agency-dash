// Changing the sign-in email / phone — `/api/me/contact`, `/api/me/email`,
// `/api/me/phone`.
//
// Role-agnostic and mounted under `/api/me`, like `PATCH /api/me/password`.
// Read `contact.types.ts` first: the identifier does not move until the change is
// proved.
//
// ⚠ A phone change is CONFIRMED in `phone-verification.service.ts`, with the
// WhatsApp code. There is deliberately no `POST /me/phone/confirm` here — that is
// the connection proof, and it serves the bot surface only.
//
// See api-doc/me/contact-change.md and api-doc/me/phone-verification.md.

import { api } from './api';
import type {
  CancelPendingResponse,
  ChangeEmailPayload,
  ChangeEmailResponse,
  ChangePhonePayload,
  ChangePhoneResponse,
  ContactState,
  ContactStateResponse,
} from '@/types/contact.types';

export const contactService = {
  /** GET /me/contact — the current identifiers, and anything in flight. */
  async get(): Promise<ContactState> {
    const res = await api.get<ContactStateResponse>('/me/contact');
    return res.data;
  },

  /**
   * PATCH /me/email — open a change, and send a confirmation link to the NEW
   * address.
   *
   * Nothing on the account moves yet: the current email still signs in, and the
   * new one does not, until the link is spent.
   */
  changeEmail(payload: ChangeEmailPayload): Promise<ChangeEmailResponse> {
    return api.patch<ChangeEmailResponse>('/me/email', payload);
  },

  /** DELETE /me/email/pending — abandon it. The current identifier is untouched. */
  cancelEmailChange(): Promise<CancelPendingResponse> {
    return api.delete<CancelPendingResponse>('/me/email/pending');
  },

  /**
   * PATCH /me/phone — open a change. **Strict E.164.**
   *
   * Nothing moves yet, and ⚠ **no code is sent**: the caller must follow up with
   * `phoneVerificationService.request()`, which targets the pending number. (Sent
   * from here, the code would start the 60-second cooldown and that explicit
   * request would be refused with 429.)
   */
  changePhone(payload: ChangePhonePayload): Promise<ChangePhoneResponse> {
    return api.patch<ChangePhoneResponse>('/me/phone', payload);
  },

  /** DELETE /me/phone/pending — abandon it. */
  cancelPhoneChange(): Promise<CancelPendingResponse> {
    return api.delete<CancelPendingResponse>('/me/phone/pending');
  },
};

// ─── Why there is no `confirmEmailChange` here ───────────────────────────────
//
// `POST /api/auth/email-change/confirm` exists and is public, but **it is not
// this app's surface**. The link the backend emails points at
// `<STOREFRONT_URL>/account/confirm-email?token=…` — a page the main Wi-Mall site
// serves, not this dashboard — and `STOREFRONT_URL` is a backend environment
// variable no client can redirect.
//
// That is the same boundary `/forgot-password` already lives on: this app opens
// the flow, the emailed link finishes it in a browser, and the user comes back.
// Adding a confirm route here would be a page the backend never links to.
//
// (It is a POST rather than the older `GET /api/auth/verify-email` because mail
// clients and chat apps prefetch URLs to build preview cards, and a GET that
// mutates is spent by a crawler before the person taps it.)
