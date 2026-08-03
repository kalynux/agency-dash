import i18n from '@/i18n';
import { ApiError } from '@/types/api';

/**
 * Backend errors are resolved by `error.code`, never by `error.message`.
 *
 * The code is the stable contract (`api-doc/error-codes.ts`); the message is
 * English server-side copy that would leak untranslated into a French or Arabic
 * UI. So every code maps to a key under `errors:codes.*`, and anything we can't
 * resolve becomes the generic message rather than raw server text.
 * `scripts/i18n-audit.mjs` fails the build if a declared code has no entry.
 */

const CODES_NS = 'errors';

/** True when the `errors` bundle has copy for this code in the active language. */
function hasCode(code: string): boolean {
  return i18n.exists(`${CODES_NS}:codes.${code}`);
}

function translateCode(code: string, context?: Record<string, unknown>): string {
  // Cast: the key is only known at runtime, so it can't satisfy the generated
  // key union. The `exists` guard above is what makes this safe.
  return i18n.t(`${CODES_NS}:codes.${code}` as never, context as never) as unknown as string;
}

export function getGenericErrorMessage(): string {
  return i18n.t('errors:generic');
}

/**
 * Standard way to turn any thrown value into a user-facing, localized message.
 *
 * @param overrides optional per-screen `code → translation key` map, for copy
 *   that only makes sense on one screen (e.g. a shipment screen phrasing
 *   `CONNECTION_NOT_ACTIVE` in terms of that shipment). Keys are full
 *   `namespace:key` paths.
 * @param context interpolation values passed to the resolved message, so a
 *   catalogued error can name the limit or amount it is about.
 */
export function getApiErrorMessage(
  err: unknown,
  overrides?: Record<string, string>,
  context?: Record<string, unknown>,
): string {
  if (err instanceof ApiError) {
    const override = overrides?.[err.code];
    if (override && i18n.exists(override)) {
      return i18n.t(override as never, context as never) as unknown as string;
    }
    if (hasCode(err.code)) return translateCode(err.code, context);
    return getGenericErrorMessage();
  }
  // A non-API failure is almost always a network/abort error from `fetch`.
  if (err instanceof TypeError) return i18n.t('errors:network');
  return getGenericErrorMessage();
}

/**
 * Field-level validation messages from the backend are the one place raw server
 * text can reach the UI — they name a specific field and have no code to
 * resolve. Prefer a client-side rule; use this only as a last resort, and let
 * the caller decide whether to show it.
 */
export function getFieldErrorMessage(err: unknown): string | undefined {
  return err instanceof ApiError ? err.firstFieldError() : undefined;
}

/** The `requestId` to surface in support-facing error copy, if present. */
export function getRequestId(err: unknown): string | undefined {
  return err instanceof ApiError ? err.requestId : undefined;
}

/** True when the error is an auth/permission failure (401/403). */
export function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

/** The backend code behind an error, when there is one. */
export function getErrorCode(err: unknown): string | undefined {
  return err instanceof ApiError ? err.code : undefined;
}
