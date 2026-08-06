// Agency Inventory — the vendor stock this agency physically warehouses.
// See api-doc/agency/inventory.md.
//
// WHAT THIS IS. A product lands here when its vendor set the product's
// `delivery.pickupLocation.source` to `agency_storage` and the resolved delivery
// agency is us — i.e. the goods sit in one of OUR headquarters addresses rather
// than at the vendor's shop. That is the same `storage_based` fulfilment mode a
// shipment reports as `items[].pickupLocation.mode` (shipment.types.ts), and the
// mode our `policies.pricing.storage_based` fees are charged for — including
// `monthly_storage_fee_per_sku`, which we bill per line on this list.
//
// WHAT THIS IS NOT. It is not the vendor's catalogue: a `pickup_based` product
// of the same vendor never appears here, because we hold none of it. Stock is
// vendor-owned truth — this surface is READ-ONLY. Counts change through order
// fulfilment and vendor restocks, never through this dashboard.

import type { FileRef } from '@/types/file.types';
// The platform's one address-display shape. Defined alongside shipments because
// that is where it first appeared, but it is not shipment-specific — a warehouse
// address and a pickup address print identically, and `describeAddress` is the
// shared one-liner both use.
import type { AddressDetail } from '@/types/shipment.types';

/**
 * How healthy one line's stock is, derived server-side from `available` against
 * `lowStockThreshold` so the list, the badge and the filter can never disagree.
 *
 * `low` requires a threshold to compare against: a line whose vendor set none is
 * `in_stock` right down to the last unit, then `out_of_stock`. That mirrors the
 * vendor-side alert rule (`availableStock <= threshold`, thresholdless variants
 * excluded) rather than inventing a second definition of "running low".
 */
export type StockState = 'in_stock' | 'low' | 'out_of_stock';

/** Stock-state filter values offered on the list, `all` included. */
export type StockStateFilter = StockState | 'all';

/**
 * How many units of one line sit at one of our headquarters addresses.
 *
 * `locationId` is the `_id` of an entry in the magazin's `headquartersAddresses`
 * (magazin.types.ts) — the same identity the Locations settings screen edits, so
 * a row here always names a place the agency can actually find.
 *
 * `label` is denormalised onto the payload rather than looked up client-side:
 * the magazin's own labels are nullable and editable, and a count that outlives
 * a renamed or deleted HQ entry still has to print something truthful.
 */
export interface InventoryLocationStock {
  locationId: string;
  /** The agency's own name for the place, e.g. "Douala HQ". */
  label: string | null;
  city: string | null;
  region: string | null;
  /** Units of this line held here. Sums to the line's `onHand` across locations. */
  quantity: number;
}

/** A location row on the detail sheet — same counts, plus the full address. */
export interface InventoryLocationDetail extends InventoryLocationStock {
  address: AddressDetail | null;
  /** When stock last moved at this location. Null if it never has. */
  lastMovementAt: string | null;
}

/** The vendor whose goods these are. */
export interface InventoryVendorSummary {
  id: string;
  businessName: string;
  phone: string | null;
  email: string | null;
}

/**
 * One line of stored stock: a single variant of a single vendor's product,
 * aggregated across every location that holds it.
 *
 * The unit is the VARIANT, not the product — a product with three sizes is
 * three lines, because three separate counts are what a warehouse actually
 * holds and what `monthly_storage_fee_per_sku` actually bills. A product with no
 * variants still arrives as one line whose `variantTitle` is null.
 */
export interface InventoryListItem {
  /** Stable identity of this line; what `getById` takes. */
  id: string;
  productId: string;
  variantId: string | null;
  /** Null when the product snapshot can no longer be resolved — see `images`. */
  title: string | null;
  variantTitle: string | null;
  sku: string | null;
  /** Thumbnail: the variant's own picture, else the product's first. */
  image: FileRef | null;
  vendor: InventoryVendorSummary;
  /** Physical units on our shelves, across every location. */
  onHand: number;
  /** Units locked by in-flight orders — on the shelf, but already spoken for. */
  reserved: number;
  /** `onHand - reserved`. What is genuinely free to sell. */
  available: number;
  /** The vendor's low-stock threshold, or null if they set none. */
  lowStockThreshold: number | null;
  stockState: StockState;
  /** Where the units are. One entry per location holding at least one unit. */
  locations: InventoryLocationStock[];
  /** When this line's stock last changed anywhere. */
  updatedAt: string | null;
}

/**
 * What caused a stock movement.
 *
 * A superset of the vendor-side stock audit log's `operation` values: the four
 * it already has that can happen to warehoused goods (`order`, `reservation`,
 * `release`, `adjustment`), plus the three that only exist once stock has a
 * location — `intake` (goods arrived from the vendor), `transfer` (moved
 * between our own locations) and `return` (came back off a failed delivery).
 */
export type StockMovementOperation =
  | 'intake'
  | 'order'
  | 'reservation'
  | 'release'
  | 'transfer'
  | 'adjustment'
  | 'return';

/** One append-only entry from the stock ledger, newest first on the sheet. */
export interface StockMovement {
  id: string;
  /** Negative = stock left the shelf. */
  delta: number;
  previousQuantity: number;
  newQuantity: number;
  operation: StockMovementOperation;
  /** Which of our locations moved. Null on movements the ledger can't place. */
  locationId: string | null;
  occurredAt: string;
  /** Whatever context the operation carries — an order, a shipment, a note. */
  metadata?: {
    orderId?: string;
    shipmentId?: string;
    reason?: string;
  } | null;
}

/** Full detail for one line — everything the list has, plus the deep context. */
export interface InventoryDetail extends Omit<InventoryListItem, 'locations'> {
  /** Every picture of this line, thumbnail first (`image` is `images[0]`). */
  images: FileRef[];
  category: string | null;
  /** Grams. Null when the vendor never set one — we still have to store it. */
  weightGrams: number | null;
  barcode: string | null;
  /** Vendor-side catalogue state. An `archived` line we still hold is worth flagging. */
  productStatus: 'active' | 'draft' | 'archived' | null;
  locations: InventoryLocationDetail[];
  /** Recent ledger entries, newest first. Capped server-side. */
  movements: StockMovement[];
  /** Undelivered shipments already drawing on this line — the real claim on `reserved`. */
  openShipmentCount: number;
  /** When this line first entered our storage. */
  storedSince: string | null;
}

// ─── Requests & responses ─────────────────────────────────────────────────────

export interface ListInventoryParams {
  /** Free text over product title, variant title, SKU and vendor business name. */
  q?: string;
  /** An `_id` from the magazin's `headquartersAddresses`. */
  locationId?: string;
  vendorId?: string;
  /** Omit (or send `all`) for every state. */
  stockState?: StockState;
  page?: number;
  limit?: number;
}

/**
 * Totals for the whole filtered set, not just the page — the summary strip has
 * to keep counting past page 1.
 */
export interface InventorySummary {
  /** Distinct lines held. What `monthly_storage_fee_per_sku` multiplies. */
  skuCount: number;
  /** Physical units held across every line. */
  unitCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  /** Distinct vendors we are warehousing for. */
  vendorCount: number;
}

export interface InventoryListMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  summary: InventorySummary;
}

export interface ListInventoryResponse {
  success: true;
  data: InventoryListItem[];
  meta: InventoryListMeta;
}

export interface InventoryDetailResponse {
  success: true;
  data: InventoryDetail;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * The stock state, computed from the same rule the backend uses.
 *
 * The payload carries `stockState` and that is what the UI reads; this exists
 * for the places that need a state for a number the payload never sent one for —
 * notably a single location's quantity on the detail sheet.
 */
export function deriveStockState(available: number, threshold: number | null): StockState {
  if (available <= 0) return 'out_of_stock';
  if (threshold !== null && available <= threshold) return 'low';
  return 'in_stock';
}

/**
 * What to call a location whose `label` is null.
 *
 * Legacy HQ entries were saved before labels existed, so a count can genuinely
 * point at an unnamed place. Falls back through the geocode's own names before
 * giving up, because "Douala" beats "Unnamed location" every time.
 */
export function describeLocation(location: InventoryLocationStock): string | null {
  if (location.label) return location.label;
  const cityRegion = [location.city, location.region].filter(Boolean).join(', ');
  return cityRegion || null;
}
