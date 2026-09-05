// Vendor Connections — contract-based agency↔vendor delivery relationship.
// See api-doc/agency/vendor-connections.md.

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
  reason: 'unilateral' | 'reapproval_declined';
  note: string | null;
}

export interface ConnectionDto {
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

export interface VendorReturnPolicySummary {
  returnEligible: boolean;
  returnWindowDays: number;
  refundType: 'full' | 'partial' | 'none';
}

export interface VendorCancellationPolicySummary {
  cancellable: boolean;
  cancellationDeadline: string | null;
}

export interface VendorSupportPolicySummary {
  availability: '24_7' | 'business_hours' | 'limited' | null;
  languages: string[];
}

export interface VendorPolicySummary {
  returnPolicy: VendorReturnPolicySummary | null;
  cancellationPolicy: VendorCancellationPolicySummary | null;
  supportPolicy: VendorSupportPolicySummary | null;
}

/** A vendor listing item annotated with the agency's current connection state (if any). */
export interface VendorBrowseItemDto {
  id: string;
  businessName: string;
  displayName: string | null;
  logoUrl: string | null;
  kycVerified: boolean;
  primaryAddress: VendorPrimaryAddress | null;
  policies: VendorPolicySummary | null;
  connection: ConnectionSummary | null;
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
