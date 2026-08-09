// Agency Stock Requests — see api-doc/agency/stock-requests.md
//
// WHY THIS EXISTS. `ProductVariant.stock` used to be the vendor's alone. For a
// product WE warehouse that is the wrong owner: we are the party who can go and
// count the shelf, we bill storage per SKU against that figure, and we are the
// one left short when a delivery is dispatched against stock that never arrived.
// The vendor owns the goods and the catalogue, so we cannot write it either. So
// neither side writes it — one proposes, the other approves, and the number moves
// in the same transaction that records the approval.
//
// This applies ONLY to products whose pickup is `agency_storage` and whose
// effective agency is us. A vendor still edits the rest of their catalogue
// directly.
//
// THE ONE RULE THAT MATTERS. Do not re-implement the authority table. Every
// response carries `availableActions` — the server's verdict FOR US — and
// rendering buttons from anything else is how a client ends up offering a verb the
// API refuses (`403 STOCK_REQUEST_NOT_YOURS`).

export type StockRequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

/**
 * What we may do to a request right now, as decided server-side.
 *
 * `['withdraw']` when we raised it · `['approve','reject']` when the vendor did ·
 * `[]` once resolved. The asymmetry is deliberate: give the author a `reject` and
 * a request has two ways to die that mean different things; give the counterparty
 * a `withdraw` and either side can retract the other's ask.
 */
export type StockRequestAction = 'approve' | 'reject' | 'withdraw';

export type StockRequestParty = 'vendor' | 'agency';

/** One transition in the request's trail. */
export interface StockRequestStatusEvent {
  status: StockRequestStatus;
  changedAt: string;
  changedByRole: StockRequestParty;
  note: string | null;
}

export interface StockRequestApproval {
  byRole: StockRequestParty;
  at: string;
  /**
   * What the SKU actually held the instant it was replaced — the audit trail for
   * drift between the proposal and the approval.
   */
  quantityAtApply: number;
}

export interface StockRequestRejection {
  byRole: StockRequestParty;
  at: string;
  reason: string | null;
}

export interface StockRequestWithdrawal {
  byRole: StockRequestParty;
  at: string;
}

/**
 * One proposed change to a warehoused SKU's recorded stock.
 *
 * Exactly one of `approval` / `rejection` / `withdrawal` is non-null once the
 * request leaves `pending`.
 */
export interface StockRequest {
  id: string;
  productId: string;
  variantId: string;
  vendorId: string;
  agencyId: string;

  requestedByRole: StockRequestParty;
  requestedAt: string;

  /** What the PROPOSER saw when they raised it. */
  quantityBefore: number | null;
  infiniteBefore: boolean | null;
  /** What it will read IF approved. ABSOLUTE, never a delta. */
  requestedQuantity: number;
  requestedInfinite: boolean | null;
  /** What the SKU reads RIGHT NOW. `null` in the list when unresolvable. */
  currentQuantity: number | null;
  currentInfinite: boolean | null;

  status: StockRequestStatus;
  note: string | null;

  /** Drive the badge count off this — `true` when it is our turn. */
  awaitingMyDecision: boolean;
  /** Render buttons from EXACTLY this array. Never from `status`. */
  availableActions: StockRequestAction[];

  approval: StockRequestApproval | null;
  rejection: StockRequestRejection | null;
  withdrawal: StockRequestWithdrawal | null;

  statusHistory: StockRequestStatusEvent[];

  createdAt: string;
  updatedAt: string;
}

/**
 * `quantityBefore ≠ currentQuantity` — somebody changed the number between the
 * proposal and now.
 *
 * **Not an error, and deliberately not a 409.** The request proposes an ABSOLUTE
 * figure, so drift changes *what is replaced*, not whether the request still makes
 * sense. It is the one thing an approver has to notice before signing off, so show
 * both numbers whenever this is true.
 */
export function hasDrift(request: StockRequest): boolean {
  return request.currentQuantity != null && request.currentQuantity !== request.quantityBefore;
}

/** Whether the server says we may take this action. The only legal button rule. */
export function can(request: StockRequest, action: StockRequestAction): boolean {
  return request.availableActions?.includes(action) ?? false;
}

// ─── Requests & responses ─────────────────────────────────────────────────────

/**
 * `awaiting_me` is "pending, and the vendor raised it" — our action list in one
 * query. `raised_by_me` is the converse.
 */
export type StockRequestDirection = 'awaiting_me' | 'raised_by_me';

/**
 * Query for `GET /agency/stock-requests`. Unknown parameters are REJECTED with
 * `400 VALIDATION_ERROR`.
 *
 * **No `status` filter returns EVERY status, terminal rows included.** That is
 * deliberate: a live-only default would make a SKU's negotiation history
 * impossible to fetch, and the list is the only place we learn the id of a request
 * we raised ourselves.
 */
export interface ListStockRequestsParams {
  page?: number;
  /** 1–100. Defaults to 20 server-side. */
  limit?: number;
  status?: StockRequestStatus;
  productId?: string;
  /** One SKU's whole negotiation history. */
  variantId?: string;
  direction?: StockRequestDirection;
}

export interface StockRequestListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListStockRequestsResponse {
  success: true;
  /** Newest first. */
  data: StockRequest[];
  meta: StockRequestListMeta;
}

export interface StockRequestResponse {
  success: true;
  data: StockRequest;
  message?: string;
}

export interface CreateStockRequestPayload {
  productId: string;
  variantId: string;
  /**
   * The ABSOLUTE target, never a delta. `0` is valid — a warehouse can be emptied.
   *
   * Absolute because a `-10` approved three days later applies to a number nobody
   * agreed on; an absolute figure states exactly what the shelf will read.
   */
  quantity: number;
  /** ≤500 chars. Shown to the vendor — say what was counted. */
  note?: string;
}

export interface RejectStockRequestPayload {
  /** Optional, shown to the vendor. Nothing is written to the SKU either way. */
  reason?: string;
}

/**
 * `details` of `409 STOCK_REQUEST_ALREADY_PENDING` — one open request per SKU.
 *
 * `hint` tells the user whether to withdraw theirs or answer the other side's, and
 * `requestId` is what to link them to.
 */
export interface StockRequestAlreadyPendingDetails {
  requestId: string;
  requestedByRole: StockRequestParty;
  hint: string;
}
