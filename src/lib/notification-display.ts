import { Bell, Truck, Wallet, Handshake, Banknote, CalendarClock, type LucideIcon } from 'lucide-react';
import type { AgencyNotificationAction } from '@/types/notification.types';

export interface NotificationVisual {
  icon: LucideIcon;
  dot: string;
  chip: string;
}

/** Map a notification `type` (e.g. "shipment.assigned") to a presentation. */
export function notificationVisual(type: string): NotificationVisual {
  // Billing/plan events first — `shipment.cap.exceeded` is a plan alert, not a shipment.
  if (type.startsWith('plan') || type === 'shipment.cap.exceeded')
    return { icon: CalendarClock, dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-600' };
  if (type.startsWith('shipment')) return { icon: Truck, dot: 'bg-blue-500', chip: 'bg-blue-100 text-blue-600' };
  if (type.startsWith('connection')) return { icon: Handshake, dot: 'bg-indigo-500', chip: 'bg-indigo-100 text-indigo-600' };
  if (type.startsWith('payout')) return { icon: Wallet, dot: 'bg-green-500', chip: 'bg-green-100 text-green-600' };
  if (type.startsWith('cod')) return { icon: Banknote, dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-600' };
  return { icon: Bell, dot: 'bg-gray-500', chip: 'bg-gray-100 text-gray-600' };
}

/**
 * Resolve a notification action into an in-app route. `action.path` is
 * app-relative (e.g. "shipments/{id}", "vendor-connections/{id}",
 * "tickets/{id}"), so it maps under /dashboard.
 */
export function notificationHref(action: AgencyNotificationAction | null): string {
  if (!action?.path) return '/dashboard/notifications';
  return `/dashboard/${action.path.replace(/^\/+/, '')}`;
}
