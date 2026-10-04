import {
  Bell,
  Truck,
  Wallet,
  Handshake,
  UserCheck,
  Banknote,
  CalendarClock,
  HardDrive,
  Boxes,
  Gauge,
  Receipt,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import type { AgencyNotificationAction } from '@/types/notification.types';

export interface NotificationVisual {
  icon: LucideIcon;
  dot: string;
  chip: string;
}

/**
 * The `codLimitUpdates` types (api-doc/agency/notifications.md § 2026-10-02):
 * `shipment.cod_limit.forced`, `shipment.assignment.cod_limit_blocked`,
 * `connection.cod_terms_changed`, `cod.limit.pinned` / `.released`.
 */
function isCodLimitType(type: string): boolean {
  return (
    type.startsWith('shipment.cod_limit.') ||
    type === 'shipment.assignment.cod_limit_blocked' ||
    type === 'connection.cod_terms_changed' ||
    type.startsWith('cod.limit.')
  );
}

/** Map a notification `type` (e.g. "shipment.assigned") to a presentation. */
export function notificationVisual(type: string): NotificationVisual {
  // ACCOUNT CLOSURE (ADR-A10) — an administrator asked to close this agency
  // account. Nothing else in the inbox is about the account's existence, so it
  // gets the destructive red no other stream uses.
  if (type === 'account.closure_requested')
    return { icon: ShieldAlert, dot: 'bg-red-500', chip: 'bg-red-100 text-red-600' };
  // Billing/plan events first — `shipment.cap.exceeded` is a plan alert, not a shipment.
  if (type.startsWith('plan') || type === 'shipment.cap.exceeded')
    return { icon: CalendarClock, dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-600' };
  // COD LIMITS (2026-10-02) — the whole `codLimitUpdates` preference reads as one
  // stream, before the `shipment` / `connection` / `cod` prefixes below would
  // scatter it across three. The gauge icon is the Cash → Summary limit card's.
  // `shipment.cod_limit.forced` replaces `shipment.assigned` and
  // `shipment.assignment.cod_limit_blocked` replaces `.unfilled`, so they must
  // NOT look like routine shipment traffic.
  if (isCodLimitType(type))
    return { icon: Gauge, dot: 'bg-orange-500', chip: 'bg-orange-100 text-orange-600' };
  // DELIVERY-FEE PROPOSALS (2026-10-02) — a price negotiation with the vendor,
  // not a delivery update, so not the shipment truck.
  // `combined_delivery_request.received` (ADR-A11) is the same negotiation, opened
  // by a customer instead — one stream, one look.
  if (type.startsWith('delivery_fee_proposal') || type.startsWith('combined_delivery_request'))
    return { icon: Receipt, dot: 'bg-cyan-500', chip: 'bg-cyan-100 text-cyan-600' };
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
// that means. The vocabulary is a CLOSED SET of ten, written down in
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

/** The ten labels this dashboard understands. Ids are stripped before lookup. */
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
  // `account.closure_requested` (ADR-A10, 2026-10-04) — an administrator asked
  // to close this agency account; the screen is where the owner confirms or
  // declines. Idless: one open request per role. Tried whole before any split,
  // so it never reads as `account` + id `closure`.
  'account/closure': () => '/dashboard/account/closure',
  // `cod.limit.pinned` / `.released` (2026-10-02). There is no /dashboard/cod
  // route — the limit gauge lives on Cash → Summary. Resolves before the
  // `cod/deposits` split because the whole path is tried as an idless label
  // first; without this entry `cod/limit` would split into `cod` + id `limit`
  // and resolve to nothing.
  'cod/limit': () => '/dashboard/cash/summary',
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

/** The screen a customer's combined-price request is answered on. */
export const COMBINED_REQUESTS_ROUTE = '/dashboard/shipments/combined-requests';

/**
 * Notification types whose screen is not the one their button names.
 *
 * `combined_delivery_request.received` carries the shared `shipments/{firstShipmentId}`
 * button — the backend's vocabulary has no label for the request itself — but
 * the request is answered on its own screen, not on one of its parcels. The
 * parcel id rides along as `?shipment=` so that screen can point at the request
 * that contains it. Without the type (a push payload that omits it) the button
 * still opens the parcel, which is a truthful, if indirect, destination.
 */
export function routeForNotificationType(
  type: string | undefined,
  action: AgencyNotificationAction | null,
): string | null {
  if (type !== 'combined_delivery_request.received') return null;
  const shipment = action?.path ? /(?:^|\/)shipments\/([^/?#]+)/.exec(action.path)?.[1] : undefined;
  return shipment ? `${COMBINED_REQUESTS_ROUTE}?shipment=${encodeURIComponent(shipment)}` : COMBINED_REQUESTS_ROUTE;
}

/**
 * Resolve a notification action into an in-app route.
 *
 * Falls back to the inbox, which is always a truthful destination: the
 * notification the user tapped is on it.
 *
 * @param type the notification's `type`, for the few whose screen differs from
 *   their button (see {@link routeForNotificationType}).
 */
export function notificationHref(action: AgencyNotificationAction | null, type?: string): string {
  const byType = routeForNotificationType(type, action);
  if (byType) return byType;
  if (!action?.path) return '/dashboard/notifications';
  return resolveDeepLink(action.path) ?? '/dashboard/notifications';
}
