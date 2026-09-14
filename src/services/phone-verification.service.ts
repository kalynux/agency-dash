// Proving a phone number with a six-digit WhatsApp code —
// `/api/me/phone/verify/*`.
//
// Role-agnostic and mounted beside the `/api/me/phone` contact-change verbs,
// because it is the same subject reached by a different proof. Read
// `phone-verification.types.ts` first: the number being verified is chosen by
// the SERVER, and this is the only proof a dashboard role can actually complete.
//
// See api-doc/me/phone-verification.md.

import { api } from './api';
import type {
  PhoneVerificationConfirmResponse,
  PhoneVerificationConfirmResult,
  PhoneVerificationRequestResponse,
  PhoneVerificationRequestResult,
  PhoneVerificationState,
  PhoneVerificationStateResponse,
} from '@/types/phone-verification.types';

export const phoneVerificationService = {
  /**
   * GET /me/phone/verify — what is verifiable, and whether a code is in flight.
   *
   * Free and side-effect-free, unlike {@link request}: it mints nothing and
   * spends no cooldown, so it is the right call on mount. `pending` can be true
   * for a code requested on another device.
   */
  async getState(): Promise<PhoneVerificationState> {
    const res = await api.get<PhoneVerificationStateResponse>('/me/phone/verify');
    return res.data;
  },

  /**
   * POST /me/phone/verify/request — send a code. **No body.**
   *
   * The target is the pending number if a change is in flight, otherwise the
   * current one; the caller does not choose. Spends the account-scoped resend
   * cooldown, so never call it to "refresh" state — that is {@link getState}.
   */
  async request(): Promise<PhoneVerificationRequestResult> {
    const res = await api.post<PhoneVerificationRequestResponse>('/me/phone/verify/request');
    return res.data;
  },

  /**
   * POST /me/phone/verify/confirm — spend the code.
   *
   * ⚠ **The body is `.strict()` and accepts only `code`.** Sending the phone
   * number alongside it is a 400, not a silently-stripped field: the number was
   * fixed when the code was minted, and a caller that could name it could prove
   * control of one number and have another marked verified.
   */
  async confirm(code: string): Promise<PhoneVerificationConfirmResult> {
    const res = await api.post<PhoneVerificationConfirmResponse>('/me/phone/verify/confirm', {
      code,
    });
    return res.data;
  },
};
