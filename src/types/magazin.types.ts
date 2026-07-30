// Agency Magazin — the agency's business surface.
// See api-doc/agency/magazin.md (GET/PATCH /api/agency/magazin).
//
// The magazin is the counterpart of a vendor's Store, and is the single source
// of truth for BOTH the agency's public *business identity* (name, description,
// logo, support contacts) AND its *logistics footprint* (coverageAreas,
// headquartersAddresses). The agency *profile* (agency-profile.types.ts) carries
// only the personal + account surface: displayName, avatar, email/phone, payout,
// policies, KYC, and the set-once `country`.
//
// Coverage + HQ are anchored to that `country`: coverage areas must be region
// keys of it, and every HQ address must geocode inside it.
//
// Unlike the vendor Store, the magazin has NO public slug/URL and NO vacation
// mode — an agency is not a public shopping storefront.

import type { FileRef } from '@/types/file.types';
import type { GeoAddress, GeoPoint } from '@/types/geo.types';
import type { SupportContact } from '@/types/api';

/**
 * An HQ / pickup location as RETURNED by the magazin endpoints.
 *
 * `label`, `region` and `city` are all nullable: `label` is `null` on entries
 * saved before labels existed (fall back to "Primary Headquarters" / "Branch N"),
 * and `region`/`city` are `null` when the entry's geocode named neither — common
 * for rural / landmark results, where `geo.formatted_address` is what to show.
 */
export interface MagazinHeadquartersAddress {
  /** Backend-assigned identity for this entry. */
  _id?: string;
  /**
   * The agency's own name for this location ("Main warehouse", "Yaoundé branch")
   * — the counterpart of a vendor `business_addresses[].label`, and the one
   * field the map result can't supply.
   */
  label: string | null;
  /** Derived from `geo.components.region` on write — never picked by hand. */
  region: string | null;
  /** Derived from `geo.components.city` on write — never picked by hand. */
  city: string | null;
  address_description: string;
  support_contact: SupportContact;
  /** Derived from `geo` on write; kept for map / proximity use. */
  location?: GeoPoint | null;
  /**
   * The canonical geospatial address. Absent only on legacy entries stored
   * before `geo` existed — those are grandfathered until next touched.
   */
  geo?: GeoAddress | null;
}

/**
 * An HQ / pickup location as SENT on `PATCH /api/agency/magazin`.
 *
 * `geo` is the whole placement — `location`, `region` and `city` are all derived
 * from it server-side, so none of them are sent on a geocoded entry.
 */
export interface MagazinHeadquartersAddressInput {
  /** 1–50 chars, required on every entry written. */
  label: string;
  address_description: string;
  support_contact: SupportContact;
  /**
   * Required on every new or edited entry, and must resolve inside the agency's
   * `country` — else `400 ADDRESS_GEO_REQUIRED` / `400 ADDRESS_COUNTRY_MISMATCH`.
   *
   * "Edited" means a changed `address_description` or a changed geocoded place.
   * Renaming a `label` or touching a support contact is NOT a move, so legacy
   * `geo`-less entries keep working across a re-save.
   */
  geo?: GeoAddress | null;
  /** Fallback only, for a place whose geocode names no region. `geo` wins when it has one. */
  region?: string | null;
  /** Fallback only, for a place whose geocode names no city. `geo` wins when it has one. */
  city?: string | null;
}

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
  /** Region keys of the agency's `country`, e.g. ["littoral", "centre"]. */
  coverageAreas: string[];
  /** Physical / pickup locations. Index 0 is the primary headquarters. */
  headquartersAddresses: MagazinHeadquartersAddress[];
  /** Optimistic-locking counter — echo it back on PATCH. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * `PATCH /api/agency/magazin` — editable magazin fields. Send only what changed
 * plus the current `version` (required, optimistic locking).
 *
 * Clearable string fields accept `null`/`""` to clear. `name`, `coverage_areas`
 * and `headquarters_addresses` are NOT clearable: the two arrays are a FULL
 * REPLACE, so always send the complete desired value, never a delta.
 */
export interface MagazinUpdatePayload {
  name?: string;
  /** Id of a file uploaded via `POST /api/files/upload`, or `null`/`""` to detach. Read back as the populated `logo` object. */
  logoFileId?: string | null;
  description?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  supportWhatsapp?: string | null;
  /** FULL REPLACE, min 1. Region keys of the agency's `country`. */
  coverage_areas?: string[];
  /** FULL REPLACE, min 1. Index 0 is the primary headquarters. */
  headquarters_addresses?: MagazinHeadquartersAddressInput[];
  /** Required — optimistic-locking guard. Read from the current magazin first. */
  version: number;
}

/** Standard envelope for the magazin read/write endpoints. */
export interface MagazinResponse {
  success: boolean;
  data: AgencyMagazin;
  message?: string;
}
