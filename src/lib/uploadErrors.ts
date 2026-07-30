// ─── File upload error messaging ──────────────────────────────────────────────
// Turns a failed upload into a friendly, per-file message.
//
// `POST /api/files/upload` (and the video route) returns `400 UPLOAD_POLICY_VIOLATION`
// with `error.details.violations[]`, each scoped to a file via `fileIndex`. See
// api-doc/errors/README.md §7 and api-doc/agency/storage.md §3. We surface the
// machine `code` as readable copy, naming the offending file where possible.

import { ApiError } from '@/types/api';
import { getApiErrorMessage } from '@/lib/errors';
import type { UploadPolicyViolation } from '@/types/file.types';

export const UPLOAD_VIOLATION_MESSAGES: Record<string, string> = {
  FILE_TOO_LARGE: 'is too large',
  MIME_NOT_ALLOWED: 'has an unsupported file type',
  TOO_MANY_FILES: 'exceeds the maximum number of files',
  QUOTA_EXCEEDED:
    'would exceed your storage quota — free up space in your Media Library or upgrade your plan',
  VIRUS_DETECTED: 'failed the security scan',
  PERMISSION_DENIED: 'cannot be uploaded (permission denied)',
  TOTAL_SIZE_EXCEEDED: 'pushes the upload over the total size limit',
  DUPLICATE_FILE: 'has already been uploaded',
  MIME_TYPE_MISMATCH: 'has contents that don’t match its extension',
  POLYGLOT_DETECTED: 'looks like a disguised file and was rejected',
  UNDETECTABLE_TYPE: 'has an unrecognised file type',
};

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
 * Build a human-readable message from an upload failure.
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
        const reason = UPLOAD_VIOLATION_MESSAGES[v.code] ?? v.message ?? 'was rejected';
        const name = nameForViolation(v, files);
        return name ? `${name} ${reason}.` : `A file ${reason}.`;
      });
      // De-dupe identical lines (common when several files share one reason).
      return Array.from(new Set(lines)).join(' ');
    }
  }
  return getApiErrorMessage(err);
}
