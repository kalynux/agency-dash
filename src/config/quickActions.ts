import {
  Ticket,
  Truck,
  Receipt,
  BarChart3,
  MapPin,
  type LucideIcon,
} from 'lucide-react';

export type QuickActionRoute = 'tickets' | 'shipments' | 'transactions' | 'analytics' | 'account/business';

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
    id: 'view-transactions',
    label: 'View Transactions',
    description: 'Check payouts & earnings',
    icon: Receipt,
    route: 'transactions',
  },
  {
    id: 'view-analytics',
    label: 'View Analytics',
    description: 'Delivery performance & earnings',
    icon: BarChart3,
    route: 'analytics',
  },
  {
    id: 'update-coverage',
    label: 'Update Coverage Areas',
    description: 'Edit the regions you deliver to',
    icon: MapPin,
    route: 'account/business',
  },
];
