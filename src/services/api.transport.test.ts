/**
 * Transport resilience — the timeout and the read-only retry in `api.ts`.
 *
 * These exist because of a real on-device failure: a phone talking to a dev
 * machine over a relayed tailnet dropped the occasional packet, and one dropped
 * packet was enough to put "We couldn't reach the server" on the screen. The
 * two properties worth pinning down are the two that could do damage if they
 * drifted — that a read IS retried, and that a write is NOT.
 *
 * `fetch` is stubbed; nothing here touches the network. The auth strategy is
 * mocked to the cookie shape so the request path needs no token store.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiError } from '@/types/api';

vi.mock('@/platform/auth/strategy', () => ({
    authStrategy: {
        mode: 'cookie',
        authHeaders: async () => ({}),
        credentials: 'include',
        refresh: async () => {},
        captureTokens: async () => {},
        canAttemptSession: async () => true,
        endSession: async () => {},
        paths: {
            login: '/auth/login',
            register: '/auth/register',
            addRole: '/auth/add-role',
            authMe: (role: string) => `/auth/me?role=${role}`,
        },
    },
}));

vi.mock('@/platform/auth/refreshScheduler', () => ({
    refreshSession: async () => {},
}));

import { api } from './api';

function ok(body: unknown = { ok: true }): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

/** What `fetch` rejects with for any transport-level failure. */
function transportFailure(): TypeError {
    return new TypeError('Failed to fetch');
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // The retry path consults this before spending its backoff.
    vi.stubGlobal('navigator', { onLine: true });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

// ─── Reads are retried ────────────────────────────────────────────────────────

describe('a GET on a flaky transport', () => {
    it('retries and succeeds when the first attempt drops', async () => {
        fetchMock.mockRejectedValueOnce(transportFailure()).mockResolvedValueOnce(ok({ n: 1 }));

        const promise = api.get<{ n: number }>('/shipments');
        await vi.runAllTimersAsync();

        expect(await promise).toEqual({ n: 1 });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('gives up after three attempts and reports the network failure', async () => {
        fetchMock.mockRejectedValue(transportFailure());

        const promise = api.get('/shipments');
        // Attach the rejection handler before advancing, or the interim
        // rejection is unhandled for a tick and Node reports it.
        const settled = expect(promise).rejects.toBeInstanceOf(TypeError);
        await vi.runAllTimersAsync();
        await settled;

        // Two backoffs, three attempts — the bound the constant promises.
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('does not spend its backoff while the device is offline', async () => {
        vi.stubGlobal('navigator', { onLine: false });
        fetchMock.mockRejectedValue(transportFailure());

        const promise = api.get('/shipments');
        const settled = expect(promise).rejects.toBeInstanceOf(TypeError);
        await vi.runAllTimersAsync();
        await settled;

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

// ─── Writes are not ───────────────────────────────────────────────────────────

describe('a write on a flaky transport', () => {
    // The one that matters. `fetch` rejecting says the RESPONSE never arrived —
    // not that the request didn't. A retried POST that the server had already
    // processed books the shipment twice, and the user saw an error.
    it.each([
        ['post', () => api.post('/shipments', { id: 1 })],
        ['patch', () => api.patch('/shipments/1', { id: 1 })],
        ['put', () => api.put('/shipments/1', { id: 1 })],
        ['delete', () => api.delete('/shipments/1')],
    ])('never repeats a %s', async (_label, call) => {
        fetchMock.mockRejectedValue(transportFailure());

        const promise = call();
        const settled = expect(promise).rejects.toBeInstanceOf(TypeError);
        await vi.runAllTimersAsync();
        await settled;

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

// ─── The timeout ──────────────────────────────────────────────────────────────

/**
 * A connection that has gone quiet: nothing ever comes back, and the only thing
 * that can end it is the signal. Modelled the way `fetch` really behaves —
 * rejecting with an `AbortError` once its signal aborts — because that rejection
 * is the entire mechanism under test.
 */
function stalledFetch(onSignal?: (signal: AbortSignal | undefined) => void) {
    return (_url: string, init: RequestInit) => {
        onSignal?.(init.signal ?? undefined);
        return new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
                reject(new DOMException('The operation was aborted.', 'AbortError')),
            );
        });
    };
}

describe('a stalled connection', () => {
    it('is abandoned rather than left to hang, and reads as a network error', async () => {
        fetchMock.mockImplementation(stalledFetch());

        const promise = api.post('/shipments', {});
        // `NETWORK_ERROR` is the same copy `getApiErrorMessage` gives a raw
        // TypeError, so a timeout reads to the user like a refused connection.
        const settled = expect(promise).rejects.toMatchObject({
            name: 'ApiError',
            code: 'NETWORK_ERROR',
        });
        await vi.advanceTimersByTimeAsync(31_000);
        await settled;

        await expect(promise).rejects.toBeInstanceOf(ApiError);
    });

    it('aborts the underlying request so the socket is not left open', async () => {
        let seen: AbortSignal | undefined;
        fetchMock.mockImplementation(stalledFetch((signal) => (seen = signal)));

        const promise = api.post('/shipments', {});
        const settled = expect(promise).rejects.toBeInstanceOf(ApiError);
        await vi.advanceTimersByTimeAsync(31_000);
        await settled;

        expect(seen?.aborted).toBe(true);
    });

    it('retries a stalled READ before giving up', async () => {
        fetchMock
            .mockImplementationOnce(stalledFetch())
            .mockResolvedValueOnce(ok({ n: 1 }));

        const promise = api.get<{ n: number }>('/shipments');
        await vi.advanceTimersByTimeAsync(31_000);
        await vi.runAllTimersAsync();

        expect(await promise).toEqual({ n: 1 });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('clears its timer on the success path', async () => {
        fetchMock.mockResolvedValue(ok());
        const clear = vi.spyOn(globalThis, 'clearTimeout');

        await api.get('/shipments');

        // Left uncleared, every completed request would hold a live 30s timer.
        expect(clear).toHaveBeenCalled();
    });
});
