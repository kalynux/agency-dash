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
  /** `nav:quickActions.*` key, resolved at render (see config/navigation.ts). */
  labelKey: string;
  descriptionKey: string;
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
    labelKey: 'nav:quickActions.newTicket.label',
    descriptionKey: 'nav:quickActions.newTicket.description',
    icon: Ticket,
    route: 'tickets',
    intent: 'create',
  },
  {
    id: 'view-shipments',
    labelKey: 'nav:quickActions.viewShipments.label',
    descriptionKey: 'nav:quickActions.viewShipments.description',
    icon: Truck,
    route: 'shipments',
  },
  {
    id: 'view-earnings',
    labelKey: 'nav:quickActions.viewEarnings.label',
    descriptionKey: 'nav:quickActions.viewEarnings.description',
    icon: Wallet,
    route: 'account/payout',
  },
  {
    id: 'view-cash',
    labelKey: 'nav:quickActions.viewCash.label',
    descriptionKey: 'nav:quickActions.viewCash.description',
    icon: Banknote,
    route: 'cash/summary',
  },
  {
    id: 'update-coverage',
    labelKey: 'nav:quickActions.updateCoverage.label',
    descriptionKey: 'nav:quickActions.updateCoverage.description',
    icon: MapPin,
    route: 'account/locations',
  },
];
