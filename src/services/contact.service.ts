// Changing the sign-in email / phone — `/api/me/contact`, `/api/me/email`,
// `/api/me/phone`.
//
// Role-agnostic and mounted under `/api/me`, like `PATCH /api/me/password`.
// Read `contact.types.ts` first: the identifier does not move until the change is
// proved.
//
// ⚠ The phone half of this file is the CONNECTION proof, which an agency cannot
// satisfy — it never registers through the bot. The code-based proof it can
// satisfy is `phone-verification.service.ts`, and that is what this dashboard
// leads with.
//
// See api-doc/me/contact-change.md and api-doc/me/phone-verification.md.

import { api } from './api';
import type {
  CancelPendingResponse,
  ChangeEmailPayload,
  ChangeEmailResponse,
  ChangePhonePayload,
  ChangePhoneResponse,
  ConfirmPhoneResponse,
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
   * Nothing moves yet. The next step is proving the new number — for an agency
   * that means `phoneVerificationService.request()`, not this app's inbox and
   * not, in practice, the connections screen.
   */
  changePhone(payload: ChangePhonePayload): Promise<ChangePhoneResponse> {
    return api.patch<ChangePhoneResponse>('/me/phone', payload);
  },

  /**
   * POST /me/phone/confirm — complete it via the CONNECTION proof.
   *
   * **Takes no body.** There is no token to present: the proof is a property of
   * the account (a WhatsApp connection matching the pending number), so the
   * session is what makes it lookupable at all.
   *
   * `422 CONTACT_CHANGE_PHONE_UNPROVEN` is the answer to build a screen for — it
   * is the next step rather than a failure — and for an agency it is the answer
   * to expect, which is why the card offers this as the shortcut for an account
   * that happens to hold a connection rather than as the way through.
   */
  confirmPhone(): Promise<ConfirmPhoneResponse> {
    return api.post<ConfirmPhoneResponse>('/me/phone/confirm');
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
