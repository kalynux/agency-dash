// ─── File upload error messaging ──────────────────────────────────────────────
// Turns a failed upload into a friendly, per-file message.
//
// `POST /api/files/upload` (and the video route) returns `400 UPLOAD_POLICY_VIOLATION`
// with `error.details.violations[]`, each scoped to a file via `fileIndex`. See
// api-doc/errors/README.md §7 and api-doc/agency/storage.md §3. We surface the
// machine `code` as readable copy, naming the offending file where possible.
//
// The violation codes are their own small catalog — they arrive nested inside
// `details`, not as a top-level `error.code` — so they live under
// `errors:upload.violations.*` rather than `errors:codes.*`.

import i18n from '@/i18n';
import { ApiError } from '@/types/api';
import { getApiErrorMessage } from '@/lib/errors';
import type { UploadPolicyViolation } from '@/types/file.types';

const VIOLATIONS_KEY = 'errors:upload.violations';

function reasonFor(code: string): string {
  const key = `${VIOLATIONS_KEY}.${code}`;
  if (i18n.exists(key)) return i18n.t(key as never) as unknown as string;
  return i18n.t('errors:upload.violations.fallback');
}

/** Pull `details.violations[]` out of an error payload, if it carries any. */
export function readUploadViolations(details: unknown): UploadPolicyViolation[] | null {
  if (!details || typeof details !== 'object') return null;
  const violations = (details as { violations?: unknown }).violations;
  if (!Array.isArray(violations) || violations.length === 0) return null;
  return violations as UploadPolicyViolation[];
}

function nameForViolation(
  violation: UploadPolicyViolation,
  files?: File[],
): string | null {
  const named = violation.metadata?.originalName;
  if (typeof named === 'string' && named) return named;
  if (typeof violation.fileIndex === 'number' && files?.[violation.fileIndex]) {
    return files[violation.fileIndex].name;
  }
  return null;
}

/**
 * Build a localized message from an upload failure.
 * - For `UPLOAD_POLICY_VIOLATION`, maps each violation to a per-file line.
 * - Falls back to the shared error registry for anything else.
 *
 * Pass `files` — the exact list sent in *that* request — so `fileIndex` resolves
 * to the right name. A mixed selection is split across two upload routes, so an
 * index is only meaningful against its own request's file list.
 */
export function getUploadErrorMessage(err: unknown, files?: File[]): string {
  if (err instanceof ApiError) {
    const violations = readUploadViolations(err.details);
    if (violations) {
      const lines = violations.map((v) => {
        const reason = reasonFor(v.code);
        const name = nameForViolation(v, files);
        return name
          ? i18n.t('errors:upload.fileLine', { name, reason })
          : i18n.t('errors:upload.anonymousLine', { reason });
      });
      // De-dupe identical lines (common when several files share one reason).
      return Array.from(new Set(lines)).join(' ');
    }
  }
  return getApiErrorMessage(err);
}
