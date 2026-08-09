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
  /**
   * The `_id` of an entry that already exists. **Send it for every entry you are
   * keeping**, and omit it only for a genuinely new location.
   *
   * `headquarters_addresses` is a full-array replace, and a depot is referenced
   * by `_id` from outside the magazin — a vendor pins a product at one
   * (`delivery.pickupLocation.agencyAddressId`) and orders carry that id through
   * to the agent's pickup address. An entry written without its `id` is stored
   * as a NEW row with a new `_id`, silently re-pointing every product that named
   * the old one at the primary depot. There is a safety net — an entry whose
   * `address_description` *and* geocoded place both still match an existing one
   * inherits its `_id` — but it does not survive an edit to the address text.
   *
   * Two entries sharing one `id` → `400`; an `id` that isn't on this magazin →
   * `409 MAGAZIN_CONFLICT` (`details.unknownIds`), i.e. refetch.
   */
  id?: string;
  /** 1–50 chars, required on every entry written. */
  label: string;
  address_description: string;
  support_contact: SupportContact;
  /**
   * Required on every new or edited entry, and must resolve inside the agency's
   * `country` — else `400 ADDRESS_GEO_REQUIRED` / `400 ADDRESS_COUNTRY_MISMATCH`.
   *
   * "Unchanged" — and so grandfathered past `ADDRESS_GEO_REQUIRED` — means the
   * same geocoded place, plus EITHER the same `address_description` OR a
   * matching `id`. So with an `id` echoed back, correcting the address text is
   * not an edit; moving the pin always is, `id` or not.
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

// ─── 409 MAGAZIN_LOCATION_IN_USE ──────────────────────────────────────────────

/** One depot that still holds stored SKUs, from `details.locations[]`. */
export interface MagazinLocationInUse {
  id: string;
  label: string | null;
  /** How many stored SKUs still name this depot. See api-doc/agency/inventory.md. */
  skuCount: number;
}

/**
 * The depots a refused save tried to drop while they still hold stock.
 *
 * Unlike the other 409 on this endpoint, retrying does NOT help — the products
 * have to be re-pointed (or cleared) first — so this is worth naming rather than
 * folding into the optimistic-locking refresh path.
 */
export function getLocationsInUse(details: unknown): MagazinLocationInUse[] {
  const raw = (details as { locations?: unknown } | null | undefined)?.locations;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const { id, label, skuCount } = entry as Record<string, unknown>;
    return [
      {
        id: String(id ?? ''),
        label: typeof label === 'string' ? label : null,
        skuCount: typeof skuCount === 'number' ? skuCount : 0,
      },
    ];
  });
}
