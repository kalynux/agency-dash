import { api } from './api';
import type {
  GeoCandidate,
  GeoSearchOptions,
  GeoSearchResponse,
  GeoReverseResponse,
} from '@/types/geo.types';

/**
 * Address search / reverse geocoding. See api-doc/geo/README.md.
 *
 * Geo is deliberately OFF the critical path: a provider outage surfaces as
 * `GEO_PROVIDER_UNAVAILABLE` (503) or `GEO_SEARCH_FAILED` (502) and callers
 * should degrade gracefully rather than block the form.
 */
export const geoService = {
  /** GET /geo/search — free-form text → ranked candidate locations. */
  async search(q: string, opts: GeoSearchOptions = {}): Promise<GeoCandidate[]> {
    const params = new URLSearchParams({ q });
    if (opts.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts.country) params.set('country', opts.country);
    if (opts.lang) params.set('lang', opts.lang);

    const res = await api.get<GeoSearchResponse>(`/geo/search?${params.toString()}`);
    return res.data.results;
  },

  /** GET /geo/reverse — a coordinate → its best-matching address, or null. */
  async reverse(lat: number, lng: number): Promise<GeoCandidate | null> {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    const res = await api.get<GeoReverseResponse>(`/geo/reverse?${params.toString()}`);
    return res.data.result;
  },
};
