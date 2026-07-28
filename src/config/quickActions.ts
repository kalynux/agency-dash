import {
  Ticket,
  Truck,
  Wallet,
  Banknote,
  MapPin,
  type LucideIcon,
} from 'lucide-react';

export type QuickActionRoute = 'tickets' | 'shipments' | 'account/payout' | 'cash/summary' | 'account/locations';

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Route (relative to /dashboard) to navigate to. */
  route: QuickActionRoute;
  /**
   * Optional creation intent passed as router state so the destination page can
   * open its existing "create" sheet (e.g. Tickets → CreateTicketSheet).
   */
  intent?: 'create';
}

/**
 * Single source of truth for the "create new" quick actions shown under the
 * "+" control on both desktop (Header) and mobile (MobileTabBar FAB).
 */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'new-ticket',
    label: 'New Ticket',
    description: 'Get help from the team',
    icon: Ticket,
    route: 'tickets',
    intent: 'create',
  },
  {
    id: 'view-shipments',
    label: 'View Shipments',
    description: 'Track and manage shipments',
    icon: Truck,
    route: 'shipments',
  },
  {
    id: 'view-earnings',
    label: 'View Earnings',
    description: 'Balance & payout requests',
    icon: Wallet,
    route: 'account/payout',
  },
  {
    id: 'view-cash',
    label: 'Cash Management',
    description: 'COD deposits & remittances',
    icon: Banknote,
    route: 'cash/summary',
  },
  {
    id: 'update-coverage',
    label: 'Update Coverage Areas',
    description: 'Edit the regions you deliver to',
    icon: MapPin,
    route: 'account/locations',
  },
];
