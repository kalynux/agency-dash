/**
 * Credential replacement — `replaceCredential` and the replay rule in `api.ts`.
 *
 * On the bearer transport a password change revokes the pair this device holds
 * and hands nothing back, so `authService.changePassword` signs in again. Any
 * request still riding the old pair in that window is refused with the terminal
 * `AUTH_PASSWORD_CHANGED`. The property worth pinning down is the boundary: a
 * refusal of a credential we have since REPLACED is replayed, while a refusal of
 * the one still in hand signs out exactly as it always did.
 *
 * `fetch` is stubbed and the strategy is a bearer shape whose token the test
 * swaps by hand. `window` is a bare EventTarget so `auth:logout` can be observed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiError } from '@/types/api';

const auth = vi.hoisted(() => ({ token: 'old' }));

vi.mock('@/platform/auth/strategy', () => ({
    authStrategy: {
        mode: 'bearer',
        authHeaders: async () => ({ Authorization: `Bearer ${auth.token}` }),
        credentials: 'omit',
        refresh: async () => {},
        captureTokens: async () => {},
        canAttemptSession: async () => true,
        endSession: async () => {},
        reissuedOnPasswordChange: false,
        paths: {
            login: '/auth/mobile/login',
            register: '/auth/mobile/register',
            addRole: '/auth/mobile/add-role',
            authMe: (role: string) => `/auth/mobile/auth-me/${role}`,
        },
    },
}));

vi.mock('@/platform/auth/refreshScheduler', () => ({
    refreshSession: async () => {},
}));

import { api, replaceCredential } from './api';

function ok(body: unknown = { ok: true }): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

function passwordChanged(): Response {
    return new Response(
        JSON.stringify({
            success: false,
            error: {
                code: 'AUTH_PASSWORD_CHANGED',
                message: 'Password changed',
                statusCode: 401,
                category: 'authentication',
            },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
}

/** The `Authorization` header each `fetch` call carried, in order. */
function sentTokens(fetchMock: ReturnType<typeof vi.fn>): string[] {
    return fetchMock.mock.calls.map(
        ([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers.Authorization,
    );
}

let fetchMock: ReturnType<typeof vi.fn>;
let logouts: string[];

beforeEach(() => {
    auth.token = 'old';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { onLine: true });

    const target = new EventTarget();
    logouts = [];
    target.addEventListener('auth:logout', (e) => {
        logouts.push((e as CustomEvent<{ code?: string } | undefined>).detail?.code ?? '');
    });
    vi.stubGlobal('window', target);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('a request refused while the credential is being replaced', () => {
    it('is replayed with the new credential instead of signing out', async () => {
        fetchMock.mockResolvedValueOnce(passwordChanged()).mockResolvedValueOnce(ok({ n: 1 }));

        let finishSwap!: () => void;
        const swap = replaceCredential(
            () =>
                new Promise<void>((resolve) => {
                    finishSwap = () => {
                        auth.token = 'new';
                        resolve();
                    };
                }),
        );

        const request = api.get<{ n: number }>('/shipments');
        // Let the refusal arrive and park on the swap, then complete it.
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        finishSwap();
        await swap;

        expect(await request).toEqual({ n: 1 });
        expect(sentTokens(fetchMock)).toEqual(['Bearer old', 'Bearer new']);
        expect(logouts).toEqual([]);
    });

    it('is a verdict when the replay is refused too', async () => {
        fetchMock.mockImplementation(async () => passwordChanged());

        const swap = replaceCredential(async () => {
            auth.token = 'new';
        });
        await swap;

        // Sent with the old pair before the swap, answered after it.
        auth.token = 'old';
        const request = api.get('/shipments');
        auth.token = 'new';

        await expect(request).rejects.toMatchObject({ code: 'AUTH_PASSWORD_CHANGED' });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(logouts).toEqual(['AUTH_PASSWORD_CHANGED']);
    });
});

describe('a refusal of the credential still in hand', () => {
    it('signs out exactly as before — no swap, no replay', async () => {
        fetchMock.mockImplementation(async () => passwordChanged());

        await expect(api.get('/shipments')).rejects.toBeInstanceOf(ApiError);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(logouts).toEqual(['AUTH_PASSWORD_CHANGED']);
    });

    it('signs out when the swap failed and nothing was replaced', async () => {
        fetchMock.mockImplementation(async () => passwordChanged());

        const swap = replaceCredential(async () => {
            throw new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'nope');
        });
        const request = api.get('/shipments');
        // Both handlers attached before either settles, so neither rejection is
        // ever unhandled for a tick.
        const swapSettled = expect(swap).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
        const requestSettled = expect(request).rejects.toMatchObject({ code: 'AUTH_PASSWORD_CHANGED' });
        await swapSettled;
        await requestSettled;
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(logouts).toEqual(['AUTH_PASSWORD_CHANGED']);
    });
});
