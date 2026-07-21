import { api } from './api';
import type { VisibleAgentsResponse } from '@/types/tracking.types';

export const trackingService = {
  /**
   * GET /api/tracking/visible-agents — the agents the caller may currently track
   * (jovi-mall owns this authorization policy). geo-tracker does the streaming.
   */
  getVisibleAgents(): Promise<VisibleAgentsResponse> {
    return api.get<VisibleAgentsResponse>('/tracking/visible-agents');
  },
};
