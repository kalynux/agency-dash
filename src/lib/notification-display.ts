import { Bell, Truck, Wallet, Handshake, UserCheck, Banknote, CalendarClock, HardDrive, Boxes, type LucideIcon } from 'lucide-react';
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
  // WAREHOUSING, before the media-quota branch below — `storage.*` covers both
  // families and the two mean entirely different things. A stock request is a
  // decision to make, not a quota alarm, so it takes the Inventory nav's own icon
  // (which is where it deep-links) rather than the amber warning language shared
  // by `plan` and `cod`.
  if (type.startsWith('storage.stock_request') || type === 'storage.depot_changed')
    return { icon: Boxes, dot: 'bg-violet-500', chip: 'bg-violet-100 text-violet-600' };
  // Media storage crossed an 80/90/100% band (see api-doc/agency/storage.md §4).
  if (type.startsWith('storage'))
    return { icon: HardDrive, dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-600' };
  if (type.startsWith('shipment')) return { icon: Truck, dot: 'bg-blue-500', chip: 'bg-blue-100 text-blue-600' };
  // `agent_contract.*` before `connection`: both are handshakes, but one is with
  // a courier and the other with a vendor, and they read as separate streams.
  if (type.startsWith('agent_contract'))
    return { icon: UserCheck, dot: 'bg-teal-500', chip: 'bg-teal-100 text-teal-600' };
  if (type.startsWith('connection')) return { icon: Handshake, dot: 'bg-indigo-500', chip: 'bg-indigo-100 text-indigo-600' };
  if (type.startsWith('payout')) return { icon: Wallet, dot: 'bg-green-500', chip: 'bg-green-100 text-green-600' };
  if (type.startsWith('cod')) return { icon: Banknote, dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-600' };
  return { icon: Bell, dot: 'bg-gray-500', chip: 'bg-gray-100 text-gray-600' };
}

/**
 * Resolve an app-relative notification path into an in-app route.
 *
 * The backend mints these relative to the dashboard — "shipments/{id}",
 * "vendor-connections/{id}", "tickets/{id}" — so they all map under /dashboard.
 *
 * Split out of {@link notificationHref} for the deep-link handler (P4.2), which
 * receives the same paths from an FCM data payload rather than from a
 * notification object.
 */
export function dashboardRoute(path: string): string {
  return `/dashboard/${path.replace(/^\/+/, '')}`;
}

/** Resolve a notification action into an in-app route. */
export function notificationHref(action: AgencyNotificationAction | null): string {
  if (!action?.path) return '/dashboard/notifications';
  return dashboardRoute(action.path);
}
