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

/** One of the two sides of a contract. */
export type ContractParty = 'agent' | 'agency';

export type EmploymentType = 'employee' | 'contractor' | 'freelancer';

export interface AgentVehicleInfo {
  vehicle_type: string;
  plate_number: string;
  /**
   * A lowercase English token (`red`, `dark_blue`). Render a localized label and a
   * swatch — never the raw token, and never a guessed hex for one we don't know.
   */
  color: string;
  /**
   * OPTIONAL BY CONTRACT, not by laziness. The roster LIST returns the vehicle
   * summary with no `photo` key at all — it omits it rather than reporting
   * `photo: null` for a file it never looked up. Only the detail endpoint
   * (`GET /agency/agents/:membershipId`) resolves it. Making this required would
   * turn every `RosterEntry` into a type lie.
   */
  photo?: FileRef | null;
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
  /**
   * Which side opened the contract, derived from `origin` (only `join_request`
   * is agent-raised). **Audit only — no longer the button rule.** Terms are
   * negotiable now, so the party who may approve is whoever the *standing
   * offer* was not made by; read {@link AgentMembership.awaitingDecisionFrom}.
   */
  initiatedBy: ContractParty;
  /**
   * Whose terms are currently on the table. `null` means **nobody has proposed
   * any** — a bare agent join request, or a legacy contract whose fee split was
   * never configured. Approving one of those is `422
   * CONTRACT_TERMS_NOT_PROPOSED`; the agency owes an offer first.
   */
  termsProposedBy: ContractParty | null;
  /** Bumps on every counter, revision and accepted proposal. `0` = never stated. */
  termsVersion: number;
  /**
   * **The button rule.** Who must answer the standing offer; the other party
   * sees Withdraw. `null` in two cases a client must tell apart — the contract
   * is not `pending` (no offer on the table), or `termsProposedBy` is `null`
   * (nobody may approve, so our control reads "Propose terms"). Use
   * {@link contractOffer} rather than branching on this by hand.
   */
  awaitingDecisionFrom: ContractParty | null;
  /**
   * The open proposal on a **live** contract, when the endpoint resolved one.
   * Most endpoints return `null` here regardless — the `/terms-proposals`
   * endpoints are authoritative, so treat this as a hint, never as the absence
   * of a proposal.
   */
  openTermsProposalId: string | null;
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

// ─── Where a contract's negotiation stands ──────────────────────────────────────
// Terms are agreed, not assigned, so which control belongs on a contract depends
// on whose offer is standing — never on who opened it. The mechanism itself
// switches on status: a `pending` contract carries its offer on the contract
// document (countered in place), while a live one stages changes as separate
// proposals that only apply on acceptance.

export type ContractOffer =
  /** Their offer is on the table: Approve / Decline / Counter are ours. */
  | 'ours-to-answer'
  /** Ours is: we may Withdraw the contract, or revise the figures. */
  | 'theirs-to-answer'
  /** Nobody has proposed terms — our control is "Propose terms", not "Approve". */
  | 'needs-terms'
  /** Not pending: nothing is on the table. Live changes go through proposals. */
  | 'settled';

/**
 * Which negotiation control a pending contract should render.
 *
 * Reads `awaitingDecisionFrom`, which the server computes from the same guards
 * it enforces — so a control this returns is one the API will accept.
 * `initiatedBy` is deliberately not consulted: an agency that opened a contract
 * can still end up as the party who must answer, once the agent counters.
 */
export function contractOffer(
  membership: Pick<AgentMembership, 'status' | 'awaitingDecisionFrom' | 'termsProposedBy'>,
): ContractOffer {
  if (membership.status !== 'pending') return 'settled';
  if (membership.awaitingDecisionFrom === 'agency') return 'ours-to-answer';
  if (membership.awaitingDecisionFrom === 'agent') return 'theirs-to-answer';
  return 'needs-terms';
}

/** Contracts whose terms are staged through proposals rather than written directly. */
export const LIVE_CONTRACT_STATUSES: MembershipStatus[] = ['active', 'paused', 'suspended'];

/**
 * True when `PATCH .../terms` would be refused with `409
 * CONTRACT_TERMS_LIVE_EDIT_NOT_ALLOWED` — the contract is pricing deliveries by
 * its agreed split right now, so a change has to go through the agent.
 */
export function needsTermsProposal(membership: Pick<AgentMembership, 'status'>): boolean {
  return LIVE_CONTRACT_STATUSES.includes(membership.status);
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

/**
 * The caller's standing with a directory agent — the live contract, else the most
 * recent terminal one.
 *
 * Deliberately thinner than {@link AgentMembership}: it carries no
 * `awaitingDecisionFrom`, so a `pending` row here cannot say whose move it is.
 * The directory can only report *that* a contract exists; answering it belongs
 * to the roster, where the whole DTO is loaded.
 */
export interface AgentContractRef {
  id: string;
  status: MembershipStatus;
  /** Audit only — see {@link AgentMembership.initiatedBy}. */
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
 * The four **negotiated** term groups, as every write body spells them —
 * snake_case, mirroring the stored document, while the DTO reads back camelCase.
 * Crossing that asymmetry is what {@link ContractTerms} and the terms form are
 * for; don't assume a round trip of the same keys.
 *
 * All groups optional, at least one required. Each is merged field-by-field over
 * the stored one, so an omitted key keeps its value — which is also why a
 * partial `fee_split` patch is coherent: the model check runs on the merge.
 *
 * `employment` is absent on purpose (it is the agency's own HR record, written
 * unilaterally through `PATCH .../employment`), as is `cod.threshold` (a
 * sub-allocation of the agent's shared pool, with its own `/cod-limit`
 * endpoint). Sending either here is `403 CONTRACT_TERMS_NOT_NEGOTIABLE`.
 */
export interface NegotiableTermsPayload {
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

/**
 * `PATCH /agency/agents/:membershipId/terms` — the negotiable groups plus
 * `employment`.
 *
 * ⚠️ **Status-aware.** This endpoint only applies to a `pending` contract, where
 * it behaves exactly like `POST .../counter`. On an `active`, `paused` or
 * `suspended` one it is `409 CONTRACT_TERMS_LIVE_EDIT_NOT_ALLOWED`: that
 * contract is pricing deliveries by its agreed split right now, so a change has
 * to be staged as a proposal the agent answers. Use {@link needsTermsProposal}
 * to pick the route before writing anything.
 */
export interface UpdateTermsPayload extends NegotiableTermsPayload {
  employment?: UpdateEmploymentPayload;
}

/** `POST /agency/agents/requests` — an offer, not a bare introduction. */
export interface RequestAgentPayload {
  agentId: string;
  /**
   * **Required, and must contain `fee_split`.** A request with no numbers in it
   * would land the agent on the schema default, whose null `agent_share_percent`
   * pays them zero — so a bare `{ agentId }` is a `400`.
   */
  terms: NegotiableTermsPayload;
}

// ─── Terms proposals (changes to a LIVE contract) ───────────────────────────────
// A pending contract carries its offer on the contract itself and produces no
// proposal rows. Once it is live there is an agreed set that deliveries are
// priced by, and it must keep applying until the other side agrees to replace
// it — so a change becomes a proposal, and the contract is untouched until it is
// accepted. At most one may be open per contract.

export type TermsProposalState =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  /** The other side countered it; the negotiation continued rather than ending. */
  | 'superseded'
  | (string & {});

/** The verbs the server will accept on a proposal, as it names them itself. */
export type TermsProposalAction = 'approve' | 'reject' | 'counter' | 'cancel';

/** One changed leaf of a proposal, `termsBefore` → `proposedTerms`. */
export interface TermsDiffEntry {
  /** Dotted within the term groups, e.g. `fee_split.agent_share_percent`. */
  path: string;
  before: unknown;
  after: unknown;
}

export interface ContractTermsProposal {
  id: string;
  contractId: string;
  agentId: string;
  agencyId: string;
  /** Who raised it — and therefore whether `/resolve` or `/cancel` is our verb. */
  proposedByRole: ContractParty;
  state: TermsProposalState;
  /**
   * Pending **and** raised by the agent, i.e. ours to answer. **The** predicate
   * for a badge — a raw row count over-counts by every proposal we raised.
   */
  awaitingMyDecision: boolean;
  /**
   * Exactly the verbs the server accepts from us, in render order; empty once
   * resolved. Viewer-dependent, so drive the buttons from it: an agent reading a
   * `remittance_terms` change gets approve/reject but not counter, because that
   * group is not theirs to author.
   */
  availableActions: TermsProposalAction[];
  /**
   * The agreed terms **as they stood when this was raised** — snapshotted, not
   * re-derived, so the diff stays honest after the contract moves on.
   */
  termsBefore: Record<string, unknown>;
  /** The patch being proposed. Only the groups it names are changing. */
  proposedTerms: Record<string, unknown>;
  /** One entry per changed leaf. An unchanged restatement yields `[]`. */
  diff: TermsDiffEntry[];
  /** The proposal this one counters — walk it to rebuild the chain. */
  supersedesId: string | null;
  note: string | null;
  resolvedByRole: ContractParty | null;
  resolvedAt: string | null;
  /** The `note` from whichever verb closed it. */
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TermsProposalListResponse {
  success: true;
  data: ContractTermsProposal[];
}

export interface TermsProposalResponse {
  success: true;
  data: ContractTermsProposal;
  message?: string;
}

/** `/terms-proposals/:id/resolve` — the proposal, plus the contract it did or didn't move. */
export interface TermsProposalResolveResponse {
  success: true;
  data: { proposal: ContractTermsProposal; contract: AgentMembership };
  message?: string;
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
