/**
 * Auth strategy — selection, path resolution, and the refresh contract.
 * (CAPACITOR-PLAN.md P1.12)
 *
 * `fetch` is stubbed; nothing here touches the network or React. The tests that
 * matter most are the two the plan calls out in bold: a mobile refresh must
 * store BOTH returned tokens, and refresh success must be read from the HTTP
 * status rather than by comparing token strings.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiError, type AuthTokens } from '@/types/api';

// Hoisted above the imports so the `vi.mock` factory below can close over it.
// The real module picks its store from `useBearerAuth`, which is false in a test
// run — that would hand the bearer strategy the no-op store and quietly make
// every "did it persist?" assertion pass for the wrong reason.
const { fakeStore, storeState } = vi.hoisted(() => {
    const state: { tokens: (AuthTokens & { accessExpiresAt: number }) | null } = { tokens: null };
    return {
        storeState: state,
        fakeStore: {
            get: async () => state.tokens,
            set: async (t: AuthTokens) => {
                state.tokens = { ...t, accessExpiresAt: Date.now() + t.accessExpiresIn * 1000 };
            },
            clear: async () => {
                state.tokens = null;
            },
        },
    };
});

vi.mock('./tokenStore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./tokenStore')>();
    // Swap only the active store; the shape guards are real, because the
    // strategy's handling of a bad envelope is part of what is under test.
    return { ...actual, tokenStore: fakeStore };
});

import { cookieAuthStrategy, bearerAuthStrategy } from './strategy';

const WIRE: AuthTokens = {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    accessExpiresIn: 900,
    refreshExpiresIn: 2_592_000,
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
    storeState.tokens = null;
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

// ─── Path resolution ──────────────────────────────────────────────────────────

describe('path resolution', () => {
    it('routes the cookie transport at the base namespace', () => {
        expect(cookieAuthStrategy.paths.login).toBe('/auth/login');
        expect(cookieAuthStrategy.paths.register).toBe('/auth/register');
        expect(cookieAuthStrategy.paths.addRole).toBe('/auth/add-role');
        expect(cookieAuthStrategy.paths.authMe('agency')).toBe('/auth/auth-me/agency');
    });

    it('routes the bearer transport at the mobile namespace', () => {
        // The namespace IS the transport switch - there is no marker header.
        expect(bearerAuthStrategy.paths.login).toBe('/auth/mobile/login');
        expect(bearerAuthStrategy.paths.register).toBe('/auth/mobile/register');
        expect(bearerAuthStrategy.paths.addRole).toBe('/auth/mobile/add-role');
        expect(bearerAuthStrategy.paths.authMe('agency')).toBe('/auth/mobile/auth-me/agency');
    });

    it('interpolates the role rather than hardcoding agency', () => {
        expect(bearerAuthStrategy.paths.authMe('vendor')).toBe('/auth/mobile/auth-me/vendor');
    });
});

// ─── Credentials and headers ──────────────────────────────────────────────────

describe('credentials and headers', () => {
    it('sends cookies on the cookie transport and none on bearer', () => {
        expect(cookieAuthStrategy.credentials).toBe('include');
        // Not 'same-origin': under a custom Capacitor hostname every API call is
        // cross-origin, and this transport carries no cookies at all.
        expect(bearerAuthStrategy.credentials).toBe('omit');
    });

    it('adds no auth header on the cookie transport', async () => {
        expect(await cookieAuthStrategy.authHeaders()).toEqual({});
    });

    it('adds the bearer header from the stored access token', async () => {
        await fakeStore.set(WIRE);
        expect(await bearerAuthStrategy.authHeaders()).toEqual({
            Authorization: 'Bearer access-1',
        });
    });

    it('adds no header when the store is empty - login is unauthenticated', async () => {
        expect(await bearerAuthStrategy.authHeaders()).toEqual({});
    });
});

// ─── Cookie refresh ───────────────────────────────────────────────────────────

describe('cookieAuthStrategy.refresh', () => {
    it('posts JSON content-type to /auth/browser/refresh', async () => {
        mockFetch.mockResolvedValue(jsonResponse({ success: true }));
        await cookieAuthStrategy.refresh();

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        // There is no /auth/refresh, and the whole /auth/browser/* namespace sits
        // behind requireJsonContent - without the header every silent refresh
        // fails with 400 VALIDATION_ERROR.
        expect(url).toContain('/auth/browser/refresh');
        expect(init.method).toBe('POST');
        expect(init.credentials).toBe('include');
        expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    });

    it('throws an ApiError carrying the server code on failure', async () => {
        mockFetch.mockResolvedValue(
            jsonResponse({ error: { code: 'AUTH_SESSION_EXPIRED', message: 'gone' } }, 401),
        );
        await expect(cookieAuthStrategy.refresh()).rejects.toMatchObject({
            code: 'AUTH_SESSION_EXPIRED',
            status: 401,
        });
    });
});

// ─── Bearer refresh ───────────────────────────────────────────────────────────

describe('bearerAuthStrategy.refresh', () => {
    it('fails as AUTH_MISSING_TOKEN without spending a request', async () => {
        // Same code the server would have used, so the caller's error table needs
        // no special case for "we never had a token".
        await expect(bearerAuthStrategy.refresh()).rejects.toMatchObject({
            code: 'AUTH_MISSING_TOKEN',
            status: 401,
        });
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('presents the refresh token, never the access token', async () => {
        await fakeStore.set(WIRE);
        mockFetch.mockResolvedValue(jsonResponse({ data: { tokens: { ...WIRE } } }));
        await bearerAuthStrategy.refresh();

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/auth/mobile/refresh');
        expect(init.credentials).toBe('omit');
        // Posting the access token here is refused with
        // AUTH_REFRESH_TOKEN_INVALID - which is what that code almost always
        // means in development.
        expect(JSON.parse(String(init.body))).toEqual({ refreshToken: 'refresh-1' });
    });

    it('stores BOTH returned tokens - this is the sliding 30-day window', async () => {
        await fakeStore.set(WIRE);
        mockFetch.mockResolvedValue(
            jsonResponse({
                data: {
                    tokens: {
                        accessToken: 'access-2',
                        refreshToken: 'refresh-2',
                        accessExpiresIn: 900,
                        refreshExpiresIn: 2_592_000,
                    },
                },
            }),
        );
        await bearerAuthStrategy.refresh();

        expect(storeState.tokens?.accessToken).toBe('access-2');
        // Keeping the old refresh token is the silent failure the plan calls out:
        // the session then hard-expires 30 days after login instead of 30 days
        // after last use, and the user is signed out mid-work a month later.
        expect(storeState.tokens?.refreshToken).toBe('refresh-2');
    });

    it('treats a byte-identical pair as success, because it reads the status', async () => {
        // A JWT's `iat` is in whole seconds, so two mints in the same second are
        // identical. Comparing token strings would report this as a failure.
        await fakeStore.set(WIRE);
        mockFetch.mockResolvedValue(jsonResponse({ data: { tokens: { ...WIRE } } }));
        await expect(bearerAuthStrategy.refresh()).resolves.toBeUndefined();
        expect(storeState.tokens?.accessToken).toBe('access-1');
    });

    it('rejects a 200 that carries no usable pair', async () => {
        await fakeStore.set(WIRE);
        mockFetch.mockResolvedValue(jsonResponse({ data: {} }));
        // Otherwise we retry forever on the old, expired access token.
        await expect(bearerAuthStrategy.refresh()).rejects.toMatchObject({
            code: 'REFRESH_FAILED',
        });
    });

    it('propagates the server error code on a failed refresh', async () => {
        await fakeStore.set(WIRE);
        mockFetch.mockResolvedValue(
            jsonResponse({ error: { code: 'AUTH_REFRESH_TOKEN_INVALID', message: 'no' } }, 401),
        );
        const err = await bearerAuthStrategy.refresh().catch((e: unknown) => e);
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).code).toBe('AUTH_REFRESH_TOKEN_INVALID');
    });
});

// ─── captureTokens ────────────────────────────────────────────────────────────

describe('captureTokens', () => {
    it('is inert on the cookie transport', async () => {
        await cookieAuthStrategy.captureTokens(WIRE);
        expect(storeState.tokens).toBeNull();
    });

    it('stores a usable envelope on bearer', async () => {
        await bearerAuthStrategy.captureTokens(WIRE);
        expect(storeState.tokens?.accessToken).toBe('access-1');
    });

    it('ignores an absent envelope - cookie responses simply have none', async () => {
        await bearerAuthStrategy.captureTokens(undefined);
        expect(storeState.tokens).toBeNull();
    });

    it('drops an unusable envelope loudly rather than storing it', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await bearerAuthStrategy.captureTokens({ accessToken: 'orphan' } as unknown as AuthTokens);
        // Storing it would break the NEXT request instead of this one.
        expect(storeState.tokens).toBeNull();
        expect(spy).toHaveBeenCalled();
    });
});

// ─── Session probing and teardown ─────────────────────────────────────────────

describe('canAttemptSession', () => {
    it('is always true on cookies - httpOnly cookies are invisible to script', async () => {
        expect(await cookieAuthStrategy.canAttemptSession()).toBe(true);
    });

    it('follows the token store on bearer', async () => {
        expect(await bearerAuthStrategy.canAttemptSession()).toBe(false);
        await fakeStore.set(WIRE);
        expect(await bearerAuthStrategy.canAttemptSession()).toBe(true);
    });
});

describe('endSession', () => {
    it('asks the server on cookies - only it can clear an httpOnly cookie', async () => {
        mockFetch.mockResolvedValue(jsonResponse({ success: true }));
        await cookieAuthStrategy.endSession();
        expect(String(mockFetch.mock.calls[0][0])).toContain('/auth/logout');
    });

    it('never throws on cookies, even when the network is gone', async () => {
        mockFetch.mockRejectedValue(new Error('offline'));
        // The caller is already on its way to the login screen.
        await expect(cookieAuthStrategy.endSession()).resolves.toBeUndefined();
    });

    it('discards the tokens on bearer without a server call', async () => {
        await fakeStore.set(WIRE);
        await bearerAuthStrategy.endSession();
        expect(storeState.tokens).toBeNull();
        expect(mockFetch).not.toHaveBeenCalled();
    });
});

// ─── Strategy selection ───────────────────────────────────────────────────────

describe('strategy selection', () => {
    afterEach(() => {
        vi.doUnmock('../env');
        vi.resetModules();
    });

    it('picks the bearer strategy when the bearer transport is active', async () => {
        vi.resetModules();
        vi.doMock('../env', () => ({
            isNative: false,
            platform: 'web',
            forceMobileAuth: true,
            useBearerAuth: true,
        }));
        const mod = await import('./strategy');
        expect(mod.authStrategy.mode).toBe('bearer');
        expect(mod.authStrategy.paths.login).toBe('/auth/mobile/login');
    });

    it('picks the cookie strategy otherwise', async () => {
        vi.resetModules();
        vi.doMock('../env', () => ({
            isNative: false,
            platform: 'web',
            forceMobileAuth: false,
            useBearerAuth: false,
        }));
        const mod = await import('./strategy');
        expect(mod.authStrategy.mode).toBe('cookie');
        expect(mod.authStrategy.paths.login).toBe('/auth/login');
    });
});
