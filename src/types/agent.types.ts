// Agency Agents — membership/contract model. See api-doc/agency/agent-roster.md

import type { FileRef } from '@/types/file.types';

export type AgentStatus = 'active' | 'inactive' | 'suspended';
export type AgentAvailability = 'online' | 'offline' | 'on_break' | string;
export type AgentWorkingState = 'working' | 'idle' | 'at_capacity' | (string & {});
export type AgentVehicleType = 'bike' | 'car' | 'van' | 'truck';

/**
 * `paused` is the softer sibling of `suspended` — both stop new assignments and
 * leave in-flight shipments alone, but a pause reads as a mutual break and is the
 * only one of the two an agent may also raise. `reinstate` returns from either.
 *
 * `rejected`, `withdrawn` and `deactivated` are terminal: the row survives as
 * history and a fresh request between the same pair creates a **new** contract
 * rather than reviving the old one.
 */
export type MembershipStatus =
  | 'pending'
  | 'rejected'
  | 'withdrawn'
  | 'active'
  | 'paused'
  | 'suspended'
  | 'deactivated';

/** Contracts that still exist as a live relationship. */
export const LIVE_MEMBERSHIP_STATUSES: MembershipStatus[] = ['pending', 'active', 'paused', 'suspended'];

/** Terminal contracts — kept only as history. */
export const HISTORY_MEMBERSHIP_STATUSES: MembershipStatus[] = ['rejected', 'withdrawn', 'deactivated'];

export type MembershipOrigin = 'invitation' | 'join_request' | 'transfer' | 'admin' | 'migration' | (string & {});

/**
 * Which side raised the contract. Derived server-side from `origin` (only
 * `join_request` is agent-raised) and the same rule the API enforces, so read
 * this rather than re-deriving it: the initiator gets **Withdraw**, the
 * counterparty gets **Approve / Decline**. Asking for the wrong one is a 403.
 */
export type ContractParty = 'agent' | 'agency';

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
  /** Always set — defaults to `XAF` server-side. */
  currency: string;
}

export interface ContractRemittanceTerms {
  cadence: RemittanceCadence;
  /** 0=Sunday … 6=Saturday, weekly/biweekly cadences only. */
  dayOfWeek: number | null;
  /** 1–28, monthly cadence only. */
  dayOfMonth: number | null;
  /** 0–720. Always set — defaulted server-side. */
  graceHours: number;
}

/** GeoJSON polygon, as stored — the same shape `PATCH .../terms` accepts back. */
export interface ContractCoverageArea {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface ContractCoverage {
  regions: string[];
  area: ContractCoverageArea | null;
}

export interface AgentMembership {
  id: string;
  agentId: string;
  agencyId: string;
  status: MembershipStatus;
  origin: MembershipOrigin;
  /** Who raised it — drives Withdraw vs Approve/Decline. See {@link ContractParty}. */
  initiatedBy: ContractParty;
  isPrimary: boolean;

  // ── Negotiated terms ───────────────────────────────────────────────────────
  // Everything `PATCH /agency/agents/:id/terms` writes is read back here, key
  // for key but camelCased. The backend fills each group from `contractDefaults`
  // when the contract carries none, so none of these are ever absent — seed a
  // terms editor straight from them via {@link readContractTerms}.
  employment: AgentEmployment;
  remittanceTerms: ContractRemittanceTerms;
  coverage: ContractCoverage;
  feeSplit: ContractFeeSplit;
  /** Per-shipment value cap in minor units; `null` = uncapped. */
  shipmentValueCeiling: number | null;

  /**
   * This agency's slice of the agent's global COD pool — a sub-allocation, not
   * an independent cap. Written by `PATCH .../cod-limit`, not by `/terms`.
   */
  codThreshold: number;
  /** Cash the agent currently holds attributable to THIS contract. */
  codOutstandingBalance: number;

  // ── Lifecycle stamps ───────────────────────────────────────────────────────
  /** Set when the AGENCY raised the contract; `requestedAt` when the agent did. */
  invitedAt: string | null;
  requestedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  /** Termination stamps — the field names predate the `deactivated` status. */
  removedAt: string | null;
  removalReason: string | null;
  /** Set when the contract ended because an admin moved the agent elsewhere. */
  transferredToAgencyId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Normalized, form-friendly view of a contract's terms. */
export interface ContractTerms {
  feeSplit: ContractFeeSplit;
  remittanceTerms: ContractRemittanceTerms;
  coverage: ContractCoverage;
  shipmentValueCeiling: number | null;
}

/**
 * A contract's negotiated terms, ready to seed an editor.
 *
 * Kept as its own function despite being a plain projection, because the read
 * and write sides of `/terms` deliberately disagree on casing: the response is
 * camelCase like every DTO on this API, the request body is snake_case to mirror
 * the stored document (`feeSplit.agentSharePercent` out, `fee_split.agent_share_percent`
 * in). This is the one place that asymmetry is crossed.
 */
export function readContractTerms(membership: AgentMembership): ContractTerms {
  return {
    feeSplit: membership.feeSplit,
    remittanceTerms: membership.remittanceTerms,
    coverage: membership.coverage,
    shipmentValueCeiling: membership.shipmentValueCeiling,
  };
}

export interface AgentProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  /**
   * Resolved file reference. The roster sends `avatar`; `avatarUrl` is the older
   * flat field some responses still carry — read both through
   * {@link agentAvatarUrl} rather than picking one.
   */
  avatar?: FileRef | null;
  avatarUrl?: string | null;
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

/** The agent's picture, from whichever field the response carried it in. */
export function agentAvatarUrl(agent: { avatar?: FileRef | null; avatarUrl?: string | null }): string | null {
  return agent.avatar?.url ?? agent.avatarUrl ?? null;
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
  /** This contract's slice of the agent's COD pool, minor units. */
  codThreshold: number;
  activeShipmentCount: number;
}

export function toAgentSummary(entry: RosterEntry): AgentSummary {
  return {
    id: entry.agent.id,
    membershipId: entry.membership.id,
    name: entry.agent.name,
    email: entry.agent.email ?? '',
    phone: entry.agent.phone ?? '',
    avatarUrl: agentAvatarUrl(entry.agent),
    status: entry.agent.status,
    membershipStatus: entry.membership.status,
    availability: entry.agent.availability,
    trustScore: entry.agent.trustScore,
    cashHeld: entry.cashHeld,
    vehicleInfo: entry.agent.vehicleInfo,
    codThreshold: entry.membership.codThreshold,
    activeShipmentCount: entry.agent.activeShipmentCount,
  };
}

// ─── Directory (GET /agency/agents/browse) ──────────────────────────────────────
// The platform-wide agent directory — how an agency finds agents to work with,
// mirroring the vendor browse. There are NO email invites: you reach an agent by
// finding them here and requesting them by `agentId`, which means you cannot
// approach someone who has not signed up yet.
//
// This is a PUBLIC work profile, deliberately narrower than `AgentProfile`: no
// email, phone, ID documents, payout details, position or raw capacity counters.
// Contact details are earned by contracting and arrive with the roster.

export interface AgentHomeBase {
  /** Human label the agent set ("Douala — Akwa"). */
  label: string | null;
  /** GeoJSON [lng, lat], or null if the agent has not set a home base. */
  coordinates: [number, number] | null;
  serviceRadiusKm: number | null;
}

export interface AgentRating {
  average: number | null;
  count: number;
}

/** The caller's standing with a directory agent — the live contract, else the most recent terminal one. */
export interface AgentContractRef {
  id: string;
  status: MembershipStatus;
  initiatedBy: ContractParty;
  isPrimary: boolean;
}

/** A directory row: the agent's public work profile plus your contract with them (if any). */
export interface AgentDirectoryItem {
  id: string;
  name: string;
  avatar: FileRef | null;
  vehicleType: AgentVehicleType | null;
  homeBase: AgentHomeBase;
  /** Composite 0–100. */
  trustScore: number;
  /** Always true here — unverified agents are filtered out server-side. */
  kycVerified: boolean;
  /** Does the agent want work right now? */
  availability: AgentAvailability;
  /** How loaded they are, as a label — the raw counters are not exposed to a non-contracted agency. */
  workingState: AgentWorkingState;
  completedShipments: number;
  /** 0–1, or null before enough deliveries to mean anything. */
  onTimeRate: number | null;
  ratings: {
    customer: AgentRating;
    agency: AgentRating;
    vendor: AgentRating;
  };
  contract: AgentContractRef | null;
}

export interface AgentBrowseQueryParams {
  search?: string;
  vehicle_type?: AgentVehicleType;
  availability?: 'online' | 'offline' | 'on_break';
  /** 0–100. */
  min_trust_score?: number;
  /** Radius search on the agent's declared home base — all three or none, or the API 400s. */
  lng?: number;
  lat?: number;
  radius_km?: number;
  /** `trust` (default, descending) or `name` (ascending). */
  sort?: 'trust' | 'name';
  page?: number;
  /** Max 100. */
  limit?: number;
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
// raises a request and the other side clears it.
//
// `GET /agency/agents/status-requests` returns BOTH directions — the ones the
// agent raised for us to answer AND the ones we raised waiting on them — because
// it is the only endpoint that exposes a `requestId`, and without ours `/cancel`
// would be uncallable. Which verb applies is never inferred: read
// `availableActions`, and count `awaitingMyDecision` (never rows) for badges.

export interface ContractBlockingConditions {
  outstandingCod: number;
  outstandingPayment: number;
  clear: boolean;
}

/**
 * Every contract transition the API names. Only `pause`, `reactivate` and
 * `deactivate` ever reach a status request — the handshake verbs move the
 * contract directly — but the wire type covers all of them.
 */
export type ContractTransition =
  | 'approve'
  | 'reject'
  | 'withdraw'
  | 'pause'
  | 'suspend'
  | 'reactivate'
  | 'deactivate'
  | (string & {});
export type ContractStatusRequestState =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | (string & {});
export type ContractStatusRequestDecision = 'approve' | 'reject';
/** The verbs the server will accept on a request, as it names them itself. */
export type ContractStatusRequestAction = ContractStatusRequestDecision | 'cancel';

export interface ContractStatusRequest {
  id: string;
  /** The membership this is about — a contract IS a membership. */
  contractId: string;
  agentId: string;
  agencyId: string;
  transition: ContractTransition;
  targetStatus: string;
  fromStatus: string;
  state: ContractStatusRequestState;
  /** Who raised it — and therefore whether `/resolve` or `/cancel` is our verb. */
  requestedByRole: 'agency' | 'agent' | 'admin' | 'system' | (string & {});
  /**
   * True only while pending AND raised by the agent, i.e. ours to answer. False
   * on rows we raised (ours to cancel) and on resolved ones. **The** predicate
   * for the pending-action badge — counting rows over-counts by our own.
   */
  awaitingMyDecision: boolean;
  /** What we may call on this row, in render order. Empty once resolved. */
  availableActions: ContractStatusRequestAction[];
  /**
   * Advisory only, and `null` when nothing is in the way — the same conditions
   * are re-checked on approval, never trusted from when the request was raised.
   */
  blockingConditions: ContractBlockingConditions | null;
  reason?: string | null;
  resolvedByRole?: 'agency' | 'agent' | 'admin' | 'system' | null;
  resolvedAt?: string | null;
  /** The note from whichever of `/resolve` or `/cancel` closed it. */
  resolutionNote?: string | null;
  autoApproved?: boolean;
  createdAt?: string;
  updatedAt?: string;
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

export interface AgentListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AgentBrowseResponse {
  success: true;
  data: AgentDirectoryItem[];
  meta: AgentListMeta;
}

/**
 * `GET /agency/agents` — **every status by default**, terminal rows included:
 * this is the relationship history, not only who is working today. Paginated at
 * 20 a page unless told otherwise, so read `meta` rather than assuming one page
 * holds the roster.
 */
export interface ListRosterParams {
  status?: MembershipStatus;
  page?: number;
  /** Max 100. */
  limit?: number;
}

export interface ListAgentsResponse {
  success: true;
  data: RosterEntry[];
  meta: AgentListMeta;
}

export interface AgentMembershipResponse {
  success: true;
  data: RosterEntry;
  message?: string;
}

/** Every contract mutation (request/approve/decline/withdraw/…) returns the whole contract. */
export interface MembershipMutationResponse {
  success: true;
  data: AgentMembership;
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

/**
 * `GET /agency/agents/eligible` returns bare agent profiles — the `agent` half
 * of a roster entry, without the contract or the cash held. It is the
 * dispatchable subset, already filtered by every eligibility rule.
 */
export interface EligibleAgentsResponse {
  success: true;
  data: AgentProfile[];
}

export interface AgentEligibilityResponse {
  success: true;
  data: AgentEligibility;
}

export interface AgentHistoryResponse {
  success: true;
  data: AgentHistoryEvent[];
}
