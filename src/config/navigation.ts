import {
  LayoutDashboard,
  Truck,
  Boxes,
  Bell,
  Ticket,
  Users,
  Banknote,
  UserCog,
  User,
  MapPin,
  Shield,
  Wallet,
  Settings,
  ScrollText,
  SlidersHorizontal,
  Store,
  Handshake,
  Search,
  Radio,
  Gauge,
  HandCoins,
  Send,
  AlertTriangle,
  CreditCard,
  Receipt,
  Image,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';

/**
 * Single source of truth for the dashboard navigation.
 *
 * Every menu and submenu is a real route (absolute `/dashboard/...` path).
 * Consumed by the desktop Sidebar, MobileTabBar and MobileMoreDrawer.
 *
 * Labels are translation keys, not copy — this table is module-scope data
 * evaluated once at import, so it cannot hold a translated string (it would
 * freeze in whatever language was active at boot). Consumers resolve it at
 * render with `tx(t, item.labelKey)`.
 */

export type NavBadge =
  | 'shipments'
  | 'notifications'
  | 'vendorConnections'
  | 'agentContracts'
  | 'stockRequests';

export interface NavChild {
  /** `nav:` namespace key, resolved at render. */
  labelKey: string;
  icon: LucideIcon;
  path: string;
  badge?: NavBadge;
  disabled?: boolean;
}

export interface NavItem {
  /** `nav:` namespace key, resolved at render. */
  labelKey: string;
  icon: LucideIcon;
  /** Absolute route. For a parent with children this is its default child route. */
  path: string;
  badge?: NavBadge;
  disabled?: boolean;
  children?: NavChild[];
}

// ─── Top group (scrolls) ──────────────────────────────────────────────────────

export const PRIMARY_NAV: NavItem[] = [
  { labelKey: 'nav:primary.overview', path: '/dashboard', icon: LayoutDashboard },
  { labelKey: 'nav:primary.shipments', path: '/dashboard/shipments', icon: Truck, badge: 'shipments' },
  { labelKey: 'nav:primary.tracking', path: '/dashboard/tracking', icon: Radio },
  // Sits next to the shipment surfaces on purpose: storage-based stock is what
  // those shipments are picked from. The requests child is the agency half of the
  // two-signature stock flow — a SKU's quantity cannot move without an answer
  // there, so it badges.
  {
    labelKey: 'nav:primary.inventory',
    path: '/dashboard/inventory',
    icon: Boxes,
    badge: 'stockRequests',
    children: [
      { labelKey: 'nav:primary.inventoryStock', path: '/dashboard/inventory/stock', icon: Boxes },
      {
        labelKey: 'nav:primary.inventoryRequests',
        path: '/dashboard/inventory/requests',
        icon: ClipboardList,
        badge: 'stockRequests',
      },
    ],
  },
  { labelKey: 'nav:primary.media', path: '/dashboard/media', icon: Image },
  { labelKey: 'nav:primary.transactions', path: '/dashboard/transactions', icon: Receipt },
  {
    labelKey: 'nav:primary.cash',
    path: '/dashboard/cash',
    icon: Banknote,
    children: [
      { labelKey: 'nav:primary.cashSummary', path: '/dashboard/cash/summary', icon: Gauge },
      { labelKey: 'nav:primary.cashDeposits', path: '/dashboard/cash/deposits', icon: HandCoins },
      { labelKey: 'nav:primary.cashRemittances', path: '/dashboard/cash/remittances', icon: Send },
      { labelKey: 'nav:primary.cashDiscrepancies', path: '/dashboard/cash/discrepancies', icon: AlertTriangle },
    ],
  },
  { labelKey: 'nav:primary.notifications', path: '/dashboard/notifications', icon: Bell, badge: 'notifications' },
  { labelKey: 'nav:primary.tickets', path: '/dashboard/tickets', icon: Ticket },
  {
    labelKey: 'nav:primary.agents',
    path: '/dashboard/agents',
    icon: Users,
    badge: 'agentContracts',
    children: [
      { labelKey: 'nav:primary.agentsConnections', path: '/dashboard/agents/connections', icon: Handshake },
      { labelKey: 'nav:primary.agentsBrowse', path: '/dashboard/agents/browse', icon: Search },
    ],
  },
  {
    labelKey: 'nav:primary.vendors',
    path: '/dashboard/vendors',
    icon: Store,
    badge: 'vendorConnections',
    children: [
      { labelKey: 'nav:primary.vendorsConnections', path: '/dashboard/vendors/connections', icon: Handshake },
      { labelKey: 'nav:primary.vendorsBrowse', path: '/dashboard/vendors/browse', icon: Search },
    ],
  },
];

// ─── Bottom group (pinned above Platform Status) ──────────────────────────────

export const FOOTER_NAV: NavItem[] = [
  {
    labelKey: 'nav:footer.account',
    path: '/dashboard/account',
    icon: UserCog,
    children: [
      { labelKey: 'nav:footer.accountProfile', path: '/dashboard/account/profile', icon: User },
      { labelKey: 'nav:footer.accountStore', path: '/dashboard/account/store', icon: Store },
      { labelKey: 'nav:footer.accountLocations', path: '/dashboard/account/locations', icon: MapPin },
      { labelKey: 'nav:footer.accountSecurity', path: '/dashboard/account/security', icon: Shield },
      { labelKey: 'nav:footer.accountBilling', path: '/dashboard/account/billing', icon: CreditCard },
      { labelKey: 'nav:footer.accountPayout', path: '/dashboard/account/payout', icon: Wallet },
    ],
  },
  {
    labelKey: 'nav:footer.settings',
    path: '/dashboard/settings',
    icon: Settings,
    children: [
      { labelKey: 'nav:footer.settingsPolicies', path: '/dashboard/settings/policies', icon: ScrollText },
      { labelKey: 'nav:footer.settingsNotifications', path: '/dashboard/settings/notifications', icon: Bell },
      { labelKey: 'nav:footer.settingsPreferences', path: '/dashboard/settings/preferences', icon: SlidersHorizontal },
    ],
  },
];

export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...FOOTER_NAV];

// ─── Route → menu lookup ──────────────────────────────────────────────────────

export interface NavTrail {
  parent: NavItem;
  /** Absent when the route is a top-level menu with no submenu of its own. */
  child?: NavChild;
}

/**
 * The menu (and submenu) a route belongs to — what a page header renders as its
 * breadcrumb, so the crumb always reads exactly like the sidebar entry the user
 * clicked.
 *
 * Longest match wins, so `/dashboard/account/profile` resolves to the Profile
 * child rather than to its Account parent. Only an entry that *has* children
 * matches by prefix; otherwise Overview (`/dashboard`) would swallow every route
 * in the app. A deep link below a leaf (`…/agents/connections/{id}`) still
 * resolves, because the leaf it hangs off is a child of one that has children.
 */
export function findNavTrail(pathname: string): NavTrail | null {
  const path = pathname.replace(/\/+$/, '') || '/dashboard';

  let best: NavTrail | null = null;
  let bestLength = -1;
  const consider = (candidate: string, byPrefix: boolean, trail: NavTrail) => {
    const hit = path === candidate || (byPrefix && path.startsWith(`${candidate}/`));
    if (hit && candidate.length > bestLength) {
      bestLength = candidate.length;
      best = trail;
    }
  };

  for (const parent of ALL_NAV) {
    const children = parent.children ?? [];
    for (const child of children) consider(child.path, true, { parent, child });
    consider(parent.path, children.length > 0, { parent });
  }
  return best;
}
