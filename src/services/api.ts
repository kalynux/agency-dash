import { ApiError } from '@/types/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8022/api';

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

async function refreshTokens(): Promise<void> {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
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
    const details = (error.details as Record<string, string[]>) ?? undefined;
    const requestId = (body.requestId as string) ?? undefined;

    return new ApiError(res.status, code, message, details, requestId);
}

// ─── Core request function ────────────────────────────────────────────────────

async function request<T>(
    path: string,
    init: RequestInit = {},
    isRetry = false,
): Promise<T> {
    const url = `${BASE_URL}${path}`;

    const res = await fetch(url, {
        ...init,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(init.headers ?? {}),
        },
    });

    if (res.status === 401 && !isRetry) {
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

    delete<T>(path: string): Promise<T> {
        return request<T>(path, { method: 'DELETE' });
    },
};
