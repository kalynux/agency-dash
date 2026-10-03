import { ApiError } from '@/types/api';

/**
 * The two assignment refusals this dashboard offers to push past.
 *
 * `force: true` on assign-agent / reassign waives exactly two refusals —
 * `CONTRACT_COVERAGE_REGION_NOT_COVERED` and `COD_AGENT_EXPOSURE_EXCEEDED` —
 * and never the rest: no active contract, the value ceiling, KYC, trust, and
 * the eligibility rules. Each recogniser below matches a single code, rather
 * than listing the ones to exclude, which is what keeps "Send anyway" off
 * those: a code nobody added here can never be forced. See
 * api-doc/agency/assignment.md → "Forcing an offer".
 */
export interface CoverageRefusal {
  /** As stored on the order — may be canonical (`"Centre"`) or legacy text. */
  deliveryRegion: string | null;
  /** Region keys the agent's contract lists. */
  coveredRegions: string[];
}

export function coverageRefusal(err: unknown): CoverageRefusal | null {
  if (!(err instanceof ApiError) || err.code !== 'CONTRACT_COVERAGE_REGION_NOT_COVERED') return null;
  const d = (err.details ?? {}) as { deliveryRegion?: unknown; coveredRegions?: unknown };
  return {
    deliveryRegion: typeof d.deliveryRegion === 'string' && d.deliveryRegion.trim() ? d.deliveryRegion : null,
    coveredRegions: Array.isArray(d.coveredRegions)
      ? d.coveredRegions.filter((r): r is string => typeof r === 'string' && r.trim() !== '')
      : [],
  };
}

/** The numbers on `422 COD_AGENT_EXPOSURE_EXCEEDED`, XAF. `null` when the server left one out. */
export interface CodLimitRefusal {
  /** COD cash the agent already holds or carries. */
  currentExposure: number | null;
  /** This shipment's cash. */
  additionalAmount: number | null;
  /** The limit that refused: `min(contract slice, agent pool) × trust`. */
  effectiveLimit: number | null;
  /** The agent's own pool refused, not your contract slice — raising the slice won't help. */
  poolBinds: boolean;
}

export function codLimitRefusal(err: unknown): CodLimitRefusal | null {
  if (!(err instanceof ApiError) || err.code !== 'COD_AGENT_EXPOSURE_EXCEEDED') return null;
  const d = (err.details ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    currentExposure: num(d.currentExposure),
    additionalAmount: num(d.additionalAmount),
    effectiveLimit: num(d.effectiveLimit),
    poolBinds: d.poolBinds === true,
  };
}
