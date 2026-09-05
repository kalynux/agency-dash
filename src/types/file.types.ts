// Files & uploads (all roles) — see api-doc/uploads/README.md.
//
// The `/api/files` surface is shared by every role and scoped to the caller; for
// an agency it is the media library (api-doc/agency/file-management.md) metered
// against the plan's storage cap (api-doc/agency/storage.md).
//
// Files are FLAT (no folders) and owned by the *actor* who uploaded them. Other
// entities only *reference* a file — the agency avatar, the magazin logo, ticket
// attachments, agent delivery proofs. IMPORTANT: attachment status comes from the
// `usage` object on GET /files/:id, never from `usageCount` (stale on legacy data).

/**
 * Which of the two storage worlds a file lives in.
 *
 * `public` — served by the static mount. `url` is a real, fetchable, sessionless
 * URL and `<img src>` works from any origin.
 * `authorized` — `digital/`, `shipments/` and `ticket-attachments/` left that
 * mount on 2026-08-19. `url` is `null` and the bytes come from the owning
 * entity's own route (for us: `GET /api/agency/shipments/:id/delivery-proof/file`).
 *
 * See api-doc/files/private-files.md.
 */
export type FileAccess = 'public' | 'authorized';

/**
 * A resolved file reference as it appears *embedded* in other resources — an
 * agency avatar, a magazin logo, product media, a delivery proof.
 *
 * ⚠ **`url` is nullable, and that is the migration signal.** The backend made it
 * `string | null` rather than handing back an authorized path *on purpose*: a
 * path here would be a string indistinguishable from a public URL, so every
 * client would keep `<img src={url}>` and silently render nothing for a file it
 * is not entitled to fetch that way — a bug that reads as "the photo is
 * sometimes missing" and takes a week to find. `null` breaks the build instead.
 *
 * Branch on {@link FileAccess}, never on `url` being truthy, and never rebuild a
 * URL from `key` for an `authorized` file — see `resolveFileUrl`.
 */
export interface FileRef {
  id: string;
  key: string;
  /** `null` for an `authorized` file. Never put a null-checked fallback path here. */
  url: string | null;
  /**
   * Which world this file is in. Optional only defensively — the backend always
   * sends it now, but a payload predating 2026-08-19 has none, and an absent
   * value with a populated `url` is a public file.
   */
  access?: FileAccess;
  mimeType: string;
  size: number;
  originalName: string;
}

export interface UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  provider: string;
  ownerType: string;
  createdAt: string;
}

export interface UploadFilesResponse {
  success: true;
  data: UploadedFile[];
}

/** One entry of an UPLOAD_POLICY_VIOLATION error's details.violations[]. */
export interface UploadPolicyViolation {
  code: string;
  message: string;
  /** 0-based index into the uploaded files (absent for request-wide violations). */
  fileIndex?: number;
  metadata?: Record<string, unknown>;
}

// ─── Media library ────────────────────────────────────────────────────────────

export type StorageProvider = 'local' | 's3' | 'gcs' | 'r2' | 'firebase' | 'cloudinary';

export type FileOwnerType = 'vendor' | 'admin' | 'customer' | 'agent' | 'agency' | 'system';

/** Coarse UI category derived from the MIME type. */
export type FileKind = 'image' | 'video' | 'audio' | 'document';

/**
 * Broad media category understood by the backend `category` filter on GET /files.
 * Superset of {@link FileKind} — adds `archive` and `other`.
 */
export type MediaCategory = FileKind | 'archive' | 'other';

/**
 * List-item shape returned by GET /files. `url` is populated by the backend when
 * available; when absent, build a public URL from `key` (see `resolveFileUrl`).
 */
export interface ApiFile {
  id: string;
  key: string;
  /**
   * `null`/absent for an `authorized` file — see {@link FileAccess}. A missing
   * `url` on a `public` file is the legacy case `resolveFileUrl` rebuilds from
   * `key`; on an authorized one it must never be rebuilt.
   */
  url?: string | null;
  /** Which storage world this is. Absent on payloads predating 2026-08-19. */
  access?: FileAccess;
  provider: StorageProvider;
  mimeType: string;
  size: number;
  originalName?: string;
  /**
   * Reference count. Present in the payload but intentionally NOT used for UI
   * logic — attachment status is computed from `usage` (GET /files/:id).
   */
  usageCount: number;
  ownerType?: FileOwnerType;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Every entity type that can reference a file. Open-ended (`string`) so a type
 * the backend adds later still resolves to a generic row instead of breaking.
 */
export type FileReferenceEntityType =
  | 'agency'
  | 'magazin'
  | 'agent'
  | 'shipment'
  | 'ticket'
  | 'vendor'
  | 'store'
  | 'product'
  | 'variant'
  | 'digital_asset'
  | 'customer'
  | 'admin'
  | (string & {});

/** The slot on the entity that the file fills. */
export type FileReferenceField =
  | 'avatar'
  | 'logo'
  | 'banner'
  | 'cover'
  | 'media'
  | 'attachment'
  | 'delivery_proof'
  | (string & {});

/** One live reference to a file, across ALL entity types. */
export interface FileReference {
  entityType: FileReferenceEntityType;
  entityId: string;
  field: FileReferenceField;
  /** Human-readable name: ticket subject, agency/magazin name, product title… */
  label: string;
}

/** Legacy catalog-only usage arrays. Vendor-shaped; an agency reads `references`. */
export interface FileUsageProduct {
  id: string;
  title: string;
  type: string;
  status: string;
}

export interface FileUsageVariant {
  id: string;
  productId: string;
  sku: string;
  status: string;
}

export interface FileUsageDigitalAsset {
  id: string;
  productId?: string;
  variantId?: string;
  name?: string;
  status?: string;
}

export interface FileUsage {
  /** Count of every live reference to this file. `> 0` blocks deletion (409). */
  totalReferences: number;
  /**
   * Preferred source of truth for "where is this used" — covers every entity
   * type (avatar/logo/ticket attachment/delivery proof). Optional so an older
   * backend that only sends the legacy arrays below still works.
   */
  references?: FileReference[];
  // ── Legacy (vendor catalog only) — kept for tolerance; prefer `references`. ──
  products?: FileUsageProduct[];
  variants?: FileUsageVariant[];
  digitalAssets?: FileUsageDigitalAsset[];
}

/** Single-resource shape returned by GET /files/:id — adds checksum + usage. */
export interface ApiFileDetail extends ApiFile {
  checksum?: string;
  usage: FileUsage;
}

export interface FilePagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export type FileSortField = 'createdAt' | 'updatedAt' | 'size' | 'originalName';

export interface FileListParams {
  page?: number;
  /** 1–50. */
  limit?: number;
  /** Case-insensitive substring match on `originalName`. */
  search?: string;
  /** Broad category filter. Ignored by the backend when `mimeType` is set. */
  category?: MediaCategory;
  /** Exact MIME type — takes precedence over `category`. */
  mimeType?: string;
  provider?: StorageProvider;
  ownerType?: FileOwnerType;
  /** Size bounds, in bytes (inclusive). */
  minSize?: number;
  maxSize?: number;
  /** ISO-8601 date bounds. */
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: FileSortField;
  sortOrder?: 'asc' | 'desc';
}

// ─── Storage usage (api-doc/agency/storage.md §2) ─────────────────────────────
// Total media bytes the agency owns, against its plan cap. Everything counts —
// avatar, magazin logo, uploads, and agent delivery proofs. Nothing is excluded.

export interface StorageCategoryUsage {
  bytes: number;
  count: number;
}

export interface StorageUsage {
  /** Active plan's `max_storage_bytes`. `null` = no cap. */
  limitBytes: number | null;
  /** Total media bytes in use; equals the sum of `byCategory[*].bytes`. */
  usedBytes: number;
  /** `max(0, limitBytes − usedBytes)`. `null` when there is no limit. */
  remainingBytes: number | null;
  /** Per-category `bytes` + file `count`. */
  byCategory?: Record<MediaCategory, StorageCategoryUsage>;
}

// ─── Response envelopes ───────────────────────────────────────────────────────

export interface StorageUsageResponse {
  success: true;
  data: StorageUsage;
}

export interface FileListResponse {
  success: boolean;
  data: {
    files: ApiFile[];
    pagination: FilePagination;
    /**
     * The same object as GET /files/storage, embedded so a media-library screen
     * can show usage without a second call. `null` for roles with no owner scope.
     */
    storage?: StorageUsage | null;
  };
}

export interface FileDetailResponse {
  success: boolean;
  data: ApiFileDetail;
}

export interface FileUpdateResponse {
  success: boolean;
  data: ApiFile;
  message?: string;
}
