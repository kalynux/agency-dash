// Agency Agents — membership/contract model. See api-doc/agency/agent-roster.md

export type AgentStatus = 'active' | 'inactive' | 'suspended';
export type AgentAvailability = 'online' | 'offline' | 'on_break' | string;
export type AgentWorkingState = 'working' | 'idle' | 'at_capacity' | (string & {});

/**
 * `paused` is the softer sibling of `suspended` — both stop new assignments and
 * leave in-flight shipments alone, but a pause reads as a mutual break and is the
 * only one of the two an agent may also raise. `reinstate` returns from either.
 */
export type MembershipStatus = 'pending' | 'approved' | 'paused' | 'suspended' | 'removed';
export type MembershipOrigin = 'invitation' | 'join_request' | string;
export type EmploymentType = 'employee' | 'contractor' | 'freelancer';

export interface AgentVehicleInfo {
  vehicle_type: string;
  plate_number: string;
  color: string;
}

export interface AgentEmployment {
  employmentType: EmploymentType | null;
  employeeRef: string | null;
  startedAt: string | null;
  endsAt: string | null;
}

// ─── Negotiated contract terms (PATCH /agency/agents/:id/terms) ─────────────────
// A membership IS the contract. `/terms` reaches every negotiated group; the older
// `/employment` endpoint is a thin alias for the `employment` group of the same
// call. Each group is merged field-by-field server-side, so an omitted key keeps
// its stored value.

export type FeeSplitModel = 'percentage' | 'flat';

export type RemittanceCadence =
  | 'per_delivery'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'on_demand';

/**
 * What the agency pays the agent per delivery — carved **out of** the agency's own
 * delivery fee, never added on top (the vendor pays the same either way). The
 * earnings pipeline divides by this twice: once for the agent's offer-time
 * estimate, once for the actual at delivery.
 */
export interface ContractFeeSplit {
  model: FeeSplitModel;
  /** Required in effect when `model` is `percentage` (0–100). */
  agentSharePercent: number | null;
  /** Required in effect when `model` is `flat`. Minor units. */
  agentFlatFee: number | null;
  currency: string | null;
}

export interface ContractRemittanceTerms {
  cadence: RemittanceCadence;
  /** 0–6, weekly/biweekly cadences only. */
  dayOfWeek: number | null;
  /** 1–28, monthly cadence only. */
  dayOfMonth: number | null;
  /** 0–720. */
  graceHours: number | null;
}

export interface ContractCoverage {
  regions: string[];
  area: unknown | null;
}

export interface AgentMembership {
  id: string;
  agentId: string;
  agencyId: string;
  status: MembershipStatus;
  origin: MembershipOrigin;
  isPrimary: boolean;
  employment: AgentEmployment | null;
  codMaxExposureOverride: number | null;
  approvedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  /**
   * Negotiated terms. Not documented on the roster response, so treat every one
   * as possibly-absent and read them through {@link readContractTerms}, which
   * also tolerates a snake_case payload.
   */
  feeSplit?: ContractFeeSplit | null;
  remittanceTerms?: ContractRemittanceTerms | null;
  coverage?: ContractCoverage | null;
  shipmentValueCeiling?: number | null;
}

/** Normalized, form-friendly view of a contract's terms. */
export interface ContractTerms {
  feeSplit: ContractFeeSplit | null;
  remittanceTerms: ContractRemittanceTerms | null;
  shipmentValueCeiling: number | null;
}

function pick<T>(source: Record<string, unknown>, ...keys: string[]): T | null {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return value as T;
  }
  return null;
}

/**
 * Read a membership's negotiated terms, accepting either casing.
 *
 * The roster/detail responses document `employment` in camelCase but say nothing
 * about the other groups, and the write side is snake_case throughout — so rather
 * than betting on one, seed editors from whichever the backend actually sends.
 */
export function readContractTerms(membership: AgentMembership): ContractTerms {
  const raw = membership as unknown as Record<string, unknown>;

  const feeSplitRaw = pick<Record<string, unknown>>(raw, 'feeSplit', 'fee_split');
  const remittanceRaw = pick<Record<string, unknown>>(raw, 'remittanceTerms', 'remittance_terms');

  return {
    feeSplit: feeSplitRaw
      ? {
          model: (pick<FeeSplitModel>(feeSplitRaw, 'model') ?? 'percentage') as FeeSplitModel,
          agentSharePercent: pick<number>(feeSplitRaw, 'agentSharePercent', 'agent_share_percent'),
          agentFlatFee: pick<number>(feeSplitRaw, 'agentFlatFee', 'agent_flat_fee'),
          currency: pick<string>(feeSplitRaw, 'currency'),
        }
      : null,
    remittanceTerms: remittanceRaw
      ? {
          cadence: (pick<RemittanceCadence>(remittanceRaw, 'cadence') ?? 'per_delivery') as RemittanceCadence,
          dayOfWeek: pick<number>(remittanceRaw, 'dayOfWeek', 'day_of_week'),
          dayOfMonth: pick<number>(remittanceRaw, 'dayOfMonth', 'day_of_month'),
          graceHours: pick<number>(remittanceRaw, 'graceHours', 'grace_hours'),
        }
      : null,
    shipmentValueCeiling: pick<number>(raw, 'shipmentValueCeiling', 'shipment_value_ceiling'),
  };
}

export interface AgentProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  status: AgentStatus;
  vehicleInfo: AgentVehicleInfo | null;
  availability: AgentAvailability;
  workingState?: AgentWorkingState;
  /**
   * Across all agencies — capacity is a property of the person + vehicle.
   *
   * Since 2026-07-29 this is the same counter the dispatcher admits against
   * (atomically incremented when an agent accepts an offer), so it agrees with
   * `AGENT_AT_CAPACITY` instead of lagging it.
   */
  activeShipmentCount: number;
  trackingAllowed: boolean;
  trustScore: number;
}

/** One row from GET /api/agency/agents — a membership joined to its agent + cash held. */
export interface RosterEntry {
  membership: AgentMembership;
  agent: AgentProfile;
  cashHeld: number;
}

/**
 * Flattened, convenient view of a roster entry for assign/deposit dropdowns.
 * `id` is the agent id; `membershipId` the membership id used by roster actions.
 */
export interface AgentSummary {
  id: string;
  membershipId: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  status: AgentStatus;
  membershipStatus: MembershipStatus;
  availability: AgentAvailability;
  trustScore: number;
  cashHeld: number;
  vehicleInfo: AgentVehicleInfo | null;
  codMaxExposureOverride: number | null;
  activeShipmentCount: number;
}

export function toAgentSummary(entry: RosterEntry): AgentSummary {
  return {
    id: entry.agent.id,
    membershipId: entry.membership.id,
    name: entry.agent.name,
    email: entry.agent.email,
    phone: entry.agent.phone,
    avatarUrl: entry.agent.avatarUrl,
    status: entry.agent.status,
    membershipStatus: entry.membership.status,
    availability: entry.agent.availability,
    trustScore: entry.agent.trustScore,
    cashHeld: entry.cashHeld,
    vehicleInfo: entry.agent.vehicleInfo,
    codMaxExposureOverride: entry.membership.codMaxExposureOverride,
    activeShipmentCount: entry.agent.activeShipmentCount,
  };
}

// ─── Invites ────────────────────────────────────────────────────────────────────

export type AgentInviteStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

export interface AgentInvite {
  id: string;
  agencyId?: string;
  email: string;
  status: AgentInviteStatus;
  respondedAt?: string | null;
  createdAt: string;
}

// ─── Eligibility & history ──────────────────────────────────────────────────────

export interface AgentEligibilityRule {
  rule: string;
  passed: boolean;
  reason: string | null;
  observed: Record<string, unknown>;
}

export interface AgentEligibility {
  agentId: string;
  agencyId: string;
  eligible: boolean;
  reasons: string[];
  rules: AgentEligibilityRule[];
  activeShipmentCount: number;
  maxConcurrentShipments: number;
}

export interface AgentHistoryEvent {
  type: string;
  createdAt?: string;
  at?: string;
  note?: string | null;
  [key: string]: unknown;
}

// ─── Contract status requests (two-party transitions) ───────────────────────────
// Ending, pausing or reactivating a contract is not one party's call: the mover
// raises a request and the other side clears it. Requests the AGENCY raised are
// resolved by the agent; requests the AGENT raised land in the agency's inbox
// (`GET /agency/agents/status-requests`).

export interface ContractBlockingConditions {
  outstandingCod: number;
  outstandingPayment: number;
  clear: boolean;
}

export type ContractTransition = 'pause' | 'reactivate' | 'deactivate' | (string & {});
export type ContractStatusRequestState = 'pending' | 'approved' | 'rejected' | (string & {});
export type ContractStatusRequestDecision = 'approve' | 'reject';

export interface ContractStatusRequest {
  id: string;
  /** The membership this is about — a contract IS a membership. */
  contractId: string;
  transition: ContractTransition;
  targetStatus: string;
  fromStatus: string;
  state: ContractStatusRequestState;
  requestedByRole: 'agency' | 'agent' | (string & {});
  /**
   * Advisory only, and `null` when nothing is in the way — the same conditions
   * are re-checked on approval, never trusted from when the request was raised.
   */
  blockingConditions: ContractBlockingConditions | null;
  reason?: string | null;
  note?: string | null;
  createdAt?: string;
  requestedAt?: string;
}

// ─── Contract settlements (per-contract cash view) ──────────────────────────────

export interface ContractCodSettlement {
  threshold: number;
  /** Must reach zero before the contract can be deactivated. */
  outstandingBalance: number;
  lifetimeSettled: number;
  lastSettledAt: string | null;
}

export interface ContractSettlementDeposit {
  id: string;
  amount: number;
  recipient: 'agency' | 'platform' | (string & {});
  status: string;
  declaredAt: string;
  confirmedAt: string | null;
}

export interface ContractSettlements {
  membershipId: string;
  cod: ContractCodSettlement;
  deposits: ContractSettlementDeposit[];
}

// ─── Employment / terms / COD limit payloads ────────────────────────────────────

export interface UpdateEmploymentPayload {
  employment_type?: EmploymentType;
  employee_ref?: string | null;
  started_at?: string | null;
  ends_at?: string | null;
}

/**
 * `PATCH /agency/agents/:membershipId/terms` — all groups optional, at least one
 * required. Send only the fields you changed: each group is merged over the
 * stored one, so an omitted key keeps its value.
 *
 * `cod.threshold` is deliberately absent — it is bounded by the agent's shared
 * COD pool and has its own endpoint (`PATCH .../cod-limit`).
 */
export interface UpdateTermsPayload {
  employment?: UpdateEmploymentPayload;
  fee_split?: {
    model?: FeeSplitModel;
    /** 0–100. */
    agent_share_percent?: number;
    /** Minor units. */
    agent_flat_fee?: number;
    /** 3-letter code. */
    currency?: string;
  };
  remittance_terms?: {
    cadence?: RemittanceCadence;
    day_of_week?: number;
    day_of_month?: number;
    grace_hours?: number;
  };
  coverage?: {
    regions?: string[];
    area?: unknown | null;
  };
  /** Minor units, or `null` for no per-shipment cap. */
  shipment_value_ceiling?: number | null;
}

// ─── Response envelopes ─────────────────────────────────────────────────────────

export interface ListAgentsResponse {
  success: true;
  data: RosterEntry[];
}

export interface AgentMembershipResponse {
  success: true;
  data: RosterEntry;
  message?: string;
}

export interface MembershipMutationResponse {
  success: true;
  data: { id: string; status: MembershipStatus; suspensionReason?: string | null } | AgentMembership;
  message?: string;
}

export interface RemoveMembershipResponse {
  success: true;
  data: { request: ContractStatusRequest; membership: AgentMembership | null };
  message?: string;
}

export interface ContractStatusRequestsResponse {
  success: true;
  data: ContractStatusRequest[];
  meta?: { total: number; page: number; limit: number; pages?: number };
}

export interface ContractStatusRequestResponse {
  success: true;
  data: { request: ContractStatusRequest; membership: AgentMembership | null } | ContractStatusRequest;
  message?: string;
}

export interface ContractSettlementsResponse {
  success: true;
  data: ContractSettlements;
  meta?: { total: number; page: number; limit: number; pages?: number };
}

export interface CodLimitResult {
  membershipId: string;
  threshold: number;
  headroomAfter: number;
}

export interface CodLimitResponse {
  success: true;
  data: CodLimitResult;
  message?: string;
}

export interface EligibleAgentsResponse {
  success: true;
  data: RosterEntry[];
}

export interface AgentEligibilityResponse {
  success: true;
  data: AgentEligibility;
}

export interface AgentHistoryResponse {
  success: true;
  data: AgentHistoryEvent[];
}

export interface ListAgentInvitesResponse {
  success: true;
  data: AgentInvite[];
}

export interface AgentInviteResponse {
  success: true;
  data: AgentInvite;
  message?: string;
}
