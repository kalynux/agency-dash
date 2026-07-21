// Agency Agents — membership/contract model. See api-doc/agency/agent-roster.md

export type AgentStatus = 'active' | 'inactive' | 'suspended';
export type AgentAvailability = 'online' | 'offline' | 'on_break' | string;
export type AgentWorkingState = 'working' | 'idle' | string;

export type MembershipStatus = 'pending' | 'approved' | 'suspended' | 'removed';
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
  /** Across all agencies — capacity is a property of the person + vehicle. */
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

// ─── Contract status request (proposed termination) ─────────────────────────────

export interface ContractBlockingConditions {
  outstandingCod: number;
  outstandingPayment: number;
  clear: boolean;
}

export interface ContractStatusRequest {
  id: string;
  contractId: string;
  transition: string;
  targetStatus: string;
  fromStatus: string;
  state: string;
  requestedByRole: string;
  blockingConditions: ContractBlockingConditions | null;
}

// ─── Employment / COD limit payloads ────────────────────────────────────────────

export interface UpdateEmploymentPayload {
  employment_type?: EmploymentType;
  employee_ref?: string | null;
  started_at?: string | null;
  ends_at?: string | null;
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
