import {
  LayoutDashboard,
  Truck,
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
  type LucideIcon,
} from 'lucide-react';

/**
 * Single source of truth for the dashboard navigation.
 *
 * Every menu and submenu is a real route (absolute `/dashboard/...` path).
 * Consumed by the desktop Sidebar, MobileTabBar and MobileMoreDrawer.
 */

export type NavBadge = 'shipments' | 'notifications' | 'vendorConnections' | 'agentContracts';

export interface NavChild {
  name: string;
  icon: LucideIcon;
  path: string;
  badge?: NavBadge;
  disabled?: boolean;
}

export interface NavItem {
  name: string;
  icon: LucideIcon;
  /** Absolute route. For a parent with children this is its default child route. */
  path: string;
  badge?: NavBadge;
  disabled?: boolean;
  children?: NavChild[];
}

// ─── Top group (scrolls) ──────────────────────────────────────────────────────

export const PRIMARY_NAV: NavItem[] = [
  { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Shipments', path: '/dashboard/shipments', icon: Truck, badge: 'shipments' },
  { name: 'Live Tracking', path: '/dashboard/tracking', icon: Radio },
  { name: 'Media', path: '/dashboard/media', icon: Image },
  { name: 'Transactions', path: '/dashboard/transactions', icon: Receipt },
  {
    name: 'Cash Management',
    path: '/dashboard/cash',
    icon: Banknote,
    children: [
      { name: 'Summary', path: '/dashboard/cash/summary', icon: Gauge },
      { name: 'Deposits', path: '/dashboard/cash/deposits', icon: HandCoins },
      { name: 'Remittances', path: '/dashboard/cash/remittances', icon: Send },
      { name: 'Discrepancies', path: '/dashboard/cash/discrepancies', icon: AlertTriangle },
    ],
  },
  { name: 'Notifications', path: '/dashboard/notifications', icon: Bell, badge: 'notifications' },
  { name: 'Tickets', path: '/dashboard/tickets', icon: Ticket },
  {
    name: 'Agents',
    path: '/dashboard/agents',
    icon: Users,
    badge: 'agentContracts',
    children: [
      { name: 'Connections', path: '/dashboard/agents/connections', icon: Handshake },
      { name: 'Browse', path: '/dashboard/agents/browse', icon: Search },
    ],
  },
  {
    name: 'Vendors',
    path: '/dashboard/vendors',
    icon: Store,
    badge: 'vendorConnections',
    children: [
      { name: 'Connections', path: '/dashboard/vendors/connections', icon: Handshake },
      { name: 'Browse', path: '/dashboard/vendors/browse', icon: Search },
    ],
  },
];

// ─── Bottom group (pinned above Platform Status) ──────────────────────────────

export const FOOTER_NAV: NavItem[] = [
  {
    name: 'Account',
    path: '/dashboard/account',
    icon: UserCog,
    children: [
      { name: 'Profile', path: '/dashboard/account/profile', icon: User },
      { name: 'Store', path: '/dashboard/account/store', icon: Store },
      { name: 'Locations', path: '/dashboard/account/locations', icon: MapPin },
      { name: 'Security', path: '/dashboard/account/security', icon: Shield },
      { name: 'Billing', path: '/dashboard/account/billing', icon: CreditCard },
      { name: 'Payout', path: '/dashboard/account/payout', icon: Wallet },
    ],
  },
  {
    name: 'Settings',
    path: '/dashboard/settings',
    icon: Settings,
    children: [
      { name: 'Policies', path: '/dashboard/settings/policies', icon: ScrollText },
      { name: 'Notifications', path: '/dashboard/settings/notifications', icon: Bell },
      { name: 'Preferences', path: '/dashboard/settings/preferences', icon: SlidersHorizontal },
    ],
  },
];

export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...FOOTER_NAV];
