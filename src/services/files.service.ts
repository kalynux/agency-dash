// ─── File management service ──────────────────────────────────────────────────
// Talks to the shared `/api/files` surface, automatically scoped to the agency
// (api-doc/agency/file-management.md, api-doc/agency/storage.md).
//
// Files are FLAT (no folders). Attachment status comes from the `usage` object on
// GET /files/:id — never from `usageCount`.

import { api, BASE_URL } from './api';
import { ApiError } from '@/types/api';
import type {
  ApiFile,
  ApiFileDetail,
  FileDetailResponse,
  FileKind,
  FileListParams,
  FileListResponse,
  FilePagination,
  FileUpdateResponse,
  MediaCategory,
  StorageUsage,
  StorageUsageResponse,
  UploadFilesResponse,
} from '@/types/file.types';

// ─── Simple upload helpers (ticket attachments, avatar/logo slots) ────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return (
    '?' +
    entries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
  );
}

/**
 * Public origin for files that arrive without a populated `url`. The local
 * provider serves at `<api>/files/<key>`; override with VITE_FILE_BASE_URL when
 * the storage host differs from the API host.
 */
const FILE_PUBLIC_BASE: string =
  (import.meta.env.VITE_FILE_BASE_URL as string | undefined) ??
  `${BASE_URL.replace(/\/$/, '')}/files`;

/** Resolve a displayable URL for a file, preferring the backend-populated `url`. */
export function resolveFileUrl(file: Pick<ApiFile, 'url' | 'key'>): string {
  if (file.url) return file.url;
  const base = FILE_PUBLIC_BASE.replace(/\/$/, '');
  const key = file.key.replace(/^\//, '');
  return `${base}/${key}`;
}

/** Coarse UI category from a MIME type. */
export function kindFromMime(mimeType: string): FileKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

/** Map a coarse UI kind to the backend `category` filter value. */
export function categoryFromKind(kind: FileKind): MediaCategory {
  return kind; // FileKind is a subset of MediaCategory
}

/**
 * The ONLY attachment signal: a file is attached if it has live references.
 * Reads `usage`, never `usageCount`.
 */
export function isAttached(detail: ApiFileDetail): boolean {
  return detail.usage.totalReferences > 0;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function listFiles(
  params: FileListParams = {},
): Promise<{ files: ApiFile[]; pagination: FilePagination; storage: StorageUsage | null }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const res = await api.get<FileListResponse>(`/files${qs}`);
  return {
    files: res.data.files,
    pagination: res.data.pagination,
    // Embedded usage summary (storage.md §2) — saves a second call.
    storage: res.data.storage ?? null,
  };
}

/**
 * Account-wide media storage usage + plan limit (storage.md §2). The primary
 * source for a storage widget — includes the per-category breakdown.
 */
export async function fetchStorageUsage(): Promise<StorageUsage> {
  const res = await filesService.getStorage();
  return res.data;
}

export async function getFile(id: string): Promise<ApiFileDetail> {
  const res = await api.get<FileDetailResponse>(`/files/${id}`);
  return res.data;
}

/**
 * Resolve usage/detail for a page of files, to derive reference-based attachment
 * status. Failures per file are swallowed (dropped from the map) so one bad id
 * never blanks the whole page.
 */
export async function getFilesUsage(ids: string[]): Promise<Record<string, ApiFileDetail>> {
  const results = await Promise.all(ids.map((id) => getFile(id).catch(() => null)));
  const map: Record<string, ApiFileDetail> = {};
  results.forEach((d) => {
    if (d) map[d.id] = d;
  });
  return map;
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function updateFileName(id: string, originalName: string): Promise<ApiFile> {
  const res = await api.patch<FileUpdateResponse>(`/files/${id}`, { originalName });
  return res.data;
}

/** Soft delete. Rejects with 409 while the file is still referenced. */
export async function deleteFile(id: string): Promise<void> {
  await api.delete<{ success: boolean; message: string }>(`/files/${id}`);
}

// ─── Upload with progress (XHR) ───────────────────────────────────────────────
// The fetch-based client can't report upload progress, so uploads go through XHR.
// Cookie auth is preserved with `withCredentials`.
//
// Two upload routes (api-doc/agency/file-management.md):
//   • images/docs/audio/archives → POST /files/upload       (field `files`, ≤10)
//   • videos                     → POST /files/upload/video (field `videos`, ≤3)
// The general endpoint REJECTS videos outright, so a mixed selection is split and
// routed per file. `uploadMediaWithProgress` is the single entry point.

export const MAX_FILES_PER_UPLOAD = 10;
export const MAX_VIDEOS_PER_UPLOAD = 3;

export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'] as const;
export const VIDEO_MAX_BYTES = 70 * 1024 * 1024; // 70 MB per video

const MB = 1024 * 1024;

/**
 * Agency per-file caps (storage.md §1). The per-type cap applies first and is far
 * stricter than the coarse 200 MB per-request ceiling, so this is what users hit.
 * A UX guard only — the server re-validates by sniffing the bytes.
 */
const PER_TYPE_CAPS: {
  match: (mime: string, ext: string) => boolean;
  bytes: number;
  label: string;
}[] = [
  { match: (m, e) => m === 'image/gif' || e === 'gif', bytes: 5 * MB, label: '5 MB GIF' },
  { match: (m, e) => m === 'application/pdf' || e === 'pdf', bytes: 25 * MB, label: '25 MB PDF' },
  { match: (m, e) => m === 'application/zip' || e === 'zip', bytes: 50 * MB, label: '50 MB ZIP' },
  { match: (m) => m.startsWith('image/'), bytes: 10 * MB, label: '10 MB image' },
];

/** Coarse fallback ceiling for anything without a specific per-type cap. */
const DEFAULT_MAX_BYTES = 200 * MB;

function extensionOf(file: File): string {
  return file.name.split('.').pop()?.toLowerCase() ?? '';
}

/**
 * Does this file belong on the video route? Any `video/*` does — the general
 * endpoint accepts no video at all. Falls back to the extension when the browser
 * doesn't populate `File.type` (common for `.mov`).
 */
export function isVideoUpload(file: File): boolean {
  if (file.type) return file.type.startsWith('video/');
  return (VIDEO_EXTENSIONS as readonly string[]).includes(extensionOf(file));
}

function capFor(file: File): { bytes: number; label: string } {
  const mime = file.type ?? '';
  const ext = extensionOf(file);
  return (
    PER_TYPE_CAPS.find((c) => c.match(mime, ext)) ?? { bytes: DEFAULT_MAX_BYTES, label: '200 MB' }
  );
}

/**
 * Validate a mixed selection client-side before uploading. Returns a friendly
 * error message, or `null` when the selection is acceptable.
 */
export function validateMediaSelection(files: File[]): string | null {
  const videos = files.filter(isVideoUpload);
  const others = files.filter((f) => !isVideoUpload(f));

  if (others.length > MAX_FILES_PER_UPLOAD) {
    return `You can upload at most ${MAX_FILES_PER_UPLOAD} files at once.`;
  }
  if (videos.length > MAX_VIDEOS_PER_UPLOAD) {
    return `You can upload at most ${MAX_VIDEOS_PER_UPLOAD} videos at once.`;
  }

  for (const file of others) {
    const cap = capFor(file);
    if (file.size > cap.bytes) return `"${file.name}" exceeds the ${cap.label} limit.`;
  }

  const bigVideo = videos.find((f) => f.size > VIDEO_MAX_BYTES);
  if (bigVideo) return `"${bigVideo.name}" exceeds the 70 MB video limit.`;

  const badFormat = videos.find(
    (f) => f.type && !(VIDEO_MIME_TYPES as readonly string[]).includes(f.type),
  );
  if (badFormat) return `"${badFormat.name}" is not a supported video (use MP4, MOV or WebM).`;

  return null;
}

/** Rebuild an ApiError from a failed XHR so `details.violations` survives. */
function errorFromXhr(xhr: XMLHttpRequest, files: File[]): ApiError {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(xhr.responseText);
  } catch {
    // response may not be JSON
  }
  const error = (body.error ?? body) as Record<string, unknown>;
  const message =
    (error.message as string) ??
    (body.message as string) ??
    `Upload failed with status ${xhr.status}`;
  const code = (error.code as string) ?? String(xhr.status || 0);
  const details = error.details;
  const requestId = (body.requestId as string) ?? undefined;

  // `fileIndex` is scoped to this request's own file list. Because a mixed
  // selection is split across two requests, backfill each violation's filename
  // from THIS request so per-file messaging stays correct after the split.
  const violations =
    details && typeof details === 'object'
      ? (details as { violations?: unknown }).violations
      : undefined;
  if (Array.isArray(violations)) {
    violations.forEach((raw) => {
      const v = raw as { fileIndex?: number; metadata?: Record<string, unknown> };
      if (!v.metadata?.originalName && typeof v.fileIndex === 'number' && files[v.fileIndex]) {
        v.metadata = { ...v.metadata, originalName: files[v.fileIndex].name };
      }
    });
  }

  return new ApiError(xhr.status, code, message, details, requestId);
}

/** Low-level XHR upload to a single route. Reports bytes loaded for aggregation. */
function xhrUpload(
  url: string,
  fieldName: string,
  files: File[],
  onBytes?: (loaded: number) => void,
): Promise<ApiFile[]> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    files.forEach((f) => fd.append(fieldName, f));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onBytes) onBytes(event.loaded);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as { data: ApiFile[] };
          resolve(body.data);
        } catch {
          reject(new ApiError(xhr.status, 'PARSE_ERROR', 'Could not parse upload response'));
        }
      } else {
        reject(errorFromXhr(xhr, files));
      }
    };

    xhr.onerror = () =>
      reject(new ApiError(0, 'NETWORK_ERROR', 'Network error during upload. Please try again.'));
    xhr.onabort = () => reject(new ApiError(0, 'ABORTED', 'Upload cancelled.'));

    xhr.send(fd);
  });
}

/**
 * Upload a mixed selection, routing videos to the dedicated video endpoint and
 * everything else to the general one. Progress is aggregated across both requests
 * by byte count. Resolves to the combined `ApiFile[]`.
 */
export function uploadMediaWithProgress(
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<ApiFile[]> {
  const videos = files.filter(isVideoUpload);
  const others = files.filter((f) => !isVideoUpload(f));

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0) || 1;
  const loaded = { files: 0, videos: 0 };
  const report = () =>
    onProgress?.(Math.round(((loaded.files + loaded.videos) / totalBytes) * 100));

  const tasks: Promise<ApiFile[]>[] = [];
  if (others.length > 0) {
    tasks.push(
      xhrUpload(`${BASE_URL}/files/upload`, 'files', others, (b) => {
        loaded.files = b;
        report();
      }),
    );
  }
  if (videos.length > 0) {
    tasks.push(
      xhrUpload(`${BASE_URL}/files/upload/video`, 'videos', videos, (b) => {
        loaded.videos = b;
        report();
      }),
    );
  }

  return Promise.all(tasks).then((groups) => groups.flat());
}
