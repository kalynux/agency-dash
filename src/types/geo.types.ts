// Geospatial addresses — see api-doc/geo/README.md
//
// Every address in the platform (vendor business addresses, agency HQ /
// pickup locations, customer saved addresses, order drop-off) now embeds a
// `GeoAddress`: the provider-neutral value object produced by GET /api/geo/search.
// Users still type free-form text; the backend turns it into map-grade
// candidates, and the candidate the user PICKED is what gets stored — never
// plain text or a bare coordinate alone.
//
// The geocoding provider (Nominatim by default) is a backend config concern.
// Nothing here may depend on which provider resolved a result.

/**
 * GeoJSON Point — coordinates are `[longitude, latitude]`, in that order.
 * Canonical definition; `@/types/api` re-exports it for existing consumers.
 */
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

/**
 * Structured admin breakdown of a resolved address. Every part is nullable —
 * providers vary in what they return, so always guard before using a component
 * as a form value.
 */
export interface GeoComponents {
  street?: string | null;
  neighbourhood?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  /** ISO-3166-1 alpha-2, e.g. "CM". */
  country_code?: string | null;
  postal_code?: string | null;
}

/**
 * One search result. This is the `GeoAddress` shape minus `raw_input` /
 * `resolved_at` — the two fields that only exist once a candidate is stored.
 */
export interface GeoCandidate {
  formatted_address: string;
  /** GeoJSON Point — coordinates are [longitude, latitude]. */
  coordinates: GeoPoint;
  /** Which provider resolved it. Informational only — never branch on this. */
  provider: string;
  provider_place_id?: string | null;
  components: GeoComponents;
}

/**
 * A candidate as it is SENT to (and returned from) an owning endpoint: the
 * selected candidate plus `raw_input` (what the user typed before selecting).
 * `resolved_at` is server-assigned — read it, never send it.
 */
export interface GeoAddress extends GeoCandidate {
  raw_input?: string | null;
  resolved_at?: string;
}

// ─── Endpoint envelopes ───────────────────────────────────────────────────────

export interface GeoSearchResponse {
  success: true;
  data: {
    provider: string;
    query: string;
    results: GeoCandidate[];
  };
}

export interface GeoReverseResponse {
  success: true;
  data: {
    provider: string;
    /** Null when the coordinate resolves to nothing. */
    result: GeoCandidate | null;
  };
}

export interface GeoSearchOptions {
  /** Max candidates, 1–20. Provider default (5) when omitted. */
  limit?: number;
  /** Comma-separated ISO-2 codes to bias results, e.g. "cm" or "cm,ng". */
  country?: string;
  /** Preferred result language, BCP-47 (e.g. "fr"). */
  lang?: string;
}
