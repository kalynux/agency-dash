import { api } from './api';
import type { AgencyAnalyticsResponse, AnalyticsQuery } from '@/types/analytics.types';

export const analyticsService = {
  /**
   * GET /agency/analytics — money and work over `from`..`to` (both inclusive,
   * max 366 days). See api-doc/agency/analytics.md.
   */
  get(query: AnalyticsQuery): Promise<AgencyAnalyticsResponse> {
    const q = new URLSearchParams({ from: query.from, to: query.to });
    if (query.timezone) q.set('timezone', query.timezone);
    return api.get<AgencyAnalyticsResponse>(`/agency/analytics?${q.toString()}`);
  },
};
