import { ApiError, ERROR_CATEGORIES, type ErrorCategory } from '@/types/api';

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8022/api';

// ─── Refresh queue ────────────────────────────────────────────────────────────
// Ensures only one token refresh is in-flight at a time.
// All concurrent 401s are held and resolved/rejected after the refresh settles.

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

/**
 * 401s that a refresh cannot fix, so attempting one is a wasted round trip that
 * ends in the same place. A password change stamps a per-account instant and
 * BOTH credential paths refuse anything minted before it — the refresh cookie
 * included — so the refresh would answer 401 with this very code. Suspension is
 * the same shape: the account, not the token, is what is refused.
 * See api-doc/auth/README.md ("Revocation — `iat` is load-bearing").
 */
const TERMINAL_AUTH_CODES = new Set(['AUTH_PASSWORD_CHANGED', 'AUTH_ACCOUNT_SUSPENDED']);

function isTerminalAuthError(err: unknown): boolean {
    return err instanceof ApiError && TERMINAL_AUTH_CODES.has(err.code);
}

async function refreshTokens(): Promise<void> {
    // Browser clients refresh explicitly from the refresh_token cookie.
    // NB: the endpoint is `/auth/browser/refresh` — there is no `/auth/refresh`.
    // See api-doc/auth/README.md (POST /auth/browser/refresh).
    //
    // The whole `/auth/browser/*` namespace sits behind `requireJsonContent`, a
    // CSRF mitigation: without this header the answer is `400 VALIDATION_ERROR
    // — "Bad Request: Only JSON content is accepted"` and every silent refresh
    // fails. The header is the requirement; there is no body to send.
    const res = await fetch(`${BASE_URL}/auth/browser/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
        throw await buildApiError(res);
    }
}

// Hard logout: clear cookies server-side and reload to login
async function hardLogout(): Promise<void> {
    try {
        await fetch(`${BASE_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
        });
    } catch {
        // best-effort
    }
    // Signal to the app that auth is gone
    window.dispatchEvent(new Event('auth:logout'));
}

// ─── Error builder ────────────────────────────────────────────────────────────

async function buildApiError(res: Response): Promise<ApiError> {
    let body: Record<string, unknown> = {};
    try {
        body = await res.json();
    } catch {
        // response body may not be JSON
    }

    const error = (body.error ?? body) as Record<string, unknown>;
    const message =
        (error.message as string) ??
        (body.message as string) ??
        `Request failed with status ${res.status}`;
    const code = (error.code as string) ?? String(res.status);
    const details = error.details ?? undefined;
    // `requestId` is a body field, but it also rides `X-Request-Id` on EVERY
    // response — including the masked 5xx where it is the only handle anyone has.
    const requestId =
        (body.requestId as string) ?? res.headers.get('X-Request-Id') ?? undefined;
    const category = readCategory(error.category);

    return new ApiError(res.status, code, message, details, requestId, category, {
        // draft-7 `Retry-After` is in seconds. Prefer it over the body field: the
        // header is what lets a client slow down before it is refused.
        // See api-doc/rate-limits.md.
        retryAfterSeconds:
            parseRetryAfter(res.headers.get('Retry-After')) ??
            readRetryAfterSeconds(details),
    });
}

/** `error.category` is always present as of Phase 16, but tolerate its absence. */
function readCategory(raw: unknown): ErrorCategory | undefined {
    return typeof raw === 'string' && (ERROR_CATEGORIES as readonly string[]).includes(raw)
        ? (raw as ErrorCategory)
        : undefined;
}

function parseRetryAfter(header: string | null): number | undefined {
    if (!header) return undefined;
    const seconds = Number(header);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function readRetryAfterSeconds(details: unknown): number | undefined {
    if (!details || typeof details !== 'object') return undefined;
    const value = (details as { retryAfterSeconds?: unknown }).retryAfterSeconds;
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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

    const res = await fetch(url, {
        ...init,
        credentials: 'include',
        headers: isFormData
            ? { ...(init.headers ?? {}) }
            : {
                'Content-Type': 'application/json',
                ...(init.headers ?? {}),
            },
    });

    if (res.status === 401 && !isRetry) {
        // Read the body BEFORE deciding: some 401s are terminal and a refresh
        // against them is guaranteed to fail with the same code.
        const authErr = await buildApiError(res);
        if (isTerminalAuthError(authErr)) {
            flushQueue(authErr);
            await hardLogout();
            throw authErr;
        }

        // If another refresh is already in flight, queue this request
        if (isRefreshing) {
            return new Promise<T>((resolve, reject) => {
                pendingQueue.push({
                    resolve: () => request<T>(path, init, true).then(resolve).catch(reject),
                    reject,
                });
            });
        }

        // Begin refresh
        isRefreshing = true;
        try {
            await refreshTokens();
            isRefreshing = false;
            flushQueue(); // resolve all queued requests
            return request<T>(path, init, true); // retry original
        } catch (refreshErr) {
            isRefreshing = false;
            const apiErr =
                refreshErr instanceof ApiError
                    ? refreshErr
                    : new ApiError(401, 'REFRESH_FAILED', 'Session expired');
            flushQueue(apiErr); // reject all queued requests
            await hardLogout();
            throw apiErr;
        }
    }

    if (!res.ok) {
        throw await buildApiError(res);
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
