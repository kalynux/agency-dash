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
//                            alone (see stock-request.types.ts).
//   `quantityOnHand`         the COUNTED quantity — what is physically on the
//   `quantityReserved`       shelf. Moved by US (receipts, returns, counts,
//                            transfers) and by the order path as customers buy.
//
// BOTH ARE REAL NOW. The physical shelf shipped: receipts, returns, physical
// counts, depot-to-depot transfers and a movement ledger (§6–§7 of the doc). The
// two numbers are ALLOWED TO DISAGREE, and the disagreement is information
// rather than an error — a vendor sells the same SKU through other channels, a
// delivery arrived but was not booked in, a box is missing. `POST /:id/count` is
// how the difference is settled.
//
// ⚠ `source: "derived"` with quantities of `0` does NOT mean "we hold none". It
// means NOBODY HAS SAID. Until a receipt is recorded the platform makes no claim
// about that shelf, its storage fee quotes 0, the monthly statement skips it
// entirely, and the order path leaves its counters alone. "Not counted yet" and
// "empty" are different sentences and must render differently.
//
// `countsAreDerived` at the top level is COMPUTED — true only when *every* row in
// the response is uncounted. On a mixed page it is `false` while uncounted rows
// are still present, so read the per-row `source`; the top-level flag is a
// shortcut for a screen that has not started counting at all.
//
// NO LONGER READ-ONLY. The agency has three levers over a product it warehouses —
// move it to another depot, suspend it off the storefront, put it back — plus the
// proposing half of the two-signature stock flow. All four are keyed on
// `productId`, which only the DETAIL response carries (see `InventoryDetail`).
// The four counting verbs are keyed on the ROW instead, because a receipt is a
// physical event at one shelf.
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
 * Where a row's counted numbers come from.
 *
 * `derived` — **nobody has counted this shelf.** The row exists only because a
 * vendor configured the product to be stored here. Its quantities are `0`
 * because there is no claim to make, not because the shelf is empty, and they
 * must never be rendered as a stock level. The storage statement skips the row
 * and the order path leaves its counters alone.
 *
 * `counted` — somebody recorded a receipt, and from that moment the row is live:
 * checkout reserves against it, sales decrement it, returns restore it, and the
 * monthly storage statement bills it.
 *
 * **The first receipt is what flips it.** There is no other transition.
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
  /**
   * COUNTED — what is physically on this shelf. Not `catalogStock.quantity`.
   *
   * ⚠ **Can go negative**, and that is a signal rather than a bug: more has been
   * sold from this shelf than was ever recorded as arriving, usually a delivery
   * nobody booked in. Our own verbs refuse to go below zero; the ORDER path does
   * not, because refusing there would fail a customer's checkout over our
   * paperwork, and clamping would hide the gap for good. Settle it with a count.
   */
  quantityOnHand: number;
  /** COUNTED — units held by checkouts that have not completed or lapsed. */
  quantityReserved: number;
  /** `max(0, onHand − reserved)`. Never negative, even when `quantityOnHand` is. */
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

// ─── The physical shelf (all keyed on the ROW id, from the list) ──────────────
//
// Four verbs, keyed on the STOCK ROW rather than on the product — a receipt is a
// physical event at one shelf, and two variants of one product can arrive on
// different days. All four answer `201` with the row's new balances.

/**
 * `POST /agency/inventory/:id/receipts` and `POST /:id/returns`.
 *
 * A receipt is goods arriving; a return is goods going back to the vendor. Same
 * body, opposite sign.
 *
 * ⚠ **The first receipt on a row is what makes it counted** — it flips `source`
 * to `"counted"`, after which sales move its counters and the monthly storage
 * statement bills against it. Until then the platform makes no claim about that
 * shelf at all.
 *
 * A return is refused with `422 INVENTORY_INSUFFICIENT_STOCK` when the shelf does
 * not hold that many; `details` carries `quantityOnHand`, `quantityReserved` and
 * `requested`.
 */
export interface StockMovementPayload {
  /** A positive integer. */
  quantity: number;
  /** Free text — e.g. a delivery-note number. */
  reason?: string;
}

/**
 * `POST /agency/inventory/:id/count` — a physical count.
 *
 * ⚠ **Send what you counted, not the difference.** The platform works out the
 * delta against whatever the record says at that instant, *inside the same
 * transaction that applies it*, so a sale landing mid-count cannot turn a
 * correction into a second error. `0` is a legitimate count.
 *
 * `reason` is **required** here and optional everywhere else: this is the only
 * verb that moves stock with no physical event behind it, so it is the only
 * record that will ever explain the difference between "we miscounted" and "a
 * box is missing".
 *
 * A count that matches the record still writes a movement, with a delta of 0.
 * "We checked, and it was right" is worth having in the ledger.
 */
export interface StockCountPayload {
  /** The absolute figure counted on the shelf. Never a delta. `0` is valid. */
  countedQuantity: number;
  /** Required. The only thing that will ever explain the difference. */
  reason: string;
}

/**
 * `POST /agency/inventory/:id/transfers` — move stock between our own depots.
 *
 * Two movements land in one transaction, so the units are never in both
 * buildings or in neither. The destination row is created if we have never held
 * that SKU there.
 *
 * ⚠ **A transfer moves goods; it does not move the arrangement.** The product
 * still names the depot its vendor chose, so the next reconcile re-derives the
 * original row. To make the SKU *live* at the other depot, follow up with
 * {@link MoveDepotPayload} — and note the order matters, because re-pointing now
 * answers `409 INVENTORY_DEPOT_CHANGE_HOLDS_STOCK` while counted units are still
 * on the old shelf. Transfer first, then re-point. That matches physical reality,
 * which is the point.
 */
export interface StockTransferPayload {
  /** One of our own depots. `null` means the primary depot. */
  toLocationId: string | null;
  quantity: number;
  reason?: string;
}

/** What all four counting verbs answer with: the row's new balances. */
export interface StockMovementResult {
  stockLevelId: string;
  quantityOnHand: number;
  quantityReserved: number;
  movementId: string;
  /** The signed change this call actually applied. `0` on a count that matched. */
  appliedDelta: number;
}

export interface StockMovementResponse {
  success: true;
  data: StockMovementResult;
  message?: string;
}

/**
 * What moved a shelf, and who moved it.
 *
 * The `agency` rows are ours — the four verbs above. The `system` rows are the
 * order path, and we never write them: a checkout holds units (`reservation`),
 * gives them up (`reservation_released`), completes (`sale`), or a delivered
 * parcel comes back (`customer_return`).
 */
export type StockMovementType =
  | 'receipt'
  | 'return_to_vendor'
  | 'count_adjustment'
  | 'transfer_out'
  | 'transfer_in'
  | 'reservation'
  | 'reservation_released'
  | 'sale'
  | 'customer_return';

export type StockMovementActor = 'agency' | 'system';

/**
 * One line of a shelf's ledger.
 *
 * `onHandAfter` / `reservedAfter` are the balances *this movement produced*, so
 * the ledger reads as a running account. A row's current quantities are always
 * the sum of its deltas — a scheduled sweep checks exactly that and repairs the
 * row if they ever disagree.
 */
export interface StockMovement {
  id: string;
  type: StockMovementType;
  onHandDelta: number;
  reservedDelta: number;
  onHandAfter: number;
  reservedAfter: number;
  reason: string | null;
  actorRole: StockMovementActor;
  /** What the movement was about — e.g. `order` — or `null` for an agency verb. */
  refType: string | null;
  refId: string | null;
  createdAt: string;
}

export interface ListMovementsParams {
  page?: number;
  limit?: number;
}

export interface ListMovementsResponse {
  success: true;
  data: StockMovement[];
  meta: InventoryListMeta;
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
