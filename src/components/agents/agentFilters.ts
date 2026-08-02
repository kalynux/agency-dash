import type { AgentBrowseQueryParams, AgentVehicleType } from '@/types/agent.types';

export interface AgentFilters {
  vehicleType: AgentVehicleType | '';
  availability: 'online' | 'offline' | 'on_break' | '';
  /** Empty string means "no minimum"; the API takes 0–100. */
  minTrustScore: string;
  sort: 'trust' | 'name';
}

export const INITIAL_AGENT_FILTERS: AgentFilters = {
  vehicleType: '',
  availability: '',
  minTrustScore: '',
  sort: 'trust',
};

/** How many filters differ from their default — drives the badge and the Reset affordance. */
export function countActiveAgentFilters(f: AgentFilters): number {
  return [f.vehicleType !== '', f.availability !== '', f.minTrustScore !== '', f.sort !== 'trust'].filter(
    Boolean,
  ).length;
}

/** Translate the panel's state into query params, dropping everything left at its default. */
export function toAgentBrowseParams(f: AgentFilters): AgentBrowseQueryParams {
  const params: AgentBrowseQueryParams = {};
  if (f.vehicleType) params.vehicle_type = f.vehicleType;
  if (f.availability) params.availability = f.availability;

  const trust = Number(f.minTrustScore);
  if (f.minTrustScore !== '' && Number.isFinite(trust)) {
    params.min_trust_score = Math.min(100, Math.max(0, Math.round(trust)));
  }
  if (f.sort !== 'trust') params.sort = f.sort;

  return params;
}
