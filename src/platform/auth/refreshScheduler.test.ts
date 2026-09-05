/**
 * @vitest-environment jsdom
 *
 * The proactive refresh scheduler (CAPACITOR-PLAN.md P1.12, P2.5).
 *
 * Runs under jsdom rather than node — unlike the other three test files, this
 * module genuinely needs `window` and `document`: it hangs off the `auth:logout`
 * event and the browser's resume signal.
 *
 * Everything below is fake timers over a mocked strategy and token store. What
 * is under test is *when* a refresh is attempted and what happens when it fails,
 * which is exactly the logic that is otherwise only observable by leaving an app
 * running for fifteen minutes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiError } from '@/types/api';
import type { StoredTokens } from './tokens';

const mocks = vi.hoisted(() => ({
    refresh: vi.fn<() => Promise<void>>(),
    get: vi.fn<() => Promise<StoredTokens | null>>(),
}));

vi.mock('./strategy', () => ({ authStrategy: { refresh: mocks.refresh } }));
vi.mock('./tokenStore', () => ({
    tokenStore: { get: mocks.get, set: vi.fn(), clear: vi.fn() },
}));

const {
    refreshSession,
    startRefreshScheduler,
    stopRefreshScheduler,
    __resetRefreshSchedulerForTests,
} = await import('./refreshScheduler');

const ACCESS_TTL_MS = 900_000; // 15 minutes, the real one
const SKEW_MS = 60_000; // the scheduler's lead time

function tokensExpiringIn(ms: number): StoredTokens {
    return {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        accessExpiresIn: 900,
        refreshExpiresIn: 2_592_000,
        accessExpiresAt: Date.now() + ms,
    };
}

/** Let queued microtasks (the scheduler's awaits on the token store) run. */
async function settle(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
    vi.useFakeTimers();
    mocks.refresh.mockReset().mockResolvedValue(undefined);
    mocks.get.mockReset().mockResolvedValue(null);
});

afterEach(() => {
    __resetRefreshSchedulerForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

// ─── Arming ───────────────────────────────────────────────────────────────────

describe('startRefreshScheduler', () => {
    it('refreshes SKEW before expiry, not at it', async () => {
        mocks.get.mockResolvedValue(tokensExpiringIn(ACCESS_TTL_MS));
        startRefreshScheduler();
        await settle();

        // One tick short of due: still nothing.
        await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS - SKEW_MS - 1);
        expect(mocks.refresh).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    it('arms nothing when the store is empty — the cookie transport', async () => {
        mocks.get.mockResolvedValue(null);
        startRefreshScheduler();
        await settle();

        await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS * 4);
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it('refreshes immediately when the token is already inside the skew window', async () => {
        mocks.get.mockResolvedValue(tokensExpiringIn(SKEW_MS - 1_000));
        startRefreshScheduler();
        await settle();

        expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    it('is idempotent — a second call re-arms rather than doubling the rate', async () => {
        // A refresh that behaves like the real one: it replaces the stored pair,
        // so the next deadline is a full TTL out.
        mocks.get.mockResolvedValue(tokensExpiringIn(ACCESS_TTL_MS));
        mocks.refresh.mockImplementation(async () => {
            mocks.get.mockResolvedValue(tokensExpiringIn(ACCESS_TTL_MS));
        });

        startRefreshScheduler();
        await settle();
        startRefreshScheduler();
        await settle();

        // Three cycles' worth of time buys three refreshes, not six. (Asserting
        // on one deadline would prove nothing: two stacked timers fire in the
        // same instant and the shared lock would coalesce them anyway.)
        await vi.advanceTimersByTimeAsync((ACCESS_TTL_MS - SKEW_MS) * 3);
        expect(mocks.refresh).toHaveBeenCalledTimes(3);
    });

    it('re-arms from the NEW deadline after a successful refresh', async () => {
        mocks.get.mockResolvedValue(tokensExpiringIn(ACCESS_TTL_MS));
        startRefreshScheduler();
        await settle();

        // Refresh #1 lands. A fresh pair replaces the old one.
        mocks.refresh.mockImplementation(async () => {
            mocks.get.mockResolvedValue(tokensExpiringIn(ACCESS_TTL_MS));
        });
        await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS - SKEW_MS);
        expect(mocks.refresh).toHaveBeenCalledTimes(1);

        // …and the next one is a full TTL out, not immediate. A scheduler that
        // re-armed off the OLD deadline would fire again on the next tick.
        await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS - SKEW_MS - 1);
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(mocks.refresh).toHaveBeenCalledTimes(2);
    });
});

describe('the spin guard', () => {
    it('throttles instead of looping when a fresh token is already past due', async () => {
        // What a device clock running ahead of the server looks like: every pair
        // the server mints arrives already inside the skew window. Without a
        // floor this is an unbounded loop of refresh calls.
        mocks.get.mockResolvedValue(tokensExpiringIn(-ACCESS_TTL_MS));
        startRefreshScheduler();
        await settle();
        expect(mocks.refresh).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(29_000);
        expect(mocks.refresh).toHaveBeenCalledTimes(1);

        // One retry per 30s, not one per millisecond.
        await vi.advanceTimersByTimeAsync(60_000);
        expect(mocks.refresh).toHaveBeenCalledTimes(3);
    });
});

// ─── The shared single-flight lock ────────────────────────────────────────────

describe('refreshSession', () => {
    it('coalesces concurrent callers onto one network call', async () => {
        let release!: () => void;
        mocks.refresh.mockImplementation(
            () => new Promise<void>((resolve) => (release = resolve)),
        );

        const a = refreshSession();
        const b = refreshSession();
        const c = refreshSession();
        expect(mocks.refresh).toHaveBeenCalledTimes(1);

        release();
        await Promise.all([a, b, c]);
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    it('releases the lock so a later refresh can run', async () => {
        await refreshSession();
        await refreshSession();
        expect(mocks.refresh).toHaveBeenCalledTimes(2);
    });

    it('releases the lock after a failure too', async () => {
        mocks.refresh.mockRejectedValueOnce(new ApiError(401, 'AUTH_SESSION_EXPIRED', 'gone'));
        await expect(refreshSession()).rejects.toBeInstanceOf(ApiError);

        mocks.refresh.mockResolvedValueOnce(undefined);
        await expect(refreshSession()).resolves.toBeUndefined();
        expect(mocks.refresh).toHaveBeenCalledTimes(2);
    });

    it('propagates the failure to every queued caller', async () => {
        const err = new ApiError(401, 'AUTH_REFRESH_TOKEN_INVALID', 'nope');
        mocks.refresh.mockRejectedValue(err);

        const a = refreshSession();
        const b = refreshSession();
        await expect(a).rejects.toBe(err);
        await expect(b).rejects.toBe(err);
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });
});

// ─── Failure handling: a refresh nobody asked for ─────────────────────────────

describe('a scheduled refresh that fails', () => {
    it('backs off for Retry-After on 429 and keeps trying', async () => {
        mocks.get.mockResolvedValue(tokensExpiringIn(ACCESS_TTL_MS));
        startRefreshScheduler();
        await settle();

        mocks.refresh.mockRejectedValueOnce(
            new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'slow down', undefined, undefined, undefined, {
                retryAfterSeconds: 45,
            }),
        );
        await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS - SKEW_MS);
        expect(mocks.refresh).toHaveBeenCalledTimes(1);

        // A rate limit is a statement about the ceiling, not about the session:
        // it must retry, and not one second earlier than it was told to.
        await vi.advanceTimersByTimeAsync(44_000);
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1_000);
        expect(mocks.refresh).toHaveBeenCalledTimes(2);
    });

    it('stops on a terminal refusal and leaves the verdict to the request path', async () => {
        mocks.get.mockResolvedValue(tokensExpiringIn(ACCESS_TTL_MS));
        startRefreshScheduler();
        await settle();

        mocks.refresh.mockRejectedValue(
            new ApiError(401, 'AUTH_REFRESH_TOKEN_INVALID', 'invalid'),
        );
        await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS - SKEW_MS);
        expect(mocks.refresh).toHaveBeenCalledTimes(1);

        // No retry storm against an endpoint that has already decided.
        await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS * 4);
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    it('retries a network failure — a dead signal is no verdict on the session', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mocks.get.mockResolvedValue(tokensExpiringIn(ACCESS_TTL_MS));
        startRefreshScheduler();
        await settle();

        mocks.refresh.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS - SKEW_MS);
        expect(mocks.refresh).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(30_000);
        expect(mocks.refresh).toHaveBeenCalledTimes(2);
    });
});

// ─── Cancellation ─────────────────────────────────────────────────────────────

describe('stopRefreshScheduler', () => {
    it('cancels a pending refresh', async () => {
        mocks.get.mockResolvedValue(tokensExpiringIn(ACCESS_TTL_MS));
        startRefreshScheduler();
        await settle();

        stopRefreshScheduler();
        await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS * 2);
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it('is what `auth:logout` triggers', async () => {
        mocks.get.mockResolvedValue(tokensExpiringIn(ACCESS_TTL_MS));
        startRefreshScheduler();
        await settle();

        window.dispatchEvent(new Event('auth:logout'));
        await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS * 2);
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it('does not refresh when the store emptied while the timer waited', async () => {
        mocks.get.mockResolvedValue(tokensExpiringIn(ACCESS_TTL_MS));
        startRefreshScheduler();
        await settle();

        mocks.get.mockResolvedValue(null);
        await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS);
        expect(mocks.refresh).not.toHaveBeenCalled();
    });
});

// ─── Resume ───────────────────────────────────────────────────────────────────

describe('on resume', () => {
    it('refreshes at once when the token expired while suspended', async () => {
        mocks.get.mockResolvedValue(tokensExpiringIn(ACCESS_TTL_MS));
        startRefreshScheduler();
        await settle();

        // The device slept: the timer never fired, and the token is long dead.
        mocks.get.mockResolvedValue(tokensExpiringIn(-ACCESS_TTL_MS));
        document.dispatchEvent(new Event('visibilitychange'));
        await settle();

        expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    it('re-arms rather than refreshing when the token is still good', async () => {
        mocks.get.mockResolvedValue(tokensExpiringIn(ACCESS_TTL_MS));
        startRefreshScheduler();
        await settle();

        document.dispatchEvent(new Event('visibilitychange'));
        await settle();
        expect(mocks.refresh).not.toHaveBeenCalled();

        // Re-armed, not cancelled: the timer still fires at the real deadline.
        await vi.advanceTimersByTimeAsync(ACCESS_TTL_MS - SKEW_MS);
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });
});
