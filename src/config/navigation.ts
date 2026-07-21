import {
  LayoutDashboard,
  Truck,
  Bell,
  Ticket,
  Users,
  Mail,
  Banknote,
  UserCog,
  User,
  MapPin,
  Image as ImageIcon,
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
  type LucideIcon,
} from 'lucide-react';

/**
 * Single source of truth for the dashboard navigation.
 *
 * Every menu and submenu is a real route (absolute `/dashboard/...` path).
 * Consumed by the desktop Sidebar, MobileTabBar and MobileMoreDrawer.
 */

export type NavBadge = 'shipments' | 'notifications' | 'vendorConnections';

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
  { name: 'Earnings', path: '/dashboard/earnings', icon: Wallet },
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
    children: [
      { name: 'Roster', path: '/dashboard/agents/roster', icon: Users },
      { name: 'Invites', path: '/dashboard/agents/invites', icon: Mail },
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
      { name: 'Business', path: '/dashboard/account/business', icon: MapPin },
      { name: 'Branding', path: '/dashboard/account/branding', icon: ImageIcon },
      { name: 'Security', path: '/dashboard/account/security', icon: Shield },
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
