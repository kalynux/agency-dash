// Files & uploads (all roles) — see api-doc/uploads/README.md

/**
 * A resolved file reference as it appears *embedded* in other resources — an
 * agency avatar, a magazin logo, product media, etc. Same shape everywhere:
 * `{ id, key, url, mimeType, size, originalName }`. Distinct from
 * {@link UploadedFile}, which is the richer payload returned by the upload
 * endpoint itself.
 */
export interface FileRef {
  id: string;
  key: string;
  url: string;
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

export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
  fileCount: number;
  plan: string;
}

export interface StorageUsageResponse {
  success: true;
  data: StorageUsage;
}

/** One entry of an UPLOAD_POLICY_VIOLATION error's details.violations[]. */
export interface UploadPolicyViolation {
  code: string;
  message: string;
  /** 0-based index into the uploaded files (absent for request-wide violations). */
  fileIndex?: number;
  metadata?: Record<string, unknown>;
}
