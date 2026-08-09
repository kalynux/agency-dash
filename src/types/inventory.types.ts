// Agency Inventory — which SKUs this agency warehouses, at which depot.
// See api-doc/agency/inventory.md.
//
// WHAT THIS IS. A row exists because a vendor CONFIGURED a product to be
// warehoused with us: `delivery.pickupLocation.source === "agency_storage"`,
// pointing at one of our depots (magazin `headquartersAddresses[]`), with the
// resolved delivery agency being us. That is the same `storage_based` fulfilment
// mode a shipment reports as `items[].pickupLocation.mode` (shipment.types.ts),
// and the mode our `policies.pricing.storage_based` fees are charged for —
// including `monthly_storage_fee_per_sku`, which this roster will eventually
// bill per line.
//
// TWO QUANTITIES LIVE ON EVERY ROW. DO NOT MERGE THEM.
//
//   `catalogStock.quantity`  the AGREED quantity — the vendor's catalogue number,
//                            which on a warehoused SKU neither party can change
//                            alone any more (see stock-request.types.ts). Real.
//   `quantityOnHand`         the COUNTED quantity — what somebody physically
//   `quantityReserved`       verified on a shelf. Still structurally 0.
//
// Phase 1 has no intake flow, stock does not move on delivery, and nothing counts
// a shelf, so the second pair stays zero and `countsAreDerived: true` /
// `source: "derived"` describe THEM ONLY. The honest label for them is still "not
// counted"; the honest label for the first is "agreed". When counting lands
// (reservation at checkout, settlement on delivery) rows flip to
// `source: "counted"`, and a client that branches on `source` needs no change.
//
// NO LONGER READ-ONLY. The agency has three levers over a product it warehouses —
// move it to another depot, suspend it off the storefront, put it back — plus the
// proposing half of the two-signature stock flow. All four are keyed on
// `productId`, which only the DETAIL response carries (see `InventoryDetail`).
//
// This is not the vendor's catalogue: a `pickup_based` product of the same vendor
// never appears here, because we hold none of it.

import type { FileRef } from '@/types/file.types';
// The platform's one address-display shape. Defined alongside shipments because
// that is where it first appeared, but it is not shipment-specific — a warehouse
// address and a pickup address print identically, and `describeAddress` is the
// shared one-liner both use.
import type { AddressDetail } from '@/types/shipment.types';

/**
 * Where a row's numbers come from.
 *
 * `derived` — nobody counted; the row exists because a vendor configured the
 * product to be stored here. Quantities are structurally 0 and must not be
 * rendered as a stock level.
 * `counted` — the later phase, where checkout reserves and delivery settles.
 * Not emitted yet; branch on it now so the screen needs no change when it lands.
 */
export type InventoryCountSource = 'derived' | 'counted';

/**
 * The depot a row sits at — an entry of the magazin's `headquartersAddresses`
 * (magazin.types.ts), the same identity Account → Locations edits.
 *
 * `label` and `city` are denormalised onto the payload rather than looked up
 * client-side: magazin labels are nullable and editable, and a row that outlives
 * a rename still has to print something truthful.
 */
export interface InventoryDepot {
  id: string;
  /** The agency's own name for the place, e.g. "Bonabéri branch". */
  label: string | null;
  city: string | null;
  /**
   * The agency's first depot — where a product that names no depot at all is
   * collected from, so its rows are genuinely recorded here.
   */
  isPrimary: boolean;
}

/** The vendor whose goods these are. Resolved live from their Store. */
export interface InventoryVendorSummary {
  id: string;
  businessName: string | null;
}

/**
 * The one open stock-adjustment request on this SKU, summarised onto the row.
 *
 * At most one can be open at a time, which is why this is an object and not an
 * array. `id` is enough to deep-link the requests inbox WITHOUT fetching the
 * detail — the only action a list row can drive on its own.
 */
export interface PendingStockRequestRef {
  id: string;
  /** The ABSOLUTE target if approved, never a delta. */
  requestedQuantity: number;
  requestedByRole: 'vendor' | 'agency';
  /** True when the VENDOR raised it — i.e. it is ours to answer. Badge off this. */
  awaitingMyDecision: boolean;
  requestedAt: string;
  note: string | null;
}

/**
 * The CATALOGUE quantity for this SKU — `ProductVariant.stock`.
 *
 * **Not `quantityOnHand`.** That one is the counted figure and is still 0. This
 * is the number the vendor and the agency now JOINTLY govern (neither writes it
 * alone on a warehoused SKU) and the number the storage fee is quoted against.
 */
export interface CatalogStock {
  /** `null` if the variant was deleted out from under the row. */
  quantity: number | null;
  /**
   * Effectively always `false` for a live warehoused SKU — unlimited stock blocks
   * activation for `agency_storage` products. Only a legacy or suspended row can
   * read `true`.
   */
  isInfinite: boolean | null;
  pendingRequest: PendingStockRequestRef | null;
}

/** Where a variant's dimensions came from, so "unknown" and "30×20×12" stay distinguishable. */
export type StorageSizeSource = 'variant' | 'product_default' | 'unknown';

/**
 * Dimensions, and the volume derived from them.
 *
 * DISPLAYED, NOT PRICED. The rate is flat per SKU because that is the only rate
 * the agency's policy holds — a pallet and an envelope cost the same. This is
 * here so the agency can sanity-check that rate against what it is actually
 * shelving. **Never multiply by it.**
 */
export interface InventoryVariantSize {
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  /** `l × w × h`, only when all three are known. `null` renders "—", NEVER 0. */
  volumeCm3: number | null;
  weightG: number | null;
  source: StorageSizeSource;
}

/**
 * What this SKU should be costing in storage rent, per month.
 *
 * A DISPLAY FIGURE AND NOTHING ELSE. The platform does not track storage payment,
 * does not invoice it, and never acts on it — the only lever attached to it is the
 * agency's own manual suspension. Do not label this "due", "overdue",
 * "outstanding", "invoice" or "paid". It is *what you should be charging*.
 */
export interface InventoryStorageFee {
  /** The only basis today. Named so a later volumetric basis is additive. */
  basis: 'per_sku_monthly';
  /**
   * The agency's `policies.pricing.storage_based.enabled`. When `false` the agency
   * does not offer warehousing at all, `monthlyEstimate` is 0, and the screen must
   * say "not offered" rather than showing a rate nobody agreed to.
   */
  storageBasedEnabled: boolean;
  monthlyRatePerSku: number;
  /**
   * The billable count — `catalogStock.quantity` clamped at 0, and 0 for an
   * unlimited-stock SKU (inventing a quantity for one would be a fabricated charge).
   */
  quantity: number;
  /** `monthlyRatePerSku × quantity`. */
  monthlyEstimate: number;
  /** `null` when neither the variant nor the product carries any dimensions. */
  size: InventoryVariantSize | null;
}

/**
 * Set only for a suspension THIS AGENCY applied.
 *
 * A product suspended by a delivery-agency cascade (the vendor's agency went
 * inactive, their connection needs re-approval) reports `suspension: null` with
 * `productStatus: "suspended"` — show it as suspended but hide the unsuspend
 * button, because that one is not ours to lift and the endpoint 422s.
 */
export interface InventorySuspension {
  /** The reason shown to the vendor. The only explanation they get. */
  note: string | null;
  suspendedAt: string;
  /** What the product returns to on unsuspend. */
  previousStatus: string;
}

/**
 * One row: one SKU at one depot.
 *
 * The unit is the VARIANT, not the product — stock lives on the variant, and
 * that is what `monthly_storage_fee_per_sku` bills. The same variant stored at
 * two depots is TWO rows with two different `id`s, so a row is a shelf, not a
 * product line.
 */
export interface InventoryListItem {
  /** The stock-level ROW id — what the detail endpoint takes. Not a variant id. */
  id: string;
  sku: string | null;
  productTitle: string | null;
  variantTitle: string | null;
  /** Thumbnail — `images[0]` from the detail view. */
  image: FileRef | null;
  vendor: InventoryVendorSummary;
  /**
   * The depot. **Null means unresolved**: the product names a depot we have
   * since deleted, so the goods exist but the platform no longer knows which
   * building. Deliberately not folded into the primary depot — delivery
   * *routing* does fall back there, but attributing one warehouse's goods to
   * another on an inventory screen would be a number nobody can go and verify.
   * Find them with `locationId: 'unassigned'` and re-point the product.
   */
  location: InventoryDepot | null;
  /** COUNTED, always 0 in Phase 1 — see the header. Not `catalogStock.quantity`. */
  quantityOnHand: number;
  /** COUNTED, always 0 in Phase 1 — see the header. */
  quantityReserved: number;
  /** `max(0, onHand − reserved)`. Never negative. */
  quantityAvailable: number;
  /** Describes the two COUNTED figures above only — never `catalogStock`. */
  source: InventoryCountSource;
  /** When the roster last confirmed this row against the catalog. */
  lastReconciledAt: string | null;
  /** The AGREED quantity, and what is pending on it. See {@link CatalogStock}. */
  catalogStock: CatalogStock;
  /** What to charge for shelving this. A display figure. See {@link InventoryStorageFee}. */
  storageFee: InventoryStorageFee;
  /** Non-null only for a suspension WE applied. See {@link InventorySuspension}. */
  suspension: InventorySuspension | null;
  /** The product's own status, so no screen has to infer it from `suspension`. */
  productStatus: string | null;
}

/**
 * Full detail for one row — everything the list has, plus the catalog ids and the
 * depot's address.
 *
 * **`productId` lives HERE and only here.** The list row does not carry it (the
 * backend's `InventoryRowDto` has neither id; only `InventoryDetailDto` does), and
 * all four write actions are keyed on it — which is why they live in the detail
 * sheet rather than on a list row. Do not "helpfully" add `productId` to
 * `InventoryListItem`: this absence is what stops a row action being built on a
 * field that will be `undefined` at runtime.
 */
export interface InventoryDetail extends InventoryListItem {
  productId: string;
  variantId: string;
  /**
   * The depot's full address, resolved **live** from the magazin — so a
   * corrected address shows here immediately. `null` when `location` is null.
   */
  locationAddress: AddressDetail | null;
  /** Every image, thumbnail first. The list's `image` is `images[0]`. */
  images: FileRef[];
  /** Mirrors the list envelope's flag, on the row itself. */
  countsAreDerived: boolean;
}

// ─── Requests & responses ─────────────────────────────────────────────────────

/** `locationId` value that selects rows whose depot no longer exists. */
export const UNASSIGNED_LOCATION = 'unassigned';

export type InventorySortBy = 'createdAt' | 'quantityOnHand' | 'lastReconciledAt';
export type InventorySortDir = 'asc' | 'desc';

/**
 * Query for `GET /agency/inventory`. Unknown parameters are REJECTED with
 * `400 VALIDATION_ERROR`, so nothing outside this shape may be sent.
 */
export interface ListInventoryParams {
  page?: number;
  /** 1–100. Defaults to 20 server-side. */
  limit?: number;
  /** A depot id, or {@link UNASSIGNED_LOCATION} for rows whose depot was deleted. */
  locationId?: string;
  vendorId?: string;
  /** 1–100 chars, case-insensitive, over variant SKU and product title. */
  search?: string;
  sortBy?: InventorySortBy;
  sortDir?: InventorySortDir;
}

export interface InventoryListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListInventoryResponse {
  success: true;
  /** True while quantities are derived rather than counted. Read it before rendering any number. */
  countsAreDerived: boolean;
  data: InventoryListItem[];
  meta: InventoryListMeta;
}

export interface InventoryDetailResponse {
  success: true;
  data: InventoryDetail;
}

/**
 * Query for `GET /agency/inventory/summary`. The SAME filters as the list and
 * nothing else — `page`, `limit`, `sortBy` and `sortDir` are rejected with
 * `400 VALIDATION_ERROR`, so a screen holding one filter object for both calls
 * must narrow it with {@link toSummaryParams} on the way in.
 */
export interface SummaryInventoryParams {
  locationId?: string;
  vendorId?: string;
  search?: string;
}

/**
 * Narrow a list query down to what `/summary` accepts. Exists because the stock
 * tab holds ONE filter object and feeds it to two endpoints with different legal
 * parameter sets — forwarding it whole 400s, but only once the user pages or
 * sorts, i.e. never on the first load where you would notice.
 */
export function toSummaryParams(params: ListInventoryParams): SummaryInventoryParams {
  const { locationId, vendorId, search } = params;
  return { locationId, vendorId, search };
}

/**
 * The screen header. Totals the WHOLE filtered set, not the visible page — which
 * is why it is a separate endpoint rather than a field on the list.
 */
export interface InventorySummary {
  /** Rows matching the filter. Should agree with the list's `meta.total`. */
  skuCount: number;
  /** Rows whose depot we deleted (`location: null`). The re-homing to-do list. */
  unassignedCount: number;
  /** Distinct PRODUCTS we suspended — a product with three variants is one, not three. */
  suspendedCount: number;
  /** Σ of every row's `storageFee.monthlyEstimate`. 0 when storage is not offered. */
  totalMonthlyEstimate: number;
}

export interface InventorySummaryResponse {
  success: true;
  countsAreDerived: boolean;
  data: InventorySummary;
}

// ─── Write actions (all keyed on `productId`, from the DETAIL response) ────────

/**
 * `PATCH /agency/inventory/products/:productId/depot`.
 *
 * `null` IS A REAL ANSWER, not a missing one: it means "track my primary depot",
 * so the product follows `headquartersAddresses[0]` and keeps following it if the
 * depots are later reordered. Every product written before the depot picker
 * existed is in that state — so this must be sent as an explicit body `null`,
 * never an omitted key.
 */
export interface MoveDepotPayload {
  locationId: string | null;
}

export interface MoveDepotResponse {
  success: true;
  data: {
    productId: string;
    locationId: string | null;
    locationLabel: string | null;
    /** How many rows moved — one per active variant, since the depot is named once on the product. */
    affectedRows: number;
  };
  message?: string;
}

export interface SuspendProductPayload {
  /** ≤500 chars. Optional, but it is the ONLY explanation the vendor gets — prompt for it. */
  note?: string;
}

export interface SuspendProductResponse {
  success: true;
  data: { productId: string; status: string; note: string | null };
  message?: string;
}

/**
 * One entry of `error.details.blockers` on `422 INVENTORY_PRODUCT_UNSUSPEND_BLOCKED`.
 *
 * `message` is written by the backend TO BE SHOWN — render the list verbatim. It
 * is what tells the agency what to go back to the vendor about.
 */
export interface UnsuspendBlocker {
  code: string;
  message: string;
  details?: unknown;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * What to call a depot whose `label` is null.
 *
 * Legacy magazin entries were saved before labels existed, so a row can point at
 * an unnamed place. Falls back to the city before giving up, because "Douala"
 * beats "Unnamed location" every time.
 */
export function describeDepot(depot: InventoryDepot | null): string | null {
  if (!depot) return null;
  return depot.label || depot.city || null;
}

/**
 * The three suspension rules, written once.
 *
 * Every one of them is a 422 if a screen guesses instead, and the third is the
 * subtle one: a product CAN be suspended without us having suspended it, and the
 * button must then be absent rather than present-and-failing.
 */

/** Only an `active` product can be suspended — else `422 INVENTORY_PRODUCT_NOT_SUSPENDABLE`. */
export function canSuspend(row: Pick<InventoryListItem, 'productStatus'>): boolean {
  return row.productStatus === 'active';
}

/**
 * Only OUR OWN suspension can be lifted. `suspension === null` while
 * `productStatus === 'suspended'` is a delivery-agency cascade — show it as
 * suspended, hide the button, `422 INVENTORY_PRODUCT_NOT_AGENCY_SUSPENDED`.
 */
export function canUnsuspend(row: Pick<InventoryListItem, 'suspension'>): boolean {
  return row.suspension != null;
}

export function isSuspended(row: Pick<InventoryListItem, 'productStatus'>): boolean {
  return row.productStatus === 'suspended';
}

/**
 * `l × w × h` as text, or `null` when the volume is unknown.
 *
 * Callers render `null` as "—". Never as `0`: a zero reads as a claim that the
 * item has no volume, which is a different statement from "we were not told".
 */
export function describeVolume(size: InventoryVariantSize | null): string | null {
  if (!size || size.volumeCm3 == null) return null;
  return `${size.volumeCm3.toLocaleString()} cm³`;
}

/**
 * `30 × 20 × 12 cm`, or `null` when no dimension is known.
 *
 * Separate from {@link describeVolume} because a partial size is still worth
 * showing — knowing one edge is 120 cm tells an agency something about the shelf
 * even when the volume cannot be computed.
 */
export function describeDimensions(size: InventoryVariantSize | null): string | null {
  if (!size) return null;
  const { lengthCm, widthCm, heightCm } = size;
  if (lengthCm == null && widthCm == null && heightCm == null) return null;
  const part = (n: number | null) => (n == null ? '?' : String(n));
  return `${part(lengthCm)} × ${part(widthCm)} × ${part(heightCm)} cm`;
}
