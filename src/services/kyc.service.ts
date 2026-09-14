// ─── Agency identity verification (KYC) ───────────────────────────────────────
// `/api/agency/kyc` — see api-doc/agency/identity-verification.md.
//
// Six routes, all scoped to the calling agency: read the record, patch the typed
// half, upload into a slot, delete one file from a slot, submit, and fetch the
// bytes of one document. Five of the six answer the WHOLE record, so every write
// here returns a `KycRecord` the caller can drop straight into state — there is
// never a reason to refetch after one.

import { api } from './api';
import { txStatic } from '@/i18n/tx';
import type {
  KycDocumentRef,
  KycDocumentSlot,
  KycHomeAddress,
  KycRecord,
  KycRecordResponse,
  KycStatus,
  KycUpdatePayload,
} from '@/types/kyc.types';
import type { GeoAddress } from '@/types/geo.types';

const BASE = '/agency/kyc';

// ─── Slots ────────────────────────────────────────────────────────────────────

/**
 * The five slots the backend accepts, in the order the form presents them.
 * Anything else is `400 KYC_SLOT_UNKNOWN`.
 */
export const KYC_DOCUMENT_SLOTS = [
  'id_card_front',
  'id_card_back',
  'selfie_with_id',
  'home_address_sketch',
  'store_address_sketch',
] as const satisfies readonly KycDocumentSlot[];

/** Slots that hold exactly one file — re-uploading REPLACES, deleting the old. */
const SINGLE_VALUE_SLOTS = new Set<KycDocumentSlot>([
  'id_card_front',
  'id_card_back',
  'selfie_with_id',
]);

/** True when uploading into this slot replaces its file rather than appending. */
export function isSingleValueSlot(slot: KycDocumentSlot): boolean {
  return SINGLE_VALUE_SLOTS.has(slot);
}

/**
 * The files currently in a slot, always as an array so one renderer serves both
 * cardinalities. Order matches the backend's.
 */
export function filesInSlot(record: KycRecord, slot: KycDocumentSlot): KycDocumentRef[] {
  const d = record.documents;
  switch (slot) {
    case 'id_card_front':
      return d.idCardFront ? [d.idCardFront] : [];
    case 'id_card_back':
      return d.idCardBack ? [d.idCardBack] : [];
    case 'selfie_with_id':
      return d.selfieWithId ? [d.selfieWithId] : [];
    case 'home_address_sketch':
      return d.homeAddressSketches ?? [];
    case 'store_address_sketch':
      return d.storeAddressSketches ?? [];
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * What the record is actually doing, which `status` alone cannot say.
 *
 * ⚠ `status: "pending"` is the schema DEFAULT, so it covers both "nobody has
 * looked yet" and "never touched". `submittedAt` is the field that separates a
 * draft from a submission under review — see the table in
 * api-doc/agency/identity-verification.md. Every branch in the UI reads this,
 * never `status`.
 *
 * An unrecognised `status` falls through to the `submittedAt` test rather than
 * to a verdict, which is the safe side of the two: it shows the record as a
 * draft or as under review, never as approved.
 */
export type KycPhase = 'draft' | 'under_review' | 'verified' | 'rejected';

export function kycPhase(record: Pick<KycRecord, 'status' | 'submittedAt'>): KycPhase {
  if (record.status === 'verified') return 'verified';
  if (record.status === 'rejected') return 'rejected';
  return record.submittedAt ? 'under_review' : 'draft';
}

// ─── File rules ───────────────────────────────────────────────────────────────
// `core/uploads/upload-config.ts` → `getKycDocumentUploadConfig`. A UX guard
// only: the server re-validates by sniffing the bytes, and a violation comes
// back as `422 UPLOAD_POLICY_VIOLATION` with `details.violations[]`.

const MB = 1024 * 1024;

/**
 * PDF is accepted everywhere in this module, on purpose: a scan arrives from a
 * phone as a JPEG and from a scanner app or a printer as a PDF, and making the
 * agency convert is the step at which a legible document becomes an illegible
 * one.
 */
export const KYC_ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

/** Extensions paired with the MIME list, for browsers that leave `File.type` empty. */
const KYC_ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'] as const;

/** `accept` attribute for the file input — MIME types and extensions both. */
export const KYC_ACCEPT_ATTRIBUTE = [
  ...KYC_ACCEPTED_MIME_TYPES,
  ...KYC_ACCEPTED_EXTENSIONS.map((e) => `.${e}`),
].join(',');

export const KYC_MAX_FILE_BYTES = 10 * MB;
/** The same ceiling in MB, for the copy that names it. */
export const KYC_MAX_FILE_MB = KYC_MAX_FILE_BYTES / MB;
export const KYC_MAX_FILES_PER_REQUEST = 10;

/**
 * Fallback for `limits.multiSlotMaxFiles`. Always prefer the value on the
 * record — it is served precisely so this constant can never be the one that
 * decides.
 */
export const KYC_DEFAULT_MULTI_SLOT_MAX = 10;

function extensionOf(file: File): string {
  return file.name.split('.').pop()?.toLowerCase() ?? '';
}

/** Is this a type the KYC upload config accepts? */
export function isAcceptedKycFile(file: File): boolean {
  if (file.type) return (KYC_ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type);
  return (KYC_ACCEPTED_EXTENSIONS as readonly string[]).includes(extensionOf(file));
}

/**
 * True for the types a browser can paint inline; everything else accepted here
 * is a PDF, which is shown as a labelled file row instead of a preview.
 */
export function isPreviewableImage(mimeType: string | undefined): boolean {
  return !!mimeType && mimeType.startsWith('image/');
}

/**
 * Short format token for a stored document — `PDF`, `JPEG`, `PNG`, `WEBP`.
 *
 * Deliberately not translated: these are format names, not copy, and they read
 * the same in every language this dashboard speaks. Falls back to the filename's
 * extension because `mimeType` can arrive empty from a browser that failed to
 * sniff the file, and returns `null` rather than a guess when neither says.
 */
export function documentTypeLabel(doc: Pick<KycDocumentRef, 'mimeType' | 'originalName'>): string | null {
  const subtype = doc.mimeType?.split('/')[1]?.split('+')[0];
  if (subtype) return subtype.toUpperCase();
  const ext = doc.originalName?.split('.').pop();
  return ext && ext !== doc.originalName ? ext.toUpperCase() : null;
}

/**
 * True when this file is being held back because the agency is over its plan's
 * storage cap — a BILLING state, not a privacy one. The content route will not
 * serve it either, so it must be rendered as "over your storage limit" rather
 * than as a missing or broken file.
 *
 * Deliberately not `files.service`'s `isQuotaBlockedFile`: that one needs a
 * `key` (optional on this payload) for its key-prefix fallback, and that
 * fallback knows only the three trees that left the public mount in 2026-08 —
 * `kyc/` is not one of them and would resolve to `public`, which is the exact
 * opposite of the truth. Every file here carries `access`, so read it directly.
 */
export function isQuotaBlockedDocument(doc: Pick<KycDocumentRef, 'access'>): boolean {
  return doc.access === 'quota_blocked';
}

/**
 * Validate a selection before it leaves the browser. Returns a localized message
 * or `null` when the selection is acceptable.
 *
 * `room` is how many more files the target slot can take — the backend checks
 * the multi-slot ceiling against what is ALREADY stored, *before* anything
 * uploads, so a selection that would overflow is refused whole (`422
 * KYC_SLOT_FULL`) rather than partially accepted. Catching it here says so in
 * one sentence instead of a status code.
 */
export function validateKycSelection(files: File[], room: number): string | null {
  if (files.length === 0) return null;

  if (files.length > KYC_MAX_FILES_PER_REQUEST) {
    return txStatic('account:verification.upload.tooManyFiles', {
      count: KYC_MAX_FILES_PER_REQUEST,
    });
  }
  if (files.length > room) {
    return txStatic('account:verification.upload.slotFull', { count: room });
  }

  const wrongType = files.find((f) => !isAcceptedKycFile(f));
  if (wrongType) {
    return txStatic('account:verification.upload.unsupportedType', { name: wrongType.name });
  }

  const tooBig = files.find((f) => f.size > KYC_MAX_FILE_BYTES);
  if (tooBig) {
    return txStatic('account:verification.upload.overSizeLimit', {
      name: tooBig.name,
      limit: KYC_MAX_FILE_BYTES / MB,
    });
  }

  return null;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * Adapt a STORED home address into the `GeoAddress` shape `AddressSearchInput`
 * renders its confirmation chip from.
 *
 * ⚠ **Display only. Never PATCH the result.** The read shape carries no
 * `components` and no `provider_place_id`, so this fills them in with empties —
 * a hand-assembled candidate, which is precisely what the backend's `geocoded`
 * badge exists to distinguish from a real geocoder result. Sending one back
 * would pass the machine check and fail the human one. A change to the address
 * is always a freshly picked candidate; see `VerificationSettings`.
 */
export function homeAddressForDisplay(address: KycHomeAddress): GeoAddress {
  return {
    formatted_address: address.formattedAddress,
    coordinates: { type: 'Point', coordinates: address.coordinates },
    provider: address.provider,
    components: {},
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const kycService = {
  /**
   * `GET /agency/kyc` — the whole record. Safe at any time: an agency that has
   * never touched verification gets a fully-formed empty record, not a 404.
   */
  async getRecord(): Promise<KycRecord> {
    const res = await api.get<KycRecordResponse>(BASE);
    return res.data;
  },

  /** `PATCH /agency/kyc` — the typed half. Answers the whole record. */
  async updateRecord(payload: KycUpdatePayload): Promise<KycRecord> {
    const res = await api.patch<KycRecordResponse>(BASE, payload);
    return res.data;
  },

  /**
   * `POST /agency/kyc/documents/:slot` — multipart, field name **`documents`**.
   * Answers `201` with the whole record.
   *
   * The field name is the one thing here that fails quietly if it is wrong: the
   * request succeeds as far as the transport is concerned and comes back
   * `400 KYC_FILE_REQUIRED`.
   */
  async uploadDocuments(slot: KycDocumentSlot, files: File[]): Promise<KycRecord> {
    const form = new FormData();
    files.forEach((f) => form.append('documents', f));
    const res = await api.postForm<KycRecordResponse>(`${BASE}/documents/${slot}`, form);
    return res.data;
  },

  /**
   * `DELETE /agency/kyc/documents/:slot/:fileId` — remove one file from a slot.
   * `404 KYC_DOCUMENT_NOT_FOUND` when that file is not in that slot.
   */
  async deleteDocument(slot: KycDocumentSlot, fileId: string): Promise<KycRecord> {
    const res = await api.delete<KycRecordResponse>(`${BASE}/documents/${slot}/${fileId}`);
    return res.data;
  },

  /**
   * `POST /agency/kyc/submit` — hands the record to the reviewers: stamps
   * `submittedAt`, clears any previous `rejectionReason`, and FREEZES it.
   *
   * ⚠ It accepts anything, including an empty record. Completeness is the
   * reviewers' policy, not the API's — see `kyc-checklist.ts`. It does not
   * re-open a verified record: that answers `409 KYC_LOCKED`.
   *
   * The doc describes this route's effect but not its body. Every other write in
   * the module answers the whole record, so use that when it is there and re-read
   * when it is not — `locked` is the field this response decides, and a form left
   * rendering a stale `locked: false` invites a write that can only 409.
   */
  async submit(): Promise<KycRecord> {
    const res = await api.post<KycRecordResponse | undefined>(`${BASE}/submit`);
    return res?.data ?? (await api.get<KycRecordResponse>(BASE)).data;
  },

  /**
   * `GET /agency/kyc/documents/:fileId/content` — the raw bytes of one of the
   * agency's own documents. **Not a JSON envelope**, and the only way to display
   * one of these files.
   *
   * Works while the record is locked: an agency under review still has to be
   * able to see what it submitted.
   */
  getDocumentContent(fileId: string): Promise<Blob> {
    return api.getBlob(`${BASE}/documents/${fileId}/content`);
  },
};

/** Re-exported so consumers can type a verdict without a second import. */
export type { KycStatus };
