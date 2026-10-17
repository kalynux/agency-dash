// Agency Tickets — see api-doc/agency/tickets.md (authoritative enums)

import type { FileRef } from '@/types/file.types';
import type { ProductCategoryRef } from '@/types/product-category.types';

export type TicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_on_admin'
  | 'waiting_on_vendor'
  | 'waiting_on_customer'
  | 'waiting_on_agency'
  | 'waiting_on_agent'
  | 'resolved'
  | 'closed';

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketImportance = 'low' | 'medium' | 'high' | 'critical';

export type TicketEntityType =
  | 'ORDER'
  | 'PRODUCT'
  | 'BOOKING'
  | 'SHIPMENT'
  | 'DELIVERY'
  | 'USER'
  | 'VENDOR'
  | 'CUSTOMER'
  | 'AGENT'
  | 'AGENCY'
  | 'OTHER';

export type TicketRole = 'admin' | 'vendor' | 'customer' | 'agency' | 'agent';

export type TicketType =
  // General Support
  | 'GENERAL_SUPPORT' | 'ACCOUNT_ACCESS' | 'ACCOUNT_VERIFICATION' | 'PROFILE_UPDATE' | 'SECURITY_ISSUE'
  // Order
  | 'ORDER_ISSUE' | 'ORDER_CANCELLATION' | 'ORDER_REFUND' | 'ORDER_DISPUTE' | 'ORDER_FULFILLMENT'
  // Payment
  | 'PAYMENT_ISSUE' | 'PAYMENT_FAILED' | 'PAYMENT_CONFIRMATION' | 'CHARGEBACK' | 'INVOICE_REQUEST'
  // Payout
  | 'PAYOUT_REQUEST' | 'PAYOUT_DELAY' | 'PAYOUT_DISPUTE' | 'COMMISSION_QUESTION'
  // Booking
  | 'BOOKING_ISSUE' | 'BOOKING_CANCELLATION' | 'BOOKING_RESCHEDULE' | 'AVAILABILITY_PROBLEM'
  // Product
  | 'PRODUCT_ISSUE' | 'INVENTORY_PROBLEM' | 'PRICING_ISSUE' | 'VARIANT_ISSUE'
  // Shipping / Delivery
  | 'SHIPPING_ISSUE' | 'DELIVERY_DELAY' | 'DELIVERY_CONFIRMATION' | 'ADDRESS_CHANGE'
  // Technical
  | 'TECHNICAL_ISSUE' | 'BUG_REPORT' | 'INTEGRATION_ISSUE' | 'API_ACCESS'
  // Policy / Legal
  | 'POLICY_QUESTION' | 'COMPLIANCE' | 'LEGAL_REQUEST'
  // Other
  | 'OTHER';

/**
 * Who a ticket, note or attachment names — `created_by`, `assigned_to`, each
 * `followers` entry, a note's `author`, an attachment's `uploadedByActor`.
 *
 * Since 2026-10-09 an agency follows every ticket about an order it carries, so
 * these are routinely somebody else: the customer, the vendor, one of its agents.
 */
export interface TicketActor {
  user_id: string;
  role: string;
  /**
   * `''` (not `null`) for a vendor or agency with neither a display name nor a
   * store/magazin, and the capitalised role (`"Admin"`) when the reference could
   * not be resolved at all. Test for empty.
   */
  name: string;
  /**
   * A resolved file object, never a URL string. For a vendor or an agency it is
   * the store/magazin logo.
   */
  avatar: FileRef | null;
  /**
   * The KYC verdict — present ONLY on `vendor` and `agent` actors. Absent on any
   * other role (or an unresolved actor) means "no badge", not "unverified".
   */
  verified?: boolean;
}

/**
 * A support administrator, as a ticket follower is shown them — `assigned_admin`
 * and `created_by_admin`. NOT a {@link TicketActor}: no `role`, no `user_id`.
 *
 * Administrators live in another service, so this is a snapshot copied onto the
 * ticket. `avatar_url` is reserved and always `null`; draw initials from `name`.
 */
export interface TicketAdminSnapshot {
  name: string;
  job_title: string | null;
  department: string | null;
  avatar_url: string | null;
}

export interface TicketEntityRef {
  type: TicketEntityType;
  id: string;
  label: string;
  reference: string;
}

/**
 * ⚠ **A ticket is identified by `id`, not `_id`** — on every endpoint on this
 * surface.
 *
 * `Ticket` is built on the backend's `BaseSchemaOptions`, whose `toJSON` deletes
 * `_id` and exposes the `id` virtual, so **the write endpoints — status,
 * priority, assign, close, reopen and the `PATCH` on the ticket itself — return
 * the document with `id` ALONE**. Only the three enriched reads (create, list,
 * detail) additionally carry a duplicate `_id`, because their enrichment service
 * builds its payload with `toObject({ virtuals: true })`, which applies no
 * transform.
 *
 * `id` is the only identifier present on all of them, so it is the one to key
 * on. A client keying on `_id` reads `undefined` the first time it patches a
 * ticket — and this screen replaces its state with the write response, so the
 * *next* action, the notes thread and the attachments panel all break at once.
 *
 * `ticketsService` normalises `id` onto every response it returns, so `_id`
 * below is only what the enriched reads happen to carry. Do not read it.
 * See api-doc/agency/tickets.md.
 */
export interface Ticket {
  id: string;
  /** Duplicate, present only on create/list/detail. Never key on it. */
  _id?: string;
  subject: string;
  description: string;
  type: TicketType;
  importance: TicketImportance;
  priority: TicketPriority;
  status: TicketStatus;
  entity_type: TicketEntityType;
  entity_id: string;
  tracking_number?: string | null;
  entity: TicketEntityRef | null;
  /**
   * The one field that decides who may close the ticket — compare it with the
   * signed-in user's id. Present on write responses too.
   */
  created_by_user_id: string;
  created_by_role: string;
  /**
   * Often not this agency. When an administrator or the platform opened the
   * ticket this still arrives, with `role: 'admin'`, but its `user_id` resolves
   * nowhere and its `avatar` is `null` — render the person from
   * `created_by_admin` instead.
   */
  created_by: TicketActor | null;
  /** Non-null only on a ticket an administrator or the platform ("Wi-Mall (automatic)") opened. */
  created_by_admin?: TicketAdminSnapshot | null;
  assigned_to_role: string | null;
  assigned_to: TicketActor | null;
  /** `null` until an administrator takes the ticket, which is the normal state. */
  assigned_admin: TicketAdminSnapshot | null;
  priority_locked: boolean;
  /**
   * Detail only (`GET /:id` and create) — absent from list rows and from every
   * write response. Oldest first.
   */
  followers?: TicketActor[];
  createdAt: string;
  updatedAt: string;
}

/** Same identifier rule as {@link Ticket} — key on `id`. */
export interface TicketNote {
  id: string;
  /** Duplicate, present only on the enriched reads. Never key on it. */
  _id?: string;
  ticket_id: string;
  content: string;
  visibility: 'public' | 'private';
  is_system_note: boolean;
  author_user_id: string;
  author_role: string;
  author: TicketActor | null;
  visible_to_user_ids: string[];
  created_at: string;
}

export interface TicketAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  uploadedBy: string;
  uploadedByRole: string;
  uploadedByActor: TicketActor | null;
  createdAt: string;
}

// ─── Reference lookups (for entityId / trackingNumber pickers) ──────────────────

export interface TicketReferenceOrderShipment {
  shipmentId: string;
  agencyId: string;
  agencyName: string;
  agentId: string | null;
  trackingNumber: string | null;
  status: string;
}

export interface TicketReferenceOrder {
  id: string;
  orderNumber: string;
  orderType: string;
  fulfillmentStatus: string;
  createdAt: string;
  customerName: string;
  /** A resolved file object, never a URL string. */
  customerAvatar: FileRef | null;
  shipments: TicketReferenceOrderShipment[];
}

export interface TicketReferenceProduct {
  id: string;
  title: string;
  slug: string;
  /** 1–5, vendor's order, `[0]` is the primary. `[]` on unconverted data = no category. */
  categories: ProductCategoryRef[];
  /** @deprecated `categories[0].name` — read `categories`. */
  category: string | null;
  tags: string[];
  firstFileUrl: string | null;
}

// ─── Query params & response envelopes ─────────────────────────────────────────

export interface TicketPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ListTicketsParams {
  type?: TicketType;
  status?: TicketStatus;
  priority?: TicketPriority;
  entityType?: TicketEntityType;
  entityId?: string;
  /** Pass the signed-in user's id to get only the tickets this agency opened. */
  createdByUserId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateTicketPayload {
  subject: string;
  description: string;
  type: TicketType;
  importance: TicketImportance;
  entityType: TicketEntityType;
  entityId?: string;
  trackingNumber?: string;
  attachments?: string[];
}

export interface ListTicketsResponse {
  success: true;
  data: Ticket[];
  pagination: TicketPagination;
}

export interface TicketResponse {
  success: true;
  data: Ticket;
  message?: string;
}

export interface TicketNoteResponse {
  success: true;
  data: TicketNote;
}

export interface ListTicketNotesResponse {
  success: true;
  data: TicketNote[];
}

export interface TicketAttachmentResponse {
  success: true;
  data: TicketAttachment;
}

export interface ListTicketAttachmentsResponse {
  success: true;
  data: TicketAttachment[];
}

export interface ListReferenceOrdersResponse {
  success: true;
  data: TicketReferenceOrder[];
  pagination: TicketPagination;
}

export interface ListReferenceProductsResponse {
  success: true;
  data: TicketReferenceProduct[];
  pagination: TicketPagination;
}
