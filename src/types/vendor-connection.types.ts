// Vendor Connections — contract-based agency↔vendor delivery relationship.
// See api-doc/agency/vendor-connections.md.

import type { FileRef } from '@/types/file.types';

export type ConnectionStatus =
  | 'pending'
  | 'active'
  | 'rejected'
  | 'withdrawn'
  | 'paused_reapproval'
  | 'terminated';

export type ConnectionParty = 'vendor' | 'agency';

export interface ConnectionRejectionInfo {
  reason: string | null;
  rejectedByRole: ConnectionParty;
  rejectedAt: string;
}

export interface ConnectionWithdrawalInfo {
  withdrawnByRole: ConnectionParty;
  withdrawnAt: string;
}

export interface ConnectionTerminationInfo {
  terminatedByRole: ConnectionParty;
  terminatedAt: string;
  /**
   * `role_closed` (2026-10-04, ADR-A10): the VENDOR closed its account and the
   * connection ended with it (`connection.ended_by_closure`). Final — the
   * vendor cannot be asked again.
   */
  reason: 'unilateral' | 'reapproval_declined' | 'role_closed';
  note: string | null;
}

/** True when the connection ended because the vendor closed its account. */
export function endedByVendorClosure(connection: { status: ConnectionStatus; termination: ConnectionTerminationInfo | null }): boolean {
  return connection.status === 'terminated' && connection.termination?.reason === 'role_closed';
}

/**
 * A vendor's COD terms (2026-10-02) — see api-doc/agency/vendor-connections.md
 * § Vendor COD terms. Not `policies`: a vendor changing them never pauses the
 * connection.
 */
export interface VendorCodTerms {
  /** `false` — the vendor's customers cannot pay cash on delivery. */
  codEnabled: boolean;
  /** Most of this vendor's COD cash one agency may hold un-remitted (XAF minor units); `null` = no vendor cap. */
  maxCashPerAgency: number | null;
}

/**
 * The VENDOR's account status, as carried on a connection (2026-10-18). `null`
 * only when the vendor record no longer exists. See
 * api-doc/agency/FRONTEND-CHANGELOG-connection-activation.md.
 */
export type CounterpartyStatus = 'active' | 'pending_verification' | 'inactive';

/**
 * The VENDOR's display fields, as carried on a connection (2026-10-18). What
 * names and draws a connection row — browse lists `active` vendors only, so it
 * cannot name a `pending_verification` one. See
 * api-doc/agency/FRONTEND-CHANGELOG-activation-and-counterparty.md.
 */
export interface CounterpartyProfile {
  /** The vendor's Store name; `''` when it has no Store yet. */
  businessName: string;
  displayName: string | null;
  /** The Store logo. Render through `resolveFileUrl`, never `url` directly. */
  logo: FileRef | null;
  kycVerified: boolean;
}

export interface ConnectionDto {
  /**
   * Agency side only (`GET /` and `GET /:id`). Optional — responses older than
   * 2026-10-02, and mutation responses, may omit it.
   */
  vendorCodTerms?: VendorCodTerms | null;
  /**
   * The vendor's account status — on every connection response (list, detail
   * and all five mutations). A badge, never a gate: approving a
   * `pending_verification` vendor's request is allowed as usual. Optional only
   * because a backend older than 2026-10-18 does not send it.
   */
  counterpartyStatus?: CounterpartyStatus | null;
  /**
   * The vendor's name, logo and KYC flag, on the same responses as
   * `counterpartyStatus`. `null` only when the vendor record is gone; optional
   * for a backend older than 2026-10-18.
   */
  counterpartyProfile?: CounterpartyProfile | null;
  id: string;
  vendorId: string;
  agencyId: string;
  status: ConnectionStatus;
  requesterRole: ConnectionParty;
  requestedByUserId: string;
  requestedAt: string;
  respondedByUserId: string | null;
  respondedAt: string | null;
  reapprovalRequiredFrom: ConnectionParty | null;
  pausedAt: string | null;
  pausedReason: 'vendor_policy_changed' | 'agency_policy_changed' | null;
  rejection: ConnectionRejectionInfo | null;
  withdrawal: ConnectionWithdrawalInfo | null;
  termination: ConnectionTerminationInfo | null;
  createdAt: string;
  updatedAt: string;
}

/** Thin connection annotation nested on each `GET .../browse` vendor result. */
export interface ConnectionSummary {
  id: string;
  status: ConnectionStatus;
}

// ─── Browse listing (vendor side, as seen by an agency) ────────────────────────

export interface VendorPrimaryAddress {
  label: string;
  addressLine1: string;
  city: string;
  state: string | null;
}

// Since 2026-10-03 the browse DTO carries every structured policy field the
// vendor set. The added fields are optional here: a response from an older
// backend lacks them, and the detail sheet simply omits those rows.

export interface VendorReturnPolicySummary {
  returnEligible: boolean;
  returnWindowDays: number;
  refundType: 'full' | 'partial' | 'none';
  /** `partial` refunds only. */
  refundPercentage?: number | null;
  returnShippingPayer?: 'vendor' | 'customer' | 'customer_reimbursed_if_defect' | null;
  refundProcessingDays?: number | null;
  returnConditionNotes?: string | null;
  inspector?: 'admin' | 'vendor' | 'platform' | null;
}

export interface VendorCancellationPolicySummary {
  cancellable: boolean;
  cancellationDeadline: string | null;
  /** `anytime_until_days_before_delivery` only. */
  cancellationDeadlineDays?: number | null;
  cancellationFeeType?: 'none' | 'fixed' | 'percentage' | 'full_non_refundable' | null;
  cancellationFeeValue?: number | null;
  lateCancellationRefundType?: 'fixed' | 'percentage' | 'full_non_refundable' | null;
  lateCancellationRefundValue?: number | null;
}

export interface VendorSupportPolicySummary {
  availability: '24_7' | 'business_hours' | 'limited' | null;
  availabilityDescription?: string | null;
  languages: string[];
  /** Channel kinds only — the contact values are never sent to an agency. */
  channelTypes?: string[];
  requiredInfo?: string[];
  eligibilityNotes?: string | null;
}

export interface VendorPolicySummary {
  returnPolicy: VendorReturnPolicySummary | null;
  cancellationPolicy: VendorCancellationPolicySummary | null;
  supportPolicy: VendorSupportPolicySummary | null;
  /** Up to 2 supporting document URLs for terms the fields above don't cover. */
  documents?: string[];
}

/** A vendor listing item annotated with the agency's current connection state (if any). */
export interface VendorBrowseItemDto {
  id: string;
  businessName: string;
  displayName: string | null;
  /**
   * The Store logo — a file object, not a URL string. Render through
   * `resolveFileUrl`. (This was typed as a `logoUrl` string the backend never
   * sent, so browse logos never rendered; fixed 2026-10-18.)
   */
  logo: FileRef | null;
  kycVerified: boolean;
  primaryAddress: VendorPrimaryAddress | null;
  policies: VendorPolicySummary | null;
  connection: ConnectionSummary | null;
  /** Optional — responses older than 2026-10-02 lack it. */
  codTerms?: VendorCodTerms | null;
}

// ─── Query params ───────────────────────────────────────────────────────────────

export interface VendorBrowseQueryParams {
  search?: string;
  city?: string;
  state?: string;
  /** Only sent as `"true"` when checked — never send `false`. */
  return_eligible?: boolean;
  /** Only sent as `"true"` when checked — never send `false`. */
  cancellable?: boolean;
  page?: number;
  limit?: number;
}

export interface ListConnectionsParams {
  status?: ConnectionStatus;
  page?: number;
  limit?: number;
}

// ─── Response envelopes ──────────────────────────────────────────────────────────

export interface VendorConnectionListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GetVendorBrowseResponse {
  success: true;
  data: VendorBrowseItemDto[];
  meta: VendorConnectionListMeta;
}

export interface ListVendorConnectionsResponse {
  success: true;
  data: ConnectionDto[];
  meta: VendorConnectionListMeta;
}

export interface VendorConnectionResponse {
  success: true;
  data: ConnectionDto;
}
