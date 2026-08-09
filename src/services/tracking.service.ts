import { api } from './api';
import type { TrackingBoard, TrackingBoardResponse, VisibleAgentsResponse } from '@/types/tracking.types';

export const trackingService = {
  /**
   * GET /api/agency/tracking/board — the whole map in one call: the agents this
   * agency may currently track and, per agent, their active shipments with a
   * start and an end pin. See api-doc/agency/live-tracking.md.
   *
   * The set of agents is exactly what `visible-agents` returns and what
   * geo-tracker gates the socket on, so every agent here is subscribable and
   * none you may watch is missing. It never carries a position.
   */
  async getBoard(): Promise<TrackingBoard> {
    const res = await api.get<TrackingBoardResponse>('/agency/tracking/board');
    return res.data;
  },

  /**
   * GET /api/tracking/visible-agents — the agents the caller may currently track
   * (wimall owns this authorization policy). geo-tracker does the streaming.
   *
   * The agency map reads {@link getBoard} instead: same agent set, plus the
   * shipments and pins it needs to draw. Kept for non-agency callers.
   */
  getVisibleAgents(): Promise<VisibleAgentsResponse> {
    return api.get<VisibleAgentsResponse>('/tracking/visible-agents');
  },
};
