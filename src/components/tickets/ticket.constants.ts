import type { TicketStatus, TicketPriority, TicketType } from '@/types';

export const TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'waiting_on_admin', 'waiting_on_agency', 'resolved', 'closed'];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_admin: 'Waiting on Support',
  waiting_on_agency: 'Waiting on You',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const STATUS_BADGE_CLASSES: Record<TicketStatus, string> = {
  open: 'border-blue-500 text-blue-600 bg-blue-50',
  in_progress: 'border-purple-500 text-purple-600 bg-purple-50',
  waiting_on_admin: 'border-amber-500 text-amber-600 bg-amber-50',
  waiting_on_agency: 'border-orange-500 text-orange-600 bg-orange-50',
  resolved: 'border-green-500 text-green-600 bg-green-50',
  closed: 'border-gray-500 text-gray-600 bg-gray-50',
};

export const STATUS_DOT_CLASSES: Record<TicketStatus, string> = {
  open: 'bg-blue-500',
  in_progress: 'bg-purple-500',
  waiting_on_admin: 'bg-amber-500',
  waiting_on_agency: 'bg-orange-500',
  resolved: 'bg-green-500',
  closed: 'bg-gray-500',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const PRIORITY_BADGE_CLASSES: Record<TicketPriority, string> = {
  low: 'border-slate-400 text-slate-600 bg-slate-50',
  medium: 'border-blue-500 text-blue-600 bg-blue-50',
  high: 'border-orange-500 text-orange-600 bg-orange-50',
  urgent: 'border-red-500 text-red-600 bg-red-50',
};

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  GENERAL_SUPPORT: 'General Support',
  ACCOUNT_ACCESS: 'Account Access',
  PROFILE_UPDATE: 'Profile Update',
  PAYOUT_REQUEST: 'Payout Request',
  PAYOUT_DELAY: 'Payout Delay',
  PAYOUT_DISPUTE: 'Payout Dispute',
  DELIVERY_DELAY: 'Delivery Delay',
  DELIVERY_CONFIRMATION: 'Delivery Confirmation',
  POLICY_QUESTION: 'Policy Question',
  TECHNICAL_ISSUE: 'Technical Issue',
  OTHER: 'Other',
};

export const TICKET_TYPES: TicketType[] = Object.keys(TICKET_TYPE_LABELS) as TicketType[];
