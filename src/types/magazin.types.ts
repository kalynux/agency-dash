// Agency Magazin — the agency's business identity surface.
// See api-doc/agency/magazin.md (GET/PATCH /api/agency/magazin).
//
// The magazin is the counterpart of a vendor's Store: it is the single source
// of truth for the agency's public *business* name, description, logo and
// support contacts. The agency *profile* (agency-profile.types.ts) carries the
// personal surface (displayName, avatar) plus logistics/payout/policies.
//
// Unlike the vendor Store, the magazin has NO public slug/URL and NO vacation
// mode — an agency is not a public shopping storefront.

import type { FileRef } from '@/types/file.types';

export interface AgencyMagazin {
  id: string;
  agencyId: string;
  /** Business/display name — required (2–100 chars), not clearable. */
  name: string;
  /** Resolved logo file object, or `null`. Set via `logoFileId`. */
  logo: FileRef | null;
  description: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  supportWhatsapp: string | null;
  /** Optimistic-locking counter — echo it back on PATCH. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * `PATCH /api/agency/magazin` — editable magazin fields. Send only what changed
 * plus the current `version` (required, optimistic locking). Clearable string
 * fields accept `null`/`""` to clear; `name` is required and not clearable.
 */
export interface MagazinUpdatePayload {
  name?: string;
  /** Id of a file uploaded via `POST /api/files/upload`, or `null`/`""` to detach. Read back as the populated `logo` object. */
  logoFileId?: string | null;
  description?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  supportWhatsapp?: string | null;
  /** Required — optimistic-locking guard. Read from the current magazin first. */
  version: number;
}

/** Standard envelope for the magazin read/write endpoints. */
export interface MagazinResponse {
  success: boolean;
  data: AgencyMagazin;
  message?: string;
}
