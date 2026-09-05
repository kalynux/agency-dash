// Agency Tickets — see api-doc/agency/tickets.md (authoritative enums)

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

export interface TicketActor {
  user_id: string;
  role: string;
  name: string;
  avatar_url: string | null;
}

export interface TicketEntityRef {
  type: TicketEntityType;
  id: string;
  label: string;
  reference: string;
}

export interface Ticket {
  _id: string;
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
  created_by_user_id: string;
  created_by_role: string;
  created_by: TicketActor | null;
  assigned_to_role: string | null;
  assigned_to: TicketActor | null;
  assigned_admin_id: string | null;
  assigned_admin: TicketActor | null;
  priority_locked: boolean;
  followers?: TicketActor[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketNote {
  _id: string;
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
  customerAvatarUrl: string | null;
  shipments: TicketReferenceOrderShipment[];
}

export interface TicketReferenceProduct {
  id: string;
  title: string;
  slug: string;
  category: string;
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
