import { ApiError, REFRESHABLE_AUTH_CODE, TERMINAL_AUTH_CODES } from '@/types/api';
import { authStrategy } from '@/platform/auth/strategy';
import { refreshSession } from '@/platform/auth/refreshScheduler';
import { BASE_URL, buildApiError } from './http';

// Re-exported: this has been `api.ts`'s public surface since before the base URL
// and the error builder moved to ./http (see that file for why).
export { BASE_URL };

// The transport — cookies or bearer tokens — is decided by `authStrategy`, and
// this file must never ask which one is active. Everything that differs between
// the two is a property on the strategy; anything else would put a
// `if (isNative)` in the one code path both platforms have to share.
// See CAPACITOR-PLAN.md → P1.3.

// ─── Refresh queue ────────────────────────────────────────────────────────────
// Ensures only one token refresh is in-flight at a time.
// All concurrent 401s are held and resolved/rejected after the refresh settles.
//
// The refresh CALL itself is `refreshSession()`, which lives in the scheduler
// (P2.5) because the proactive timer and this reactive path have to share one
// lock. With two locks a resume and a 401 can each start a refresh, and the
// second lands holding a refresh token the first has already rotated away — a
// sign-out with nothing in the logs to explain it. The queue below stays here:
// it is about retrying held *requests*, which is this file's job.

type QueueItem = {
    resolve: () => void;
    reject: (err: ApiError) => void;
};

let isRefreshing = false;
let pendingQueue: QueueItem[] = [];

function flushQueue(err?: ApiError) {
    pendingQueue.forEach((item) => {
        if (err) item.reject(err);
        else item.resolve();
    });
    pendingQueue = [];
}

// A refresh refused with 429 must not be retried on the next request, or a
// dashboard's concurrent polls turn one rate-limited refresh into a storm
// against the very bucket that is already full. Hold the refusal and re-throw it
// until `Retry-After` has elapsed.
let refreshBlockedUntil = 0;
let refreshBlockedBy: ApiError | null = null;
/** Fallback when a 429 carries no `Retry-After` — the buckets are per-minute. */
const DEFAULT_REFRESH_BACKOFF_SECONDS = 60;

// ─── Auth error classification (P1.4) ─────────────────────────────────────────

/** What the request path should do about a failed response. */
export type AuthAction = 'refresh' | 'signOut' | 'propagate';

/**
 * The endpoints that are answered WITHOUT a session, so nothing they return can
 * be a verdict on one. `add-role` is absent on purpose — it is authenticated.
 *
 * Read off the strategy so the mobile namespace is covered by the same set.
 */
const SESSIONLESS_PATHS: ReadonlySet<string> = new Set([
    authStrategy.paths.login,
    authStrategy.paths.register,
    '/auth/forgot-password',
    '/auth/reset-password',
]);

function carriesSession(path: string): boolean {
    return !SESSIONLESS_PATHS.has(path.split('?')[0]);
}

/**
 * Decide from `error.code`, never from the status — the backend is explicit that
 * client logic keys on the code, and one status covers several outcomes here
 * (401 is "refresh me", "you are done", and "wrong password" all at once).
 *
 * | code | status | action |
 * |---|---|---|
 * | `AUTH_TOKEN_EXPIRED` | 401 | refresh — the only recoverable one |
 * | the codes in {@link TERMINAL_AUTH_CODES} | 401 / 403 | sign out |
 * | `RATE_LIMIT_EXCEEDED` | 429 | propagate — **never** sign out |
 * | any other 401 | 401 | sign out |
 * | anything else (403 authorization, 404, 409, 5xx…) | — | propagate |
 *
 * The "any other 401" default is deliberate. Leaving an unrecognised 401 to
 * propagate would leave the app running against a credential the server keeps
 * refusing: every screen erroring, nothing routing to login, no way out but a
 * manual reload. Signing out is recoverable; that state is not.
 *
 * A 403 that is not `AUTH_ACCOUNT_SUSPENDED` is an authorization answer about
 * one resource, not a verdict on the session, so it must never sign anyone out.
 *
 * `opts.carriesSession: false` turns the whole table off, because a request that
 * presented no session cannot have had one refused. Login answers
 * `401 AUTH_INVALID_CREDENTIALS` — under the default table a mistyped password
 * would destroy the session of whoever was already signed in and bounce them to
 * a login screen instead of showing "wrong password" in the form.
 *
 * Exported for the P1.12 unit tests — it is pure.
 */
export function classifyAuthError(
    err: ApiError,
    opts: { carriesSession?: boolean } = {},
): AuthAction {
    if (opts.carriesSession === false) return 'propagate';
    if (err.code === REFRESHABLE_AUTH_CODE) return 'refresh';
    if (TERMINAL_AUTH_CODES.has(err.code)) return 'signOut';
    // Checked before the 401 default: a rate-limited client still has a valid
    // session and signing it out would punish the user for the ceiling.
    if (err.isRateLimited) return 'propagate';
    if (err.status === 401) return 'signOut';
    return 'propagate';
}

/**
 * End the session locally and tell the app. The strategy decides what "end"
 * means — a `POST /auth/logout` on cookies, discarding the token pair on bearer.
 *
 * The `auth:logout` event stays the single exit for both transports. It now
 * carries the cause so a login screen can say *why* (P1.8) — most of all for
 * `AUTH_PASSWORD_CHANGED`, which to someone who did not change their password is
 * the first sign that somebody else did.
 */
async function hardLogout(cause?: ApiError): Promise<void> {
    try {
        await authStrategy.endSession();
    } catch {
        // Best-effort by contract. Never let this swallow the event below: an
        // app that cannot sign out is worse than one that logs out untidily.
    }
    window.dispatchEvent(
        new CustomEvent('auth:logout', {
            detail: cause ? { code: cause.code, message: cause.message } : undefined,
        }),
    );
}

// ─── Core request function ────────────────────────────────────────────────────

async function request<T>(
    path: string,
    init: RequestInit = {},
    isRetry = false,
): Promise<T> {
    const url = `${BASE_URL}${path}`;

    // For multipart uploads let the browser set the Content-Type (with boundary).
    const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

    // Read per-request, never hoisted: after a refresh the retry below has to
    // pick up the NEW access token, and the queued requests the fresh one too.
    const authHeaders = await authStrategy.authHeaders();

    const res = await fetch(url, {
        ...init,
        credentials: authStrategy.credentials,
        headers: isFormData
            ? { ...authHeaders, ...(init.headers ?? {}) }
            : {
                'Content-Type': 'application/json',
                ...authHeaders,
                ...(init.headers ?? {}),
            },
    });

    if (!res.ok) {
        // Read the body BEFORE deciding: the response code, not the status, says
        // whether this is recoverable.
        const err = await buildApiError(res);
        let action = classifyAuthError(err, { carriesSession: carriesSession(path) });

        // A 401 that survives a refresh cannot be an expiry problem — the token
        // it was made with is seconds old. Refreshing again would loop.
        if (action === 'refresh' && isRetry) action = 'signOut';

        if (action === 'signOut') {
            flushQueue(err);
            await hardLogout(err);
            throw err;
        }

        if (action === 'refresh') {
            // If another refresh is already in flight, queue this request
            if (isRefreshing) {
                return new Promise<T>((resolve, reject) => {
                    pendingQueue.push({
                        resolve: () => request<T>(path, init, true).then(resolve).catch(reject),
                        reject,
                    });
                });
            }

            // Still inside a refusal we were told to wait out. Fail with the
            // original 429 rather than spending the request to be refused again.
            if (refreshBlockedBy && Date.now() < refreshBlockedUntil) {
                throw refreshBlockedBy;
            }

            // Begin refresh
            isRefreshing = true;
            try {
                await refreshSession();
                isRefreshing = false;
                refreshBlockedBy = null;
                flushQueue(); // resolve all queued requests
                return request<T>(path, init, true); // retry original
            } catch (refreshErr) {
                isRefreshing = false;
                const apiErr =
                    refreshErr instanceof ApiError
                        ? refreshErr
                        : new ApiError(401, 'REFRESH_FAILED', 'Session expired');
                flushQueue(apiErr); // reject all queued requests

                // 429 is not an auth verdict: the session is fine, the ceiling
                // is not. Back off and keep the user signed in — the next
                // request after the window refreshes normally.
                if (apiErr.isRateLimited) {
                    refreshBlockedBy = apiErr;
                    refreshBlockedUntil =
                        Date.now() +
                        (apiErr.retryAfterSeconds ?? DEFAULT_REFRESH_BACKOFF_SECONDS) * 1000;
                    throw apiErr;
                }

                await hardLogout(apiErr);
                throw apiErr;
            }
        }

        throw err;
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const api = {
    get<T>(path: string): Promise<T> {
        return request<T>(path, { method: 'GET' });
    },

    post<T>(path: string, body?: unknown): Promise<T> {
        return request<T>(path, {
            method: 'POST',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    },

    /** Multipart POST (file uploads). Pass a FormData; the browser sets the boundary. */
    postForm<T>(path: string, form: FormData): Promise<T> {
        return request<T>(path, { method: 'POST', body: form });
    },

    patch<T>(path: string, body?: unknown): Promise<T> {
        return request<T>(path, {
            method: 'PATCH',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    },

    put<T>(path: string, body?: unknown): Promise<T> {
        return request<T>(path, {
            method: 'PUT',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    },

    delete<T>(path: string, body?: unknown): Promise<T> {
        return request<T>(path, {
            method: 'DELETE',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    },
};
