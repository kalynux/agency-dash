import type { FileRef } from '@/types/file.types';
import type { ProductCategoryRef } from '@/types/product-category.types';

// ─── GET /api/agency/products ──────────────────────────────────────────────────
// Read-only: which physical products route their deliveries to us. Configured on
// the vendor side; the agency cannot change it. See api-doc/agency/products.md.

export interface DeliverableProductsMeta {
  total: number;
  page: number;
  limit: number;
  /** Same value as `totalPages`, kept server-side for old clients. Read `totalPages`. */
  pages: number;
  totalPages: number;
}

/** The product's own lifecycle, from the catalog. */
export type DeliverableProductStatus = 'draft' | 'active' | 'archived' | 'pending_review' | 'suspended';

export const DELIVERABLE_PRODUCT_STATUSES: readonly DeliverableProductStatus[] = [
  'active',
  'pending_review',
  'draft',
  'suspended',
  'archived',
];

/**
 * Why the product routes to us:
 * - `own_override` — the vendor picked this agency on the product itself;
 * - `vendor_default` — no override, and the vendor's default agency is us.
 */
export type DeliverableProductSource = 'own_override' | 'vendor_default';

/** The vendor behind a row, resolved server-side (2026-10-04). */
export interface DeliverableProductVendor {
  /** Always equals the row's `vendorId`. */
  id: string;
  /** The store name — `''` (not null) when the vendor has no store yet. */
  businessName: string;
  displayName: string | null;
  /** ⚠ A file object, not a `logoUrl` string — render `logo?.url`. */
  logo: FileRef | null;
  verified: boolean;
}

export interface DeliverableProduct {
  id: string;
  vendorId: string;
  vendor: DeliverableProductVendor;
  title: string;
  /** Typed as `string` too: a status added server-side must not crash the list. */
  status: DeliverableProductStatus | (string & {});
  /** 1–5, `[0]` is the primary. `[]` = no category. */
  categories: ProductCategoryRef[];
  /** @deprecated `categories[0].name` — read `categories`. */
  category: string | null;
  source: DeliverableProductSource;
  /**
   * Product-level gallery, vendor order, renderable images only, capped at 4.
   * Optional: an older backend does not send it (added 2026-10-05).
   */
  images?: FileRef[];
  /** How many renderable images the product has in total — `images` may be capped. */
  imageCount?: number;
  /** Where the product is picked up. `null` = not configured; absent = older backend. */
  pickup?: DeliverableProductPickup | null;
  /** This agency's stock of the product. `null` = not stored here; absent = older backend. */
  agencyStock?: DeliverableProductStock | null;
}

export interface DeliverableProductPickup {
  source: 'vendor_address' | 'agency_storage';
  /** Null when the address could not be resolved (deleted, or ambiguous). */
  label: string | null;
  city: string | null;
  state: string | null;
  /** `agency_storage` only: which of OUR depots (resolved — primary when unset). */
  depotId?: string | null;
}

export interface DeliverableProductStockDepot {
  /** Null when the depot has since been deleted ("unassigned"). */
  id: string | null;
  label: string | null;
  city: string | null;
  /** Counted on-hand, summed over variants. Always 0 when `counted` is false. */
  quantityOnHand: number;
  /**
   * ⚠ False = configured to be stored here, NEVER COUNTED. That is not
   * "we hold none" — render it as "not counted yet", never as 0.
   */
  counted: boolean;
}

export interface DeliverableProductStock {
  depots: DeliverableProductStockDepot[];
  totalOnHand: number;
  /** True when at least one depot carries a counted figure. */
  counted?: boolean;
}

export type DeliverableProductSortBy = 'createdAt' | 'title';

/**
 * Query for `GET /agency/products`. ⚠ Unknown parameters are REJECTED with
 * `400 VALIDATION_ERROR` (since 2026-10-04), so nothing outside this shape is sent.
 * All filters combine with AND; `meta.total` counts the filtered set.
 */
export interface ListDeliverableProductsParams {
  page?: number;
  /** 1–100. Defaults to 20 server-side. */
  limit?: number;
  /** 1–100 chars: substring over title, SKU, vendor name and category name. */
  search?: string;
  source?: DeliverableProductSource;
  status?: DeliverableProductStatus;
  categoryId?: string;
  vendorId?: string;
  sortBy?: DeliverableProductSortBy;
  sortDir?: 'asc' | 'desc';
}

export interface ListDeliverableProductsResponse {
  success: boolean;
  data: DeliverableProduct[];
  meta: DeliverableProductsMeta;
}
