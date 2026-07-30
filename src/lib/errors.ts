import { ApiError } from '@/types/api';

/**
 * Central registry of backend `error.code` → human message. Sourced from the
 * api-doc error catalog and per-domain docs. Branch on `error.code` (stable),
 * never `error.message` (human copy, may change).
 *
 * Domain screens may pass local `overrides` to `getApiErrorMessage` for
 * context-specific phrasing, but everything falls back here so error handling
 * is consistent across the app.
 */
export const API_ERROR_MESSAGES: Record<string, string> = {
  // ── Auth / session ──────────────────────────────────────────────────────
  AUTH_MISSING_TOKEN: 'Your session has expired. Please log in again.',
  AUTH_TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  AUTH_SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  AUTH_TOKEN_INVALID: 'Your session is invalid. Please log in again.',
  AUTH_ROLE_NOT_FOUND: "You don't have permission to access this area.",
  AUTH_INVALID_CREDENTIALS: 'Invalid credentials.',
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: "You don't have permission to perform this action.",
  USER_INVALID_PASSWORD: 'Current password is incorrect.',

  // ── Validation / generic ────────────────────────────────────────────────
  VALIDATION_ERROR: 'Please check the highlighted fields and try again.',
  DATABASE_UNIQUE_CONSTRAINT_VIOLATION: 'That value is already in use.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again.',
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred. Please try again.',

  // ── Agency profile / onboarding ─────────────────────────────────────────
  DELIVERY_AGENCY_NOT_FOUND: 'Your agency profile could not be found.',
  DELIVERY_ONBOARDING_ALREADY_COMPLETED:
    'Onboarding is already complete — edit these details from Settings instead.',
  DELIVERY_ONBOARDING_CONCURRENT_MODIFICATION:
    'Your profile was modified elsewhere. Please refresh and try again.',
  DELIVERY_ONBOARDING_STEP_INCOMPLETE: 'Please complete the earlier steps first.',
  DELIVERY_ONBOARDING_STEP_INVALID: 'That step could not be submitted here.',
  DELIVERY_POLICY_DOCUMENT_MISSING: 'No document was provided.',
  DELIVERY_POLICY_DOCUMENT_TYPE_INVALID: 'Only PDF files are accepted.',

  // ── Agency magazin (business identity + logistics footprint) ────────────
  MAGAZIN_CONFLICT: 'Your business details were updated elsewhere. Refreshed — please re-apply your changes.',
  MAGAZIN_NOT_FOUND: 'Your business profile could not be found.',
  AGENCY_COVERAGE_AREA_INVALID:
    'One of the selected regions is not part of your operating country.',

  // ── Geospatial addresses ────────────────────────────────────────────────
  // Coverage areas and HQ addresses are anchored to the agency's set-once
  // `country`; every new or edited address must carry a selected search result.
  ADDRESS_GEO_REQUIRED: 'Pick an address from the search results so it can be placed on the map.',
  ADDRESS_COUNTRY_MISMATCH: 'That address is outside your agency’s operating country.',
  PROFILE_COUNTRY_IMMUTABLE: 'Your operating country was set during onboarding and cannot be changed.',
  GEO_PROVIDER_UNAVAILABLE: 'Address search is temporarily unavailable. Please try again.',
  GEO_SEARCH_FAILED: 'Address search failed. Please try again.',
  GEO_PROVIDER_NOT_CONFIGURED: 'Address search is not configured. Please contact support.',

  // ── Vendor connections ──────────────────────────────────────────────────
  CONNECTION_NOT_FOUND: 'This connection could not be found.',
  CONNECTION_VENDOR_NOT_FOUND: 'That vendor could not be found.',
  CONNECTION_ALREADY_EXISTS: 'A connection with this vendor already exists.',
  CONNECTION_INVALID_STATUS_TRANSITION: "That action doesn't apply to this connection's status.",
  CONNECTION_NOT_PENDING: 'This request is no longer pending.',
  CONNECTION_NOT_PAUSED: 'This connection is not awaiting reapproval.',
  CONNECTION_NOT_ACTIVE: 'This connection is not active.',
  CONNECTION_NOT_REQUESTER: 'Only the requester can do that.',
  CONNECTION_NOT_APPROVER: 'Only the approver can do that.',
  CONNECTION_WRONG_REAPPROVAL_PARTY: "It's not your turn to reapprove this connection.",

  // ── Shipments ───────────────────────────────────────────────────────────
  SHIPMENT_NOT_FOUND: 'This shipment could no longer be found.',
  SHIPMENT_INVALID_STATUS_TRANSITION:
    "This shipment can't be moved to that status from its current one.",
  SHIPMENT_REJECTION_NOT_ALLOWED:
    'This shipment has already been picked up and can no longer be rejected.',
  SHIPMENT_AGENT_NOT_ASSIGNED: 'Assign an agent (and wait for acceptance) before picking this up.',
  SHIPMENT_AGENT_NOT_IN_AGENCY: "That agent doesn't belong to your agency.",

  // ── Assignment (offer/acceptance workflow) ──────────────────────────────
  SHIPMENT_NOT_OFFERABLE: 'This shipment cannot be offered in its current state.',
  SHIPMENT_ALREADY_HAS_AGENT: 'This shipment already has an assigned agent.',
  SHIPMENT_ALREADY_HAS_PENDING_OFFER: 'This shipment already has a pending offer out.',
  SHIPMENT_NO_ELIGIBLE_AGENTS: 'No eligible agent is available right now.',
  SHIPMENT_NOT_REASSIGNABLE: 'There is no agent bound to this shipment to reassign from.',
  SHIPMENT_REASSIGNMENT_NOT_ALLOWED:
    "This shipment can't be reassigned in its current state.",
  SHIPMENT_REASSIGN_REQUIRES_MANUAL_AGENT:
    'The parcel has left the agency — choose a specific replacement agent.',
  SHIPMENT_REASSIGN_SAME_AGENT: 'Choose a different agent from the current one.',
  SHIPMENT_REASSIGNMENT_CONFLICT: 'This shipment just changed — please retry.',
  AGENT_NOT_ELIGIBLE_FOR_ASSIGNMENT: 'This agent is not eligible for assignment right now.',

  // ── COD cash ────────────────────────────────────────────────────────────
  COD_AGENT_NOT_ASSIGNED:
    'This is a cash-on-delivery shipment — an agent must accept it before pickup.',
  COD_AGENT_EXPOSURE_EXCEEDED:
    "This agent's cash-on-delivery exposure limit would be exceeded by this shipment.",
  COD_AGENT_TRUST_TOO_LOW:
    "This agent's trust score is too low to carry cash-on-delivery shipments.",
  COD_AGENT_HAS_OUTSTANDING_CASH:
    'This agent still holds undeposited cash — record their deposit first.',
  COD_DEPOSIT_INVALID_AMOUNT: 'Enter a positive whole amount.',
  COD_DEPOSIT_EXCEEDS_BALANCE: 'That is more than the agent currently holds.',
  COD_DEPOSIT_NOT_FOUND: 'This deposit could not be found.',
  COD_DEPOSIT_ALREADY_RESOLVED: 'This deposit has already been confirmed or rejected.',
  COD_DEPOSIT_WRONG_RECIPIENT:
    'This was declared as paid to the platform — only an admin can resolve it.',
  COD_DEPOSIT_REFERENCE_REQUIRED: 'A transfer reference is required.',
  CONTRACT_SETTLEMENT_EXCEEDS_OUTSTANDING:
    'That is more than the agent owes your agency.',
  COD_REMITTANCE_INVALID_AMOUNT: 'Enter a positive whole amount.',
  COD_REMITTANCE_EXCEEDS_LIABILITY: 'That is more than your agency currently owes.',
  COD_REMITTANCE_NOT_FOUND: 'This remittance could not be found.',
  COD_REMITTANCE_ALREADY_RESOLVED: 'This remittance has already been resolved.',
  COD_DISCREPANCY_NOT_FOUND: 'This discrepancy could not be found.',
  COD_DISCREPANCY_ALREADY_RESOLVED: 'This discrepancy is already closed.',

  // ── Agent roster / membership ───────────────────────────────────────────
  DELIVERY_INVITE_NOT_FOUND: 'This invite no longer exists or was already resolved.',
  DELIVERY_INVITE_ALREADY_PENDING: 'There is already an open invite for this email.',
  DELIVERY_AGENT_ALREADY_IN_AGENCY: 'That agent already belongs to an agency.',
  DELIVERY_AGENT_NOT_IN_AGENCY: "That agent doesn't belong to your agency.",
  DELIVERY_AGENT_HAS_ACTIVE_SHIPMENTS:
    'This agent has shipments in flight — resolve those first.',
  AGENT_MEMBERSHIP_ALREADY_EXISTS: 'This agent already has a membership with your agency.',
  AGENT_MEMBERSHIP_ALREADY_APPROVED: 'This membership is already approved.',
  AGENT_MEMBERSHIP_NOT_PENDING: 'This membership is no longer pending.',
  AGENT_MEMBERSHIP_NOT_APPROVED: 'This membership is not approved.',
  AGENT_MEMBERSHIP_NOT_SUSPENDED: 'This membership is not suspended.',
  AGENT_MEMBERSHIP_LIMIT_REACHED: 'This agent has reached their agency limit.',
  CONTRACT_NOT_FOUND: 'That agent contract could not be found.',
  CONTRACT_STATUS_REQUEST_ALREADY_PENDING:
    'A removal request is already pending for this agent.',
  CONTRACT_STATUS_REQUEST_NOT_FOUND: 'That request no longer exists.',
  CONTRACT_STATUS_REQUEST_NOT_PENDING: 'That request has already been resolved.',
  CONTRACT_STATUS_REQUEST_NOT_YOURS:
    'You raised this request — the agent has to clear it from their side.',
  CONTRACT_FEE_SPLIT_INVALID:
    'That fee split has no value for its model — set a share percentage for a percentage split, or a flat fee for a flat one.',
  CONTRACT_INVALID_TRANSITION: 'That contract change no longer applies.',
  CONTRACT_HAS_OUTSTANDING_COD:
    'This agent still holds cash for your agency — record their deposits first.',
  CONTRACT_HAS_UNPAID_EARNINGS: 'Pay the agent for their work under this contract first.',
  CONTRACT_COD_THRESHOLD_OUT_OF_BOUNDS: 'That COD limit is outside the allowed range.',
  CONTRACT_COD_THRESHOLD_EXCEEDS_HEADROOM:
    "That exceeds the agent's remaining COD pool. Ask them to raise their global limit.",
  CONTRACT_COD_THRESHOLD_BELOW_OUTSTANDING:
    'You cannot set a limit below the cash the agent already holds for you.',

  // ── Earnings / payout ───────────────────────────────────────────────────
  EARNINGS_PAYOUT_ALREADY_PENDING: 'You already have a payout request in progress.',
  EARNINGS_PAYOUT_METHOD_MISSING: 'Add a payout method before requesting a payout.',
  EARNINGS_PAYOUT_NO_AVAILABLE_BALANCE: 'There is no available balance to pay out.',
  EARNINGS_PAYOUT_BELOW_MINIMUM: 'Your available balance is below the 10,000 XAF minimum.',

  // ── Tickets ─────────────────────────────────────────────────────────────
  TICKET_NOT_FOUND: 'This ticket could not be found.',
  TICKET_ACCESS_DENIED: "You don't have access to this ticket.",
  TICKET_ENTITY_NOT_FOUND: 'The referenced item could not be found.',
  TICKET_REQUIRED_INFO_MISSING: 'Some required information is missing for this ticket type.',
  TICKET_ASSIGN_FAILED: 'A specific user is required for that role.',
  TICKET_PRIORITY_LOCKED: 'Priority is locked by an admin.',
  TICKET_CLOSED: 'This ticket is closed.',
  TICKET_WAITING_TARGET_NOT_PARTICIPANT:
    "You can't wait on a party that isn't on this ticket.",
  TICKET_ATTACHMENT_MISSING: 'That file could not be found.',
  TICKET_ATTACHMENT_LIMIT_EXCEEDED: 'A ticket can have at most 5 attachments.',

  // ── Uploads / files ─────────────────────────────────────────────────────
  UPLOAD_POLICY_VIOLATION: 'One or more files were rejected. See the details below.',
  CATALOG_FILE_TOO_LARGE: 'That file is too large.',
  FILE_TOO_LARGE: 'That file is too large.',
  CATALOG_FILE_STILL_REFERENCED: 'This file is still in use — detach it before deleting.',
  // NOTE: per-file upload rejections (QUOTA_EXCEEDED, MIME_NOT_ALLOWED, …) arrive
  // as entries in UPLOAD_POLICY_VIOLATION.details.violations[], not as top-level
  // codes — they are mapped in lib/uploadErrors.ts, not here.

  // ── Notifications / channels ────────────────────────────────────────────
  DELIVERY_AGENCY_NOTIFICATION_NOT_FOUND: 'This notification could not be found.',
  DELIVERY_AGENCY_NOTIFICATION_CHANNEL_NOT_VERIFIED:
    'Verify this channel before enabling it.',
  DELIVERY_AGENCY_NOTIFICATION_DELIVERY_FAILED:
    'The notification was saved but a secondary-channel delivery failed.',

  // ── WhatsApp / Telegram linking ─────────────────────────────────────────
  WHATSAPP_NOT_LINKED: 'No WhatsApp account is linked.',
  WHATSAPP_ROLE_NOT_SUPPORTED: 'This role does not support WhatsApp linking.',
  TELEGRAM_NOT_LINKED: 'No Telegram account is linked.',
  TELEGRAM_LINK_FAILED: 'Could not start Telegram linking. Please try again.',

  // ── Payment methods ─────────────────────────────────────────────────────
  PAYMENT_METHOD_NOT_FOUND: 'That payment method could not be found.',
  PAYMENT_METHOD_LIMIT_REACHED: 'You can save at most 10 payment methods.',
};

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Standard way to turn any thrown value into a user-facing message.
 * @param overrides optional per-screen `code → message` map (takes precedence).
 */
export function getApiErrorMessage(err: unknown, overrides?: Record<string, string>): string {
  if (err instanceof ApiError) {
    return (
      overrides?.[err.code] ??
      API_ERROR_MESSAGES[err.code] ??
      err.message ??
      GENERIC_MESSAGE
    );
  }
  if (err instanceof Error && err.message) return err.message;
  return GENERIC_MESSAGE;
}

/** The `requestId` to surface in support-facing error copy, if present. */
export function getRequestId(err: unknown): string | undefined {
  return err instanceof ApiError ? err.requestId : undefined;
}

/** True when the error is an auth/permission failure (401/403). */
export function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}
