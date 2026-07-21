// ─── Agency Tickets — display constants ───────────────────────────────────────
// Label + colour maps, the grouped ticket-type list, and small display helpers.
// Enums/limits follow api-doc/agency/tickets.md (authoritative). Priority has no
// "medium" (that's importance); note content caps at 300 and create description
// at 700, matching the agency endpoints.

import type { LucideIcon } from 'lucide-react';
import {
  ShoppingCart, CreditCard, Wallet, Package, Calendar, Truck, Wrench, Bug,
  ShieldCheck, Scale, HelpCircle, LifeBuoy, User, Building2,
} from 'lucide-react';
import { formatFileSize } from '@/lib/utils';
import type {
  TicketStatus,
  TicketPriority,
  TicketImportance,
  TicketType,
  TicketRole,
  TicketEntityType,
} from '@/types/ticket.types';

export { formatFileSize };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Turn an UPPER_SNAKE enum value into a human "Title Case" label. */
export function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Format any ticket type enum into a human label, e.g. DELIVERY_DELAY → "Delivery delay". */
export function formatTicketType(type: string): string {
  const words = type.split('_').map((w) => w.toLowerCase());
  if (words.length === 0) return type;
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

// ─── Status ───────────────────────────────────────────────────────────────────

export const TICKET_STATUSES: TicketStatus[] = [
  'open',
  'in_progress',
  'waiting_on_admin',
  'waiting_on_vendor',
  'waiting_on_customer',
  'waiting_on_agency',
  'waiting_on_agent',
  'resolved',
  'closed',
];

/** Statuses an agency can meaningfully set from the detail control. */
export const AGENCY_SETTABLE_STATUSES: TicketStatus[] = [
  'open',
  'in_progress',
  'waiting_on_admin',
  'resolved',
];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_admin: 'Waiting on Support',
  waiting_on_vendor: 'Waiting on Vendor',
  waiting_on_customer: 'Waiting on Customer',
  waiting_on_agency: 'Waiting on You',
  waiting_on_agent: 'Waiting on Agent',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const STATUS_BADGE_CLASSES: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  waiting_on_admin: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  waiting_on_vendor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  waiting_on_customer: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  waiting_on_agency: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  waiting_on_agent: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-muted text-muted-foreground',
};

/** Dot colour used next to a status label in pills. */
export const STATUS_DOT_CLASSES: Record<TicketStatus, string> = {
  open: 'bg-blue-500',
  in_progress: 'bg-purple-500',
  waiting_on_admin: 'bg-orange-500',
  waiting_on_vendor: 'bg-amber-500',
  waiting_on_customer: 'bg-amber-500',
  waiting_on_agency: 'bg-teal-500',
  waiting_on_agent: 'bg-cyan-500',
  resolved: 'bg-green-500',
  closed: 'bg-muted-foreground/50',
};

/** The participant role a `waiting_on_<role>` status targets (admin is always allowed). */
export const WAITING_STATUS_ROLE: Partial<Record<TicketStatus, TicketRole>> = {
  waiting_on_admin: 'admin',
  waiting_on_vendor: 'vendor',
  waiting_on_customer: 'customer',
  waiting_on_agency: 'agency',
  waiting_on_agent: 'agent',
};

/**
 * Status filter tabs for the list view. From the agency's seat, "Waiting on you"
 * maps to `waiting_on_agency` and "Waiting on support" to `waiting_on_admin`.
 * `null` = All.
 */
export const STATUS_TABS: { label: string; value: TicketStatus | null }[] = [
  { label: 'All', value: null },
  { label: 'Open', value: 'open' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Waiting on you', value: 'waiting_on_agency' },
  { label: 'Waiting on support', value: 'waiting_on_admin' },
  { label: 'Waiting on customer', value: 'waiting_on_customer' },
  { label: 'Waiting on vendor', value: 'waiting_on_vendor' },
  { label: 'Waiting on agent', value: 'waiting_on_agent' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

// ─── Priority ─────────────────────────────────────────────────────────────────

/** Priorities an agency may set (api-doc/agency/tickets.md PATCH /priority). */
export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const PRIORITY_BADGE_CLASSES: Record<TicketPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

/** Dot colour used next to a priority label in pills. */
export const PRIORITY_DOT_CLASSES: Record<TicketPriority, string> = {
  low: 'bg-muted-foreground/50',
  normal: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

// ─── Importance (create-time) ─────────────────────────────────────────────────

export const IMPORTANCE_OPTIONS: TicketImportance[] = ['low', 'medium', 'high', 'critical'];

export const IMPORTANCE_LABELS: Record<TicketImportance, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const IMPORTANCE_BADGE_CLASSES: Record<TicketImportance, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ─── Entity types (create-time "Related to") ──────────────────────────────────
// The full enum is accepted, but these are the choices that make sense for a
// delivery agency filing its own tickets (api-doc/agency/tickets.md §Entity
// References). ORDER/PRODUCT are validated + policy-enforced server-side;
// SHIPMENT/DELIVERY/AGENCY store the id as-is.

export const AGENCY_ENTITY_TYPES: TicketEntityType[] = [
  'OTHER', 'SHIPMENT', 'DELIVERY', 'ORDER', 'PRODUCT', 'AGENCY',
];

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  OTHER: 'General (no specific item)',
  SHIPMENT: 'A shipment',
  DELIVERY: 'A delivery',
  ORDER: 'An order',
  PRODUCT: 'A product',
  AGENCY: 'My agency',
  BOOKING: 'A booking',
  USER: 'A user',
  VENDOR: 'A vendor',
  CUSTOMER: 'A customer',
  AGENT: 'An agent',
};

/** Entity types that are picked from a searchable reference list rather than typed. */
export const SEARCHABLE_ENTITY_TYPES: TicketEntityType[] = ['ORDER', 'PRODUCT', 'SHIPMENT', 'DELIVERY'];

// ─── Ticket types (grouped) ────────────────────────────────────────────────────

export interface TicketTypeGroup {
  groupLabel: string;
  values: { value: TicketType; label: string }[];
}

function group(groupLabel: string, values: TicketType[]): TicketTypeGroup {
  return { groupLabel, values: values.map((value) => ({ value, label: humanizeEnum(value) })) };
}

/**
 * Delivery-relevant groups are ordered first, since Shipping/Delivery, Payouts
 * and General Support are the most common for an agency — but every type is
 * offered (api-doc/agency/tickets.md §Ticket Types).
 */
export const TICKET_TYPE_GROUPS: TicketTypeGroup[] = [
  group('Shipping & Delivery', [
    'SHIPPING_ISSUE', 'DELIVERY_DELAY', 'DELIVERY_CONFIRMATION', 'ADDRESS_CHANGE',
  ]),
  group('Payouts', [
    'PAYOUT_REQUEST', 'PAYOUT_DELAY', 'PAYOUT_DISPUTE', 'COMMISSION_QUESTION',
  ]),
  group('General & Account', [
    'GENERAL_SUPPORT', 'ACCOUNT_ACCESS', 'ACCOUNT_VERIFICATION', 'PROFILE_UPDATE', 'SECURITY_ISSUE',
  ]),
  group('Orders', [
    'ORDER_ISSUE', 'ORDER_CANCELLATION', 'ORDER_REFUND', 'ORDER_DISPUTE', 'ORDER_FULFILLMENT',
  ]),
  group('Payments', [
    'PAYMENT_ISSUE', 'PAYMENT_FAILED', 'PAYMENT_CONFIRMATION', 'CHARGEBACK', 'INVOICE_REQUEST',
  ]),
  group('Products', [
    'PRODUCT_ISSUE', 'INVENTORY_PROBLEM', 'PRICING_ISSUE', 'VARIANT_ISSUE',
  ]),
  group('Bookings', [
    'BOOKING_ISSUE', 'BOOKING_CANCELLATION', 'BOOKING_RESCHEDULE', 'AVAILABILITY_PROBLEM',
  ]),
  group('Technical', [
    'TECHNICAL_ISSUE', 'BUG_REPORT', 'INTEGRATION_ISSUE', 'API_ACCESS',
  ]),
  group('Policy & Legal', [
    'POLICY_QUESTION', 'COMPLIANCE', 'LEGAL_REQUEST',
  ]),
  group('Other', ['OTHER']),
];

/** Flat label lookup for any ticket type value. */
export const TICKET_TYPE_LABELS: Record<string, string> = TICKET_TYPE_GROUPS.reduce(
  (acc, g) => {
    g.values.forEach(({ value, label }) => {
      acc[value] = label;
    });
    return acc;
  },
  {} as Record<string, string>,
);

// ─── Limits (api-doc/agency/tickets.md) ────────────────────────────────────────

export const SUBJECT_MAX_LENGTH = 200;
/** Create endpoint caps description at 700 chars. */
export const DESCRIPTION_MAX_LENGTH = 700;
/** Note content caps at 300 chars. */
export const NOTE_MAX_LENGTH = 300;
export const TRACKING_NUMBER_MAX = 120;
export const MAX_ATTACHMENTS = 5;

/**
 * Responsive props for a ticket Sheet: a bottom sheet on mobile, a right-side
 * panel on desktop. `desktopWidth` tunes the panel width on desktop.
 */
export function responsiveSheetProps(
  isMobile: boolean,
  desktopWidth = 'sm:max-w-xl',
): { side: 'bottom' | 'right'; className: string } {
  return isMobile
    ? { side: 'bottom', className: 'h-[92vh] rounded-t-2xl' }
    : { side: 'right', className: `w-full ${desktopWidth}` };
}

// ─── Type icon / colour ───────────────────────────────────────────────────────
// Each ticket type maps to a lucide icon + tint, grouped by domain. Used for the
// list-row leading icon and the detail "Type" row.

interface TypeVisual {
  Icon: LucideIcon;
  className: string; // text + bg tint for the icon chip
}

const TYPE_VISUAL_BY_PREFIX: { test: (t: string) => boolean; visual: TypeVisual }[] = [
  { test: (t) => t.startsWith('SHIPPING') || t.startsWith('DELIVERY') || t === 'ADDRESS_CHANGE', visual: { Icon: Truck, className: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400' } },
  { test: (t) => t.startsWith('PAYOUT') || t === 'COMMISSION_QUESTION', visual: { Icon: Wallet, className: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' } },
  { test: (t) => t.startsWith('ORDER'), visual: { Icon: ShoppingCart, className: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' } },
  { test: (t) => t.startsWith('PAYMENT') || t === 'CHARGEBACK' || t === 'INVOICE_REQUEST', visual: { Icon: CreditCard, className: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' } },
  { test: (t) => t.startsWith('PRODUCT') || t === 'INVENTORY_PROBLEM' || t === 'PRICING_ISSUE' || t === 'VARIANT_ISSUE', visual: { Icon: Package, className: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' } },
  { test: (t) => t.startsWith('BOOKING') || t === 'AVAILABILITY_PROBLEM', visual: { Icon: Calendar, className: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400' } },
  { test: (t) => t === 'BUG_REPORT', visual: { Icon: Bug, className: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' } },
  { test: (t) => t.startsWith('TECHNICAL') || t === 'INTEGRATION_ISSUE' || t === 'API_ACCESS', visual: { Icon: Wrench, className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' } },
  { test: (t) => t.startsWith('ACCOUNT') || t === 'PROFILE_UPDATE' || t === 'SECURITY_ISSUE', visual: { Icon: ShieldCheck, className: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' } },
  { test: (t) => t === 'POLICY_QUESTION' || t === 'COMPLIANCE' || t === 'LEGAL_REQUEST', visual: { Icon: Scale, className: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' } },
  { test: (t) => t === 'GENERAL_SUPPORT', visual: { Icon: LifeBuoy, className: 'bg-muted text-muted-foreground' } },
];

const DEFAULT_TYPE_VISUAL: TypeVisual = { Icon: HelpCircle, className: 'bg-muted text-muted-foreground' };

export function getTypeVisual(type: string): TypeVisual {
  return TYPE_VISUAL_BY_PREFIX.find((m) => m.test(type))?.visual ?? DEFAULT_TYPE_VISUAL;
}

/** Leading icon for the entity chip, keyed by entity type. */
export const ENTITY_ICONS: Record<string, LucideIcon> = {
  ORDER: ShoppingCart,
  PRODUCT: Package,
  BOOKING: Calendar,
  SHIPMENT: Truck,
  DELIVERY: Truck,
  AGENCY: Building2,
  USER: User,
  CUSTOMER: User,
};

// ─── Actor helpers ────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Support',
  agent: 'Delivery Agent',
  vendor: 'Vendor',
  customer: 'Customer',
  agency: 'Agency',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? humanizeEnum(role);
}

/** Avatar fallback tint per role. */
export const ROLE_AVATAR_CLASSES: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  agent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  vendor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  customer: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  agency: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
};

export function roleAvatarClass(role: string): string {
  return ROLE_AVATAR_CLASSES[role] ?? 'bg-muted text-muted-foreground';
}

/** Up to two initials from a display name. */
export function actorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Misc display helpers ─────────────────────────────────────────────────────

/** Short, friendly ticket reference, e.g. `tkt_7f3a91`. */
export function shortTicketRef(id: string): string {
  return `tkt_${id.slice(-6)}`;
}

/** Compact relative time, e.g. "just now", "5m ago", "3d ago", or a date. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Longer date, e.g. "Jul 5, 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
