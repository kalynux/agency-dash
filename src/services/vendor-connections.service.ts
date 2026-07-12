import { api } from './api';
import type {
  GetVendorBrowseResponse,
  ListConnectionsParams,
  ListVendorConnectionsResponse,
  VendorBrowseItemDto,
  VendorBrowseQueryParams,
  VendorConnectionResponse,
  ConnectionDto,
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

// ─── Cross-reference helper ─────────────────────────────────────────────────────
// `ConnectionDto` only carries `vendorId` — never a display name/logo — and there is
// no "fetch vendors by id" endpoint. To show a connected vendor's details, we cross
// reference the authoritative connection list against the paginated browse listing.

const DEFAULT_MAX_BROWSE_PAGES = 6; // up to ~600 vendors scanned at the browse endpoint's max page size (100)
const BROWSE_PAGE_LIMIT = 100;

/**
 * Resolve display details (name, logo, policies, …) for an arbitrary set of
 * connections by scanning the browse listing for matching vendor ids.
 *
 * Known limitation: if the platform has enough vendors that a target vendor
 * falls outside the bounded scan (`maxBrowsePages`), it is reported in
 * `unresolvedVendorIds` and callers should fall back to an id-only display —
 * there is no backend "fetch vendors by ids" endpoint to close this gap.
 */
export async function resolveVendorDisplayForConnections(
  connections: ConnectionDto[],
  opts: { maxBrowsePages?: number } = {},
): Promise<{ resolved: Map<string, VendorBrowseItemDto>; unresolvedVendorIds: string[] }> {
  const targetIds = new Set(connections.map((c) => c.vendorId));
  const resolved = new Map<string, VendorBrowseItemDto>();

  if (targetIds.size === 0) {
    return { resolved, unresolvedVendorIds: [] };
  }

  const maxBrowsePages = opts.maxBrowsePages ?? DEFAULT_MAX_BROWSE_PAGES;
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= maxBrowsePages && resolved.size < targetIds.size) {
    const { data, meta } = await vendorConnectionsService.browse({ page, limit: BROWSE_PAGE_LIMIT });
    totalPages = meta.totalPages;
    for (const vendor of data) {
      if (targetIds.has(vendor.id) && !resolved.has(vendor.id)) {
        resolved.set(vendor.id, vendor);
      }
    }
    page += 1;
  }

  const unresolvedVendorIds = [...targetIds].filter((id) => !resolved.has(id));
  return { resolved, unresolvedVendorIds };
}
