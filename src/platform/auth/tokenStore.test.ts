/**
 * Token store — expiry arithmetic and the shape guards. (CAPACITOR-PLAN.md P1.12)
 *
 * Pure logic only: no components, no network. What is under test here is the
 * arithmetic the Phase 2 refresh scheduler will depend on, and the two guards
 * that stand between a malformed payload and an app that sends
 * `Authorization: Bearer undefined` on every request.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    stampExpiry,
    isUsableTokens,
    isUsableWireTokens,
    noopTokenStore,
    type StoredTokens,
} from './tokenStore';
import type { AuthTokens } from '@/types/api';

const WIRE: AuthTokens = {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    accessExpiresIn: 900,
    refreshExpiresIn: 2_592_000,
};

// ─── stampExpiry ──────────────────────────────────────────────────────────────

describe('stampExpiry', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('converts the duration to an absolute instant at the moment of receipt', () => {
        // 900s is the documented access lifetime; the point is that seconds
        // become milliseconds, which is the easiest thing in this file to get
        // wrong by a factor of 1000 and the hardest to notice.
        expect(stampExpiry(WIRE).accessExpiresAt).toBe(Date.parse('2026-01-01T00:15:00.000Z'));
    });

    it('carries the wire pair through untouched', () => {
        const stamped = stampExpiry(WIRE);
        expect(stamped.accessToken).toBe('access-1');
        expect(stamped.refreshToken).toBe('refresh-1');
        expect(stamped.refreshExpiresIn).toBe(2_592_000);
    });

    it('stamps against the clock at receipt, not at storage', () => {
        const early = stampExpiry(WIRE);
        vi.advanceTimersByTime(60_000);
        const late = stampExpiry(WIRE);
        expect(late.accessExpiresAt - early.accessExpiresAt).toBe(60_000);
    });
});

// ─── Shape guards ─────────────────────────────────────────────────────────────

describe('isUsableWireTokens', () => {
    it('accepts a complete envelope', () => {
        expect(isUsableWireTokens(WIRE)).toBe(true);
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['a string', 'nope'],
        ['an empty object', {}],
        ['a missing refresh token', { ...WIRE, refreshToken: undefined }],
        ['an empty access token', { ...WIRE, accessToken: '' }],
        ['a numeric access token', { ...WIRE, accessToken: 12 }],
    ])('rejects %s', (_label, value) => {
        expect(isUsableWireTokens(value)).toBe(false);
    });

    it('rejects a missing accessExpiresIn - it is the input to stampExpiry', () => {
        // Without this the stamp is NaN, NaN compares false against every
        // deadline, and the proactive scheduler simply never fires.
        const rest = { ...WIRE, accessExpiresIn: undefined };
        expect(isUsableWireTokens(rest)).toBe(false);
        expect(isUsableWireTokens({ ...WIRE, accessExpiresIn: Number.NaN })).toBe(false);
    });
});

describe('isUsableTokens', () => {
    it('accepts a stamped pair', () => {
        expect(isUsableTokens(stampExpiry(WIRE))).toBe(true);
    });

    it('rejects a wire pair that was never stamped', () => {
        // Written by a build from before expiry tracking existed. JSON.parse is
        // perfectly happy with it; the request path is not.
        expect(isUsableTokens(WIRE)).toBe(false);
    });

    it('rejects a NaN expiry', () => {
        expect(isUsableTokens({ ...stampExpiry(WIRE), accessExpiresAt: Number.NaN })).toBe(false);
    });

    it('rejects a half-written entry', () => {
        const partial: Partial<StoredTokens> = { accessToken: 'a', accessExpiresAt: 1 };
        expect(isUsableTokens(partial)).toBe(false);
    });
});

// ─── noop (cookie) store ──────────────────────────────────────────────────────

describe('noopTokenStore', () => {
    it('holds nothing and never throws - the cookie path has no tokens to keep', async () => {
        await expect(noopTokenStore.set(WIRE)).resolves.toBeUndefined();
        await expect(noopTokenStore.get()).resolves.toBeNull();
        await expect(noopTokenStore.clear()).resolves.toBeUndefined();
    });
});

// ─── dev store (VITE_FORCE_MOBILE_AUTH) ───────────────────────────────────────

/** Minimal in-memory stand-in - the node test environment has no sessionStorage. */
function fakeStorage() {
    const map = new Map<string, string>();
    return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => {
            map.set(k, v);
        },
        removeItem: (k: string) => {
            map.delete(k);
        },
        raw: map,
    };
}

/** Fresh module instance per test - the store caches in module scope. */
async function freshDevStore() {
    vi.resetModules();
    return (await import('./tokenStore')).devTokenStore;
}

describe('devTokenStore', () => {
    let storage: ReturnType<typeof fakeStorage>;

    beforeEach(() => {
        storage = fakeStorage();
        vi.stubGlobal('sessionStorage', storage);
    });
    afterEach(() => vi.unstubAllGlobals());

    it('round-trips a stamped pair through the memory cache', async () => {
        const store = await freshDevStore();
        await store.set(WIRE);
        const got = await store.get();
        expect(got?.accessToken).toBe('access-1');
        expect(got?.accessExpiresAt).toBeGreaterThan(Date.now());
    });

    it('hydrates from storage, so a page reload does not sign you out', async () => {
        const first = await freshDevStore();
        await first.set(WIRE);

        // A new module instance is the reload: memory is empty, storage is not.
        const reloaded = await freshDevStore();
        expect((await reloaded.get())?.refreshToken).toBe('refresh-1');
    });

    it('ignores a malformed stored payload instead of authenticating with it', async () => {
        storage.raw.set('wi-agency:dev-tokens', '{"accessToken":"orphan"}');
        const store = await freshDevStore();
        // The alternative is `Bearer undefined` on every request - a 401 loop
        // from a store that reports itself as holding a session.
        expect(await store.get()).toBeNull();
    });

    it('ignores unparseable text', async () => {
        storage.raw.set('wi-agency:dev-tokens', 'not json');
        const store = await freshDevStore();
        expect(await store.get()).toBeNull();
    });

    it('clear() empties memory and storage together', async () => {
        const store = await freshDevStore();
        await store.set(WIRE);
        await store.clear();
        expect(await store.get()).toBeNull();
        expect(storage.raw.size).toBe(0);
    });

    it('survives unwritable storage - a memory-only session still works', async () => {
        vi.stubGlobal('sessionStorage', {
            getItem: () => {
                throw new Error('private mode');
            },
            setItem: () => {
                throw new Error('private mode');
            },
            removeItem: () => {
                throw new Error('private mode');
            },
        });
        const store = await freshDevStore();
        await store.set(WIRE);
        expect((await store.get())?.accessToken).toBe('access-1');
    });
});
