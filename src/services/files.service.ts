// ─── File management service ──────────────────────────────────────────────────
// Talks to the shared `/api/files` surface, automatically scoped to the agency
// (api-doc/agency/file-management.md, api-doc/agency/storage.md).
//
// Files are FLAT (no folders). Attachment status comes from the `usage` object on
// GET /files/:id — never from `usageCount`.

import { api, BASE_URL } from './api';
import { authStrategy } from '@/platform/auth/strategy';
import { txStatic } from '@/i18n/tx';
import { ApiError, ERROR_CATEGORIES, type ErrorCategory } from '@/types/api';
import type {
  ApiFile,
  ApiFileDetail,
  FileAccess,
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

/**
 * Resolve a displayable URL for a file, preferring the backend-populated `url`.
 *
 * **Never put `crossOrigin` on the tag that renders one of these.** These URLs
 * point at the API host, so every media load is cross-origin, and which of two
 * unrelated mechanisms decides whether the browser paints the bytes depends
 * entirely on whether that attribute is present:
 *
 * - **Without it** the load is a no-CORS request. CORS never enters into it; the
 *   gate is the response's `Cross-Origin-Resource-Policy`, which the backend
 *   sets to `cross-origin` on the public storage trees (jovi-mall
 *   `src/api/index.ts`). That works from every origin — the web dashboard, the
 *   dev server, the Capacitor WebView — with nothing allowlisted anywhere.
 * - **With it** — either value — the load becomes a CORS request, which
 *   additionally requires the API to name this exact origin in
 *   `ALLOWED_ORIGINS`. That makes an avatar depend on a backend env var, and
 *   breaks on any client whose origin is not in that list.
 *
 * Files are served publicly, so no credential is needed either way. The one
 * thing the attribute would buy is un-tainted canvas readback of these pixels;
 * nothing here does that, and anything that starts to should fetch the bytes
 * through the API instead of reaching for `crossOrigin`.
 *
 * See CAPACITOR-PLAN.md → P5b.4 for the incident this came out of.
 *
 * ⚠ **Returns `null` for an `authorized` file, and callers must handle that.**
 * Three storage trees — `digital/`, `shipments/` and `ticket-attachments/` —
 * left the static mount on 2026-08-19, so they have no public URL at all. The
 * `key` fallback below would manufacture one that looks exactly like a real URL
 * and serves 401/404 to everybody; `null` is what stops that. For this dashboard
 * the tree that matters is `shipments/` — i.e. **every delivery-proof photo**,
 * which is fetched through `shipmentsService.getDeliveryProofFile` instead.
 * See api-doc/files/private-files.md.
 */
export function resolveFileUrl(
  file: Pick<ApiFile, 'url' | 'key'> & { access?: FileAccess },
): string | null {
  if (isAuthorizedFile(file)) return null;
  if (file.url) return file.url;
  const base = FILE_PUBLIC_BASE.replace(/\/$/, '');
  const key = file.key.replace(/^\//, '');
  return `${base}/${key}`;
}

/** The three storage trees that left the public mount. */
const AUTHORIZED_KEY_PREFIXES = ['digital/', 'shipments/', 'ticket-attachments/'] as const;

/**
 * True when a file must be fetched through its owning entity's route.
 *
 * Reads `access` when the payload carries it, and falls back to the key prefix
 * — which is the same thing the backend routes on, so the two cannot disagree.
 * The fallback is what covers a response written before `access` existed.
 */
export function isAuthorizedFile(
  file: Pick<ApiFile, 'url' | 'key'> & { access?: FileAccess },
): boolean {
  if (file.access) return file.access === 'authorized';
  const key = file.key.replace(/^\//, '');
  return AUTHORIZED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
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
// Auth comes from the same `authStrategy` api.ts uses — `withCredentials` on the
// cookie transport, an `Authorization` header on the bearer one.
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
  /** `media:` key — module-scope data can't hold a translated string. */
  labelKey: string;
}[] = [
  { match: (m, e) => m === 'image/gif' || e === 'gif', bytes: 5 * MB, labelKey: 'media:upload.caps.gif' },
  { match: (m, e) => m === 'application/pdf' || e === 'pdf', bytes: 25 * MB, labelKey: 'media:upload.caps.pdf' },
  { match: (m, e) => m === 'application/zip' || e === 'zip', bytes: 50 * MB, labelKey: 'media:upload.caps.zip' },
  { match: (m) => m.startsWith('image/'), bytes: 10 * MB, labelKey: 'media:upload.caps.image' },
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

function capFor(file: File): { bytes: number; labelKey: string } {
  const mime = file.type ?? '';
  const ext = extensionOf(file);
  return (
    PER_TYPE_CAPS.find((c) => c.match(mime, ext)) ?? {
      bytes: DEFAULT_MAX_BYTES,
      labelKey: 'media:upload.caps.default',
    }
  );
}

/**
 * Validate a mixed selection client-side before uploading. Returns a localized
 * error message, or `null` when the selection is acceptable.
 */
export function validateMediaSelection(files: File[]): string | null {
  const videos = files.filter(isVideoUpload);
  const others = files.filter((f) => !isVideoUpload(f));

  if (others.length > MAX_FILES_PER_UPLOAD) {
    return txStatic('media:upload.tooManyFiles', { count: MAX_FILES_PER_UPLOAD });
  }
  if (videos.length > MAX_VIDEOS_PER_UPLOAD) {
    return txStatic('media:upload.tooManyVideos', { count: MAX_VIDEOS_PER_UPLOAD });
  }

  for (const file of others) {
    const cap = capFor(file);
    if (file.size > cap.bytes) {
      return txStatic('media:upload.overTypeLimit', {
        name: file.name,
        limit: txStatic(cap.labelKey),
      });
    }
  }

  const bigVideo = videos.find((f) => f.size > VIDEO_MAX_BYTES);
  if (bigVideo) return txStatic('media:upload.overVideoLimit', { name: bigVideo.name });

  const badFormat = videos.find(
    (f) => f.type && !(VIDEO_MIME_TYPES as readonly string[]).includes(f.type),
  );
  if (badFormat) return txStatic('media:upload.unsupportedVideo', { name: badFormat.name });

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
  const requestId =
    (body.requestId as string) ?? xhr.getResponseHeader('X-Request-Id') ?? undefined;
  const rawCategory = error.category;
  const category = (ERROR_CATEGORIES as readonly string[]).includes(rawCategory as string)
    ? (rawCategory as ErrorCategory)
    : undefined;

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

  return new ApiError(xhr.status, code, message, details, requestId, category);
}

/** Low-level XHR upload to a single route. Reports bytes loaded for aggregation. */
async function xhrUpload(
  url: string,
  fieldName: string,
  files: File[],
  onBytes?: (loaded: number) => void,
): Promise<ApiFile[]> {
  // Authenticated the same way as every other request, just by hand — this is the
  // one path that does not go through api.ts, and without this it would be the
  // one feature that fails AFTER a successful sign-in.
  //
  // Known gap, deliberately not closed here: a 401 on this route cannot trigger
  // the single-flight refresh that api.ts owns, so an access token that expires
  // mid-upload fails the upload rather than recovering. On cookies the server
  // refreshes silently and it cannot happen; on bearer the proactive scheduler
  // (P2.5) is what keeps it from happening. Duplicating the refresh queue here
  // would be the wrong fix — it has to exist exactly once.
  const authHeaders = await authStrategy.authHeaders();

  return new Promise((resolve, reject) => {
    const fd = new FormData();
    files.forEach((f) => fd.append(fieldName, f));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = authStrategy.credentials === 'include';
    // Must follow open() — setRequestHeader on an unopened XHR throws InvalidStateError.
    Object.entries(authHeaders).forEach(([name, value]) => xhr.setRequestHeader(name, value));

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
