// Storage statements — `/api/agency/storage-invoices`.
//
// Four live routes that had never been documented in this repository, so the
// dashboard had no screen for a monthly bill its operators were already
// accruing. See api-doc/agency/storage-invoices.md and
// api-doc/MIGRATION-2026-08.md § 9.
//
// ⚠ Read the type file's header before building anything on this: a statement is
// a RECORD and the platform moves none of the money.

import { api } from './api';
import type {
  ListStorageInvoicesParams,
  ListStorageInvoicesResponse,
  SettleStorageInvoicePayload,
  StorageInvoiceDetailResponse,
  StorageInvoiceMutationResponse,
  VoidStorageInvoicePayload,
} from '@/types/storage-invoice.types';

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return (
    '?' +
    entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
  );
}

export const storageInvoicesService = {
  /**
   * GET /agency/storage-invoices — newest period first.
   *
   * **Lines are not included.** A year of statements with every line expanded is
   * a payload nobody reads; `skuCount` and `unitCount` are what a row shows.
   */
  list(params: ListStorageInvoicesParams = {}): Promise<ListStorageInvoicesResponse> {
    return api.get<ListStorageInvoicesResponse>(
      `/agency/storage-invoices${buildQueryString(params as Record<string, unknown>)}`,
    );
  },

  /** GET /agency/storage-invoices/:id — the same object plus every line. */
  getById(id: string): Promise<StorageInvoiceDetailResponse> {
    return api.get<StorageInvoiceDetailResponse>(`/agency/storage-invoices/${id}`);
  },

  /**
   * POST /agency/storage-invoices/:id/settle — the vendor paid, out of band.
   *
   * ⚠ **This does not move money and does not charge anybody.** It records that
   * the agency says it was paid; the vendor sees that the agency said so.
   *
   * Compare-and-set from `open`: anything already settled or voided answers
   * `409 STORAGE_INVOICE_NOT_OPEN`, never a 404. There is no un-settle, and
   * `void` is not a substitute for one.
   */
  settle(
    id: string,
    payload: SettleStorageInvoicePayload = {},
  ): Promise<StorageInvoiceMutationResponse> {
    return api.post<StorageInvoiceMutationResponse>(
      `/agency/storage-invoices/${id}/settle`,
      payload,
    );
  },

  /**
   * POST /agency/storage-invoices/:id/void — it was issued in error.
   *
   * `reason` is required. The row is kept rather than deleted, because a missing
   * month is indistinguishable from a month nobody billed.
   *
   * ⚠ Voiding does **not** free the month for re-issue — the identity
   * (agency, vendor, month) is still held by the voided row.
   */
  void(id: string, payload: VoidStorageInvoicePayload): Promise<StorageInvoiceMutationResponse> {
    return api.post<StorageInvoiceMutationResponse>(
      `/agency/storage-invoices/${id}/void`,
      payload,
    );
  },
};
