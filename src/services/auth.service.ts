import { api } from './api';
import { authStrategy } from '@/platform/auth/strategy';
import { startRefreshScheduler, stopRefreshScheduler } from '@/platform/auth/refreshScheduler';
import { ApiError, type AgencyAuthResponse, type AuthMeAgencyResponse } from '@/types/api';

/**
 * Every endpoint whose path differs between the cookie and bearer transports is
 * read off `authStrategy.paths`, so one implementation serves both. The rest of
 * this file (`forgot-password`, `reset-password`, `/me/password`,
 * `send-email-verification`) lives in the base namespace and is identical either
 * way. See CAPACITOR-PLAN.md → P1.7.
 */

/** `identifier` is a phone in E.164 **or** an email — the server picks by the `@`. */
export interface AgencyLoginInput {
    identifier: string;
    password: string;
}

export interface AgencyRegisterInput {
    /** E.164. The account's unique key; validated against the country's plan client-side. */
    phone: string;
    /** The person, min 2 chars. Lands on the role profile as its display name. */
    name: string;
    /** The business. Seeds `Magazin.name` on a separate document — 2–100 enforced client-side. */
    agency_name: string;
    /** Min 6 — registration's rule, which is looser than password reset's. */
    password: string;
    /** Optional for agencies; required for vendors only. */
    email?: string;
}

/**
 * Take the tokens off any response that carried them, then confirm we actually
 * hold a session.
 *
 * The confirmation is not paranoia about the happy path: on the bearer transport
 * the ONLY thing that makes a 200 a signed-in state is the `tokens` envelope, so
 * a response that omitted it would otherwise produce a "successful" login into an
 * app that behaves as signed-out — a bug that shows up one screen later, far from
 * its cause. On cookies `canAttemptSession()` is always true, so this is inert.
 */
async function captureSession(res: AgencyAuthResponse): Promise<AgencyAuthResponse> {
    await authStrategy.captureTokens(res.data?.tokens);
    if (!(await authStrategy.canAttemptSession())) {
        // Client-minted: no server said this. The status was a success.
        throw new ApiError(
            500,
            'AUTH_NO_SESSION',
            'Signed in, but the server returned no session tokens.',
        );
    }
    // The one place a new access-token deadline ever comes into existence —
    // login, register and auth-me all funnel through here — so it is also the
    // only place the proactive refresh timer needs re-arming (P2.5). Idempotent,
    // and inert on cookies, where there is no expiry to schedule against.
    startRefreshScheduler();
    return res;
}

export const authService = {
    /**
     * Sign in as an agency. `role` is fixed — this is the agency dashboard, and
     * omitting it would let a multi-role account land on whichever role the
     * server resolved first.
     *
     * Rate limit: the credential bucket, 20/min/IP. Disable submit while in
     * flight and surface `Retry-After` on 429 — a 429 here is NOT a sign-out
     * (see api.ts → classifyAuthError).
     *
     * Route on `data.role_entity.onboarding_step`: `0` → `/dashboard`, anything
     * else → `/onboarding`.
     */
    login(input: AgencyLoginInput): Promise<AgencyAuthResponse> {
        return api
            .post<AgencyAuthResponse>(authStrategy.paths.login, {
                identifier: input.identifier,
                password: input.password,
                role: 'agency',
            })
            .then(captureSession);
    },

    /**
     * Create an agency account. Answers 201 with the same envelope as login.
     *
     * A fresh agency comes back at `onboarding_step: 1` (logistics), so this
     * flows straight into the existing onboarding subsystem. Phone/WhatsApp
     * verification is NOT part of registration — it already lives in agency
     * settings.
     *
     * `role` is fixed: `RegisterSchema` defaults it to `'vendor'`, so omitting it
     * would silently register the wrong kind of account.
     */
    register(input: AgencyRegisterInput): Promise<AgencyAuthResponse> {
        return api
            .post<AgencyAuthResponse>(authStrategy.paths.register, {
                phone: input.phone,
                name: input.name,
                agency_name: input.agency_name,
                password: input.password,
                // Dropped by JSON.stringify when undefined, which is what the
                // optional-email schema expects — not an empty string.
                email: input.email || undefined,
                role: 'agency',
            })
            .then(captureSession);
    },

    /**
     * Restores the session and returns the envelope containing user +
     * role_entity. Use `data.role_entity.onboarding_step` for routing.
     *
     * This is also the launch-time refresh: the server re-issues BOTH tokens at
     * full lifetime here, which is what restarts the 30-day window. Capturing
     * them is not optional — skip it and a bearer client runs on its login token
     * until that expires, then signs out for no visible reason.
     */
    getAuthMeAgency(): Promise<AuthMeAgencyResponse> {
        return api
            .get<AuthMeAgencyResponse>(authStrategy.paths.authMe('agency'))
            .then(captureSession);
    },

    /**
     * End the session. On cookies only the server can clear an httpOnly cookie,
     * so it is asked; on bearer, discarding the pair IS the logout and there is
     * no call to make. Best-effort in both cases — it never throws.
     *
     * ⚠ Phase 4: unregister the push token BEFORE calling this.
     * `DELETE /agency/devices` authenticates with the credential this destroys.
     */
    logout(): Promise<void> {
        // Before the credential goes, so a timer that is mid-wait cannot fire a
        // refresh against a session we just ended. (The `auth:logout` event does
        // this too, but an explicit logout does not always dispatch one.)
        stopRefreshScheduler();
        return authStrategy.endSession();
    },

    /**
     * POST /auth/forgot-password — email or E.164 phone in one field.
     *
     * **Always answers 200**, whether or not the account exists. Never branch the
     * UI on the response: a different message for "no such account" turns this
     * into an account-enumeration oracle. Show the same "check your messages"
     * screen every time.
     *
     * A malformed identifier is still a 400 — that is a statement about the
     * input, not about who has an account.
     */
    forgotPassword(identifier: string): Promise<{ success: boolean; message?: string }> {
        return api.post<{ success: boolean; message?: string }>('/auth/forgot-password', {
            identifier,
        });
    },

    /**
     * POST /auth/reset-password — completes a reset from the emailed token.
     *
     * ⚠ `newPassword` is held to a **stricter** rule than registration: 8 chars
     * with an upper, a lower, a digit and a symbol (`PasswordStrengthSchema`),
     * against registration's bare min-6. The two genuinely disagree server-side,
     * so mirroring the loose rule client-side would let someone submit a password
     * the API then rejects.
     *
     * Worth telling the user: a successful reset signs out every other device.
     */
    resetPassword(
        token: string,
        newPassword: string,
    ): Promise<{ success: boolean; message?: string }> {
        return api.post<{ success: boolean; message?: string }>('/auth/reset-password', {
            token,
            newPassword,
        });
    },

    /**
     * POST /auth/send-email-verification — email the current role entity a
     * verification link (valid 24h). userId/role are read from the JWT.
     */
    sendEmailVerification(): Promise<{ success: boolean; data: { message: string } }> {
        return api.post<{ success: boolean; data: { message: string } }>('/auth/send-email-verification');
    },

    /**
     * PATCH /me/password — shared, role-agnostic; the password lives on the
     * User record, so one call covers every role. 403 USER_INVALID_PASSWORD
     * when `oldPassword` is wrong.
     *
     * The caller keeps their session: the response carries a fresh credential.
     * Everyone else holding a token for this account is signed out with
     * `AUTH_PASSWORD_CHANGED`.
     */
    changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
        return api.patch<{ success: boolean; message: string }>('/me/password', { oldPassword, newPassword });
    },
};
