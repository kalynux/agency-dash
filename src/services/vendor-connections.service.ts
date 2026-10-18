import { api } from './api';
import type {
  GetVendorBrowseResponse,
  ListConnectionsParams,
  ListVendorConnectionsResponse,
  VendorBrowseItemDto,
  VendorBrowseQueryParams,
  VendorConnectionResponse,
} from '@/types/vendor-connection.types';

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '' && v !== false,
  );
  if (entries.length === 0) return '';
  return (
    '?' +
    entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
  );
}

export const vendorConnectionsService = {
  /** GET /agency/vendor-connections/browse — search vendors to request a connection with. */
  browse(params: VendorBrowseQueryParams = {}): Promise<GetVendorBrowseResponse> {
    return api.get<GetVendorBrowseResponse>(
      `/agency/vendor-connections/browse${buildQueryString(params as Record<string, unknown>)}`,
    );
  },

  /** POST /agency/vendor-connections — send a connection request to a vendor. */
  request(counterpartyId: string): Promise<VendorConnectionResponse> {
    return api.post<VendorConnectionResponse>('/agency/vendor-connections', { counterpartyId });
  },

  /** GET /agency/vendor-connections — list our own connections, any status, newest-updated first. */
  list(params: ListConnectionsParams = {}): Promise<ListVendorConnectionsResponse> {
    return api.get<ListVendorConnectionsResponse>(
      `/agency/vendor-connections${buildQueryString(params as Record<string, unknown>)}`,
    );
  },

  /** GET /agency/vendor-connections/:id — full detail for one of our own connections. */
  getById(id: string): Promise<VendorConnectionResponse> {
    return api.get<VendorConnectionResponse>(`/agency/vendor-connections/${id}`);
  },

  /** POST /agency/vendor-connections/:id/approve — approve a pending request, or reapprove from paused_reapproval. */
  approve(id: string): Promise<VendorConnectionResponse> {
    return api.post<VendorConnectionResponse>(`/agency/vendor-connections/${id}/approve`);
  },

  /** POST /agency/vendor-connections/:id/reject — reject a pending request the vendor sent us. */
  reject(id: string, reason?: string): Promise<VendorConnectionResponse> {
    return api.post<VendorConnectionResponse>(
      `/agency/vendor-connections/${id}/reject`,
      reason ? { reason } : undefined,
    );
  },

  /** POST /agency/vendor-connections/:id/withdraw — withdraw a pending request we sent. */
  withdraw(id: string): Promise<VendorConnectionResponse> {
    return api.post<VendorConnectionResponse>(`/agency/vendor-connections/${id}/withdraw`);
  },

  /** POST /agency/vendor-connections/:id/terminate — end an active or paused_reapproval connection outright. */
  terminate(id: string, note?: string): Promise<VendorConnectionResponse> {
    return api.post<VendorConnectionResponse>(
      `/agency/vendor-connections/${id}/terminate`,
      note ? { note } : undefined,
    );
  },
};

// ─── One vendor's terms ─────────────────────────────────────────────────────────
// Connection rows are named from `counterpartyProfile` (2026-10-18), which
// replaced a scan of up to 600 browse entries per load. The vendor's policies and
// COD terms are still only on browse, so the terms sheet fetches its one vendor
// when it is opened.

/**
 * Find one vendor's browse entry, for the terms sheet on a connection row: one
 * search by name, matched on id. `null` when it is not listed — browse lists
 * `active` vendors only, so a vendor that is not active is never found.
 */
export async function findVendorInBrowse(
  vendorId: string,
  name: string,
): Promise<VendorBrowseItemDto | null> {
  const { data } = await vendorConnectionsService.browse({ search: name, limit: 100 });
  return data.find((vendor) => vendor.id === vendorId) ?? null;
}
