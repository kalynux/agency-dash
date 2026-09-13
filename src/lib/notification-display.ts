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

// ─── Notification deep links ──────────────────────────────────────────────────
//
// The backend does not know this app's routes and will never try to. It sends a
// short LABEL — `shipments/665f…`, `plans` — and we decide which of our screens
// that means. The vocabulary is a CLOSED SET of eight, written down in
// api-doc/notifications/deep-links.md § Agency, and pinned on the backend by
// `npm run test:notification-deeplinks`.
//
// The rules that hold for every value, which is what makes the switch below
// enough and a parser unnecessary:
//   1. No leading or trailing slash.
//   2. No route prefix and no locale — `/dashboard` is ours to add.
//   3. At most one id, always last.
//   4. The set is closed, and changing it is a backend PR that lands with a doc
//      row and a test literal.
//   5. An absent action is a real state: render no button, invent no
//      destination.
//
// ⚠ An UNKNOWN label is "no button", never an error. That is what lets the
// backend add one before we ship a case for it — the worst outcome is a
// notification that does not navigate, in an app that has not been rebuilt yet.

/** The eight labels this dashboard understands. Ids are stripped before lookup. */
const DEEP_LINK_ROUTES: Record<string, (id: string | null) => string> = {
  // The record screens. Each opens its sheet through the `?open=` convention
  // the stock-request inbox established.
  shipments: (id) => (id ? `/dashboard/shipments?open=${id}` : '/dashboard/shipments'),
  tickets: (id) => (id ? `/dashboard/tickets?open=${id}` : '/dashboard/tickets'),
  'vendor-connections': (id) =>
    id ? `/dashboard/vendors/connections?open=${id}` : '/dashboard/vendors/connections',
  'cod/deposits': (id) => (id ? `/dashboard/cash/deposits?open=${id}` : '/dashboard/cash/deposits'),
  'stock-requests': (id) =>
    id ? `/dashboard/inventory/requests?open=${id}` : '/dashboard/inventory/requests',
  // ⚠ The id here is a CONTRACT, not an agent. `Agents.tsx` sniffs one in the
  // tab slot on purpose, so this lands on `agents/:tab`. Keep that in mind
  // before ever adding an `agents/:agentId` route — it would capture this.
  agents: (id) => (id ? `/dashboard/agents/${id}` : '/dashboard/agents/connections'),
  // Idless labels.
  plans: () => '/dashboard/account/billing',
  'settings/storage': () => '/dashboard/media',
};

/**
 * Translate a backend deep-link label into an in-app route.
 *
 * Returns `null` for anything outside the vocabulary — including an empty path
 * — so callers can honour rule 5 rather than navigating somewhere invented.
 *
 * Tolerates a leading `/dashboard/` so the same function serves both a
 * notification action (`shipments/665f…`) and a URL a user pasted or an emailed
 * button opened (`/dashboard/shipments/665f…`, or `/shipments/665f…`).
 *
 * ⚠ **The id is found by position, not by shape.** Rule 3 says at most one id
 * and always last, so trying the whole path as an idless label and *then*
 * splitting at the final `/` is exactly the documented rule. Matching an
 * ObjectId pattern instead would be a second, undocumented assumption — and it
 * silently drops the button the day an id is not 24 hex characters. Trying the
 * whole path FIRST is also what keeps `settings/storage` a label rather than
 * `settings` carrying an id of `storage`.
 */
export function resolveDeepLink(path: string): string | null {
  const clean = path
    .replace(/[?#].*$/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/^dashboard(\/|$)/, '');
  if (!clean) return null;

  const idless = DEEP_LINK_ROUTES[clean];
  if (idless) return idless(null);

  const cut = clean.lastIndexOf('/');
  if (cut > 0) {
    const withId = DEEP_LINK_ROUTES[clean.slice(0, cut)];
    if (withId) return withId(clean.slice(cut + 1));
  }

  return null;
}

/**
 * Resolve a notification action into an in-app route.
 *
 * Falls back to the inbox, which is always a truthful destination: the
 * notification the user tapped is on it.
 */
export function notificationHref(action: AgencyNotificationAction | null): string {
  if (!action?.path) return '/dashboard/notifications';
  return resolveDeepLink(action.path) ?? '/dashboard/notifications';
}
