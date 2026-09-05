// Storage statements — the monthly record of what a vendor owes this agency for
// warehousing their stock. One statement per (agency, vendor, month).
//
// ⚠ ─── A STATEMENT IS A RECORD. THE PLATFORM MOVES NONE OF THIS MONEY ─────────
//
// It does not charge the vendor, does not pay the agency, and takes no
// commission. `monthly_storage_fee_per_sku` is excluded from every per-order
// earnings split — it is rent, not a delivery fee.
//
// What the statement buys is that both sides read THE SAME NUMBER, that it is
// durable and dated, and that "has this been paid" has somewhere to live.
// `settle` is the agency STATING that the vendor paid it out of band. Nothing
// verifies it, and the vendor sees that the agency said so.
//
// The vendor's mirror of this surface is read-only and has deliberately no
// dispute verb, for the same reason: the platform is not a party to this money.
//
// **A "Settle" button that reads like "Pay" is the one way this screen can
// mislead**, so the copy has to say all of the above plainly.
//
// See api-doc/agency/storage-invoices.md.

/**
 * `open` — issued and unpaid, as far as this record knows.
 * `settled` — the agency stated the vendor paid, out of band.
 * `void` — the statement was issued in error.
 *
 * There is no `overdue`: nothing chases a statement on either side, so a status
 * implying it would be a claim the platform cannot back.
 */
export type StorageInvoiceStatus = 'open' | 'settled' | 'void';

/**
 * One SKU's line on a statement.
 *
 * **Every value here is frozen at issue** — the rate, the quantity, the SKU
 * label, the depot name. Raising the rate does not restate a month a vendor has
 * already paid, and a vendor renaming a SKU does not rewrite last month's
 * statement. So never re-resolve any of these against live data.
 */
export interface StorageInvoiceLine {
  stockLevelId: string;
  productId: string;
  variantId: string;
  sku: string | null;
  productTitle: string | null;
  locationId: string | null;
  locationLabel: string | null;
  /** What was on the shelf **when the statement was issued** — not a monthly average. */
  quantity: number;
  monthlyRatePerSku: number;
  lineTotal: number;
}

/** A statement as it appears in a list — no lines, which is why `skuCount` exists. */
export interface StorageInvoice {
  id: string;
  agencyId: string;
  vendorId: string;
  /** `YYYY-MM`, a **UTC calendar month**. */
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  skuCount: number;
  unitCount: number;
  monthlyRatePerSku: number;
  total: number;
  status: StorageInvoiceStatus;
  issuedAt: string;
  settledAt: string | null;
  /** The settle note, or the void reason — whichever happened. */
  note: string | null;
}

/** The detail adds the lines. Nothing else differs. */
export interface StorageInvoiceDetail extends StorageInvoice {
  lines: StorageInvoiceLine[];
}

export interface ListStorageInvoicesParams {
  page?: number;
  limit?: number;
  status?: StorageInvoiceStatus;
  /** `YYYY-MM`. */
  periodKey?: string;
  vendorId?: string;
}

export interface StorageInvoiceListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListStorageInvoicesResponse {
  success: true;
  data: StorageInvoice[];
  meta: StorageInvoiceListMeta;
}

export interface StorageInvoiceDetailResponse {
  success: true;
  data: StorageInvoiceDetail;
}

/**
 * `POST /:id/settle` — the agency stating the vendor paid, out of band.
 *
 * There is deliberately **no un-settle**. If the wrong one was settled, `void`
 * is not the remedy either: voiding says the *statement* was wrong, not that the
 * payment was. Raise it with the vendor.
 */
export interface SettleStorageInvoicePayload {
  /** Free text — e.g. a bank transfer reference. */
  note?: string;
}

/**
 * `POST /:id/void` — the statement was issued in error.
 *
 * `reason` is **required**. The row is kept, never deleted: a missing month is
 * indistinguishable from a month nobody billed, and this record is what tells
 * them apart.
 *
 * ⚠ Voiding does **not** re-open the month for re-issue. A statement's identity
 * is (agency, vendor, month) and a voided row still holds it, so the monthly run
 * reports that month as already issued. That is deliberate — two statements for
 * one month is exactly the confusion this prevents.
 */
export interface VoidStorageInvoicePayload {
  reason: string;
}

export interface StorageInvoiceMutationResponse {
  success: true;
  data: StorageInvoice;
  message?: string;
}

/**
 * `settle` and `void` are compare-and-set from `open`.
 *
 * A statement already settled or voided answers `409 STORAGE_INVOICE_NOT_OPEN` —
 * never a 404: it is right there, it is just not in that state.
 */
export function canAct(invoice: Pick<StorageInvoice, 'status'>): boolean {
  return invoice.status === 'open';
}
