import { api } from './api';
import type { UploadFilesResponse, StorageUsageResponse } from '@/types/file.types';

/** Shared file uploads. See api-doc/uploads/README.md. */
export const filesService = {
  /** POST /files/upload — upload 1–10 files (multipart, field `files`). */
  upload(files: File[]): Promise<UploadFilesResponse> {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return api.postForm<UploadFilesResponse>('/files/upload', form);
  },

  /** POST /files/upload/video — upload video files (multipart, field `videos`). */
  uploadVideo(files: File[]): Promise<UploadFilesResponse> {
    const form = new FormData();
    files.forEach((f) => form.append('videos', f));
    return api.postForm<UploadFilesResponse>('/files/upload/video', form);
  },

  /** GET /files/storage — storage usage + plan-limit summary. */
  getStorage(): Promise<StorageUsageResponse> {
    return api.get<StorageUsageResponse>('/files/storage');
  },
};

/**
 * Parse an UPLOAD_POLICY_VIOLATION error's per-file violations into a readable
 * summary. Falls back to the generic message when the shape isn't present.
 */
export function describeUploadViolations(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;
  const violations = (details as { violations?: unknown }).violations;
  if (!Array.isArray(violations) || violations.length === 0) return null;
  return violations
    .map((v) => {
      const entry = v as { message?: string; code?: string; metadata?: { originalName?: string } };
      const name = entry.metadata?.originalName ? `${entry.metadata.originalName}: ` : '';
      return `${name}${entry.message ?? entry.code ?? 'rejected'}`;
    })
    .join('; ');
}
