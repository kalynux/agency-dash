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
