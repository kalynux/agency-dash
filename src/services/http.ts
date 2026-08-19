/**
 * Low-level HTTP primitives shared by everything that talks to the backend.
 *
 * This file exists to break a cycle: `api.ts` needs the auth strategy (to pick
 * headers, credentials and the refresh endpoint), while the strategy needs the
 * base URL and the error builder to make its own raw `fetch` calls. Both now
 * depend on this module and not on each other.
 *
 * Nothing here knows about auth transports, refreshing, or logout — that is
 * `api.ts` (the request path) and `src/platform/auth/` (the transport).
 */
import { ApiError, ERROR_CATEGORIES, type ErrorCategory } from '@/types/api';

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8022/api';

/**
 * Turn a failed `Response` into an `ApiError`, reading the documented envelope
 * (`{ error: { code, message, details, category } }`) and falling back through
 * the shapes a proxy or a network layer can produce instead.
 */
export async function buildApiError(res: Response): Promise<ApiError> {
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
