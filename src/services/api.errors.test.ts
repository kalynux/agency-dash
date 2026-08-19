/**
 * Terminal vs. recoverable auth errors — the P1.4 table, plus the error builder
 * that feeds it. (CAPACITOR-PLAN.md P1.12)
 *
 * `classifyAuthError` is the single decision that separates "refresh and carry
 * on" from "sign this person out". It is pure, so it is testable without a
 * network, a browser, or React — which is the whole point of having pulled it
 * out of `request()`.
 */
import { describe, it, expect } from 'vitest';
import { classifyAuthError } from './api';
import { buildApiError } from './http';
import { ApiError, TERMINAL_AUTH_CODES } from '@/types/api';

function err(status: number, code: string): ApiError {
    return new ApiError(status, code, 'test');
}

// ─── The table ────────────────────────────────────────────────────────────────

describe('classifyAuthError', () => {
    it('refreshes on AUTH_TOKEN_EXPIRED - the only recoverable auth failure', () => {
        expect(classifyAuthError(err(401, 'AUTH_TOKEN_EXPIRED'))).toBe('refresh');
    });

    it.each([...TERMINAL_AUTH_CODES])('signs out on %s', (code) => {
        // 403 for AUTH_ACCOUNT_SUSPENDED, 401 for the rest; the decision is keyed
        // on the code precisely so the status does not have to be enumerated.
        const status = code === 'AUTH_ACCOUNT_SUSPENDED' ? 403 : 401;
        expect(classifyAuthError(err(status, code))).toBe('signOut');
    });

    it('signs out on an unrecognised 401', () => {
        // Deliberate: propagating would leave the app running against a
        // credential the server keeps refusing - every screen erroring, nothing
        // routing to login, no way out but a manual reload.
        expect(classifyAuthError(err(401, 'SOMETHING_NEW'))).toBe('signOut');
    });

    it('does NOT sign out on 429', () => {
        // A rate-limited client still has a valid session. Signing it out would
        // punish the user for the ceiling.
        expect(classifyAuthError(err(429, 'RATE_LIMIT_EXCEEDED'))).toBe('propagate');
    });

    it('does not sign out on a 429 that arrives with only the code', () => {
        expect(classifyAuthError(err(200, 'RATE_LIMIT_EXCEEDED'))).toBe('propagate');
    });

    it('leaves an ordinary 403 alone - it is about a resource, not the session', () => {
        expect(classifyAuthError(err(403, 'AGENCY_NOT_AUTHORIZED'))).toBe('propagate');
    });

    it.each([
        [404, 'NOT_FOUND'],
        [409, 'VERSION_CONFLICT'],
        [400, 'VALIDATION_ERROR'],
        [500, 'INTERNAL_ERROR'],
    ])('propagates %i %s', (status, code) => {
        expect(classifyAuthError(err(status, code))).toBe('propagate');
    });
});

// ─── Sessionless requests ─────────────────────────────────────────────────────

describe('classifyAuthError on a request that carried no session', () => {
    it('propagates a bad-credentials 401 instead of signing anyone out', () => {
        // Login answers 401 AUTH_INVALID_CREDENTIALS. Under the default table a
        // mistyped password would destroy the session of whoever was already
        // signed in and bounce them to a login screen, instead of showing
        // "wrong password" in the form they are looking at.
        expect(
            classifyAuthError(err(401, 'AUTH_INVALID_CREDENTIALS'), { carriesSession: false }),
        ).toBe('propagate');
    });

    it('does not try to refresh either - there is nothing to refresh', () => {
        expect(
            classifyAuthError(err(401, 'AUTH_TOKEN_EXPIRED'), { carriesSession: false }),
        ).toBe('propagate');
    });

    it('propagates even a terminal code from a sessionless endpoint', () => {
        expect(
            classifyAuthError(err(401, 'AUTH_USER_NOT_FOUND'), { carriesSession: false }),
        ).toBe('propagate');
    });

    it('classifies normally when the flag is absent or true', () => {
        expect(classifyAuthError(err(401, 'AUTH_TOKEN_EXPIRED'), {})).toBe('refresh');
        expect(classifyAuthError(err(401, 'AUTH_TOKEN_EXPIRED'), { carriesSession: true })).toBe(
            'refresh',
        );
    });
});

// ─── The error builder ────────────────────────────────────────────────────────

function response(body: unknown, status: number, headers: Record<string, string> = {}): Response {
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    });
}

describe('buildApiError', () => {
    it('reads the documented envelope', async () => {
        const e = await buildApiError(
            response(
                {
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Bad Request',
                        details: { fields: [{ path: 'phone', message: 'required' }] },
                        category: 'validation',
                    },
                },
                400,
            ),
        );
        expect(e.code).toBe('VALIDATION_ERROR');
        expect(e.status).toBe(400);
        expect(e.category).toBe('validation');
        expect(e.fieldErrors()).toEqual({ phone: 'required' });
    });

    it('takes Retry-After from the header, in seconds', async () => {
        // The header is what lets a client slow down before it is refused again,
        // which is what keeps a dashboard's concurrent polls from storming the
        // very bucket that is already full.
        const e = await buildApiError(
            response({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'slow down' } }, 429, {
                'Retry-After': '42',
            }),
        );
        expect(e.retryAfterSeconds).toBe(42);
        expect(e.isRateLimited).toBe(true);
    });

    it('falls back to details.retryAfterSeconds when the header is absent', async () => {
        const e = await buildApiError(
            response(
                {
                    error: {
                        code: 'RATE_LIMIT_EXCEEDED',
                        message: 'slow down',
                        details: { retryAfterSeconds: 30 },
                    },
                },
                429,
            ),
        );
        expect(e.retryAfterSeconds).toBe(30);
    });

    it('ignores an unparseable Retry-After rather than producing NaN', async () => {
        const e = await buildApiError(
            response({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'x' } }, 429, {
                'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT',
            }),
        );
        expect(e.retryAfterSeconds).toBeUndefined();
    });

    it('keeps X-Request-Id - on a masked 5xx it is the only handle anyone has', async () => {
        const e = await buildApiError(
            response({ error: { code: 'INTERNAL_ERROR', message: 'oops', category: 'internal' } }, 500, {
                'X-Request-Id': 'req-123',
            }),
        );
        expect(e.requestId).toBe('req-123');
        expect(e.isOpaque).toBe(true);
    });

    it('survives a non-JSON body', async () => {
        const e = await buildApiError(new Response('<html>502</html>', { status: 502 }));
        expect(e.status).toBe(502);
        expect(e.code).toBe('502');
        expect(e.message).toContain('502');
    });
});
