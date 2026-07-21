import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUI } from '@/App';
import { useNotifications } from '@/store/notifications.store';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useVendorConnections } from '@/store/vendorConnections.store';
import { useShipments } from '@/store/shipments.store';
import {
  ChevronLeft,
  ChevronRight,
  Truck,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlatformStatus } from '@/components/layout/PlatformStatus';
import { PRIMARY_NAV, FOOTER_NAV, type NavItem, type NavChild, type NavBadge } from '@/config/navigation';
import { cn } from '@/lib/utils';

/** Left accent bar marking the active row (solid) or a parent-of-active (faded). */
function ActiveBar({ show, faded }: { show: boolean; faded?: boolean }) {
  if (!show) return null;
  return (
    <span
      className={cn(
        'absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full',
        faded ? 'bg-primary/40' : 'bg-primary',
      )}
    />
  );
}

function isPathActive(itemPath: string, pathname: string): boolean {
  if (itemPath === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/';
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

const rowBase =
  'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground';

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUI();
  const { unreadCount } = useNotifications();
  const { activeCount: shipmentsActiveCount } = useShipments();
  const { pendingActionCount } = useVendorConnections();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const roleEntity = useOnboarding().session?.role_entity;

  const agencyName = roleEntity?.agency_name || 'My Agency';
  const agencyLogo = roleEntity?.logo_url || null;

  // Per-item manual expand overrides; otherwise a group auto-opens when a child
  // is active. Works for any item with children.
  const [manualExpanded, setManualExpanded] = useState<Record<string, boolean>>({});

  const getBadgeCount = (badge?: NavBadge) => {
    if (badge === 'notifications') return unreadCount;
    if (badge === 'shipments') return shipmentsActiveCount;
    if (badge === 'vendorConnections') return pendingActionCount;
    return 0;
  };

  const isChildActive = (child: NavChild) => isPathActive(child.path, pathname);
  const isLeafActive = (child: NavChild, parent: NavItem) =>
    child.path === parent.path ? pathname === child.path : isChildActive(child);

  const hasActiveChild = (item: NavItem) =>
    item.children?.some((c) => isLeafActive(c, item)) ?? false;
  const isExpanded = (item: NavItem) =>
    manualExpanded[item.name] ?? hasActiveChild(item);
  const toggleExpanded = (item: NavItem) =>
    setManualExpanded((m) => ({ ...m, [item.name]: !(m[item.name] ?? hasActiveChild(item)) }));

  const selectChild = (child: NavChild) => {
    if (child.disabled) return;
    navigate(child.path);
  };

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const badgeCount = getBadgeCount(item.badge);
    const hasChildren = !!item.children?.length;
    const parentActive = isPathActive(item.path, pathname);
    const childActive = hasChildren && hasActiveChild(item);
    const open = hasChildren && isExpanded(item) && !sidebarCollapsed;

    const onClick = () => {
      if (item.disabled) return;
      if (hasChildren && !sidebarCollapsed) toggleExpanded(item);
      else navigate(item.path);
    };

    const solid = parentActive && !childActive;
    const showBar = parentActive || childActive;

    return (
      <div key={item.name} className="space-y-1">
        <button
          onClick={onClick}
          disabled={item.disabled}
          className={cn(
            rowBase,
            solid && 'bg-accent text-accent-foreground',
            childActive && !solid && 'bg-accent/50 text-accent-foreground',
            sidebarCollapsed && 'justify-center',
            item.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-foreground',
          )}
        >
          <ActiveBar show={showBar} faded={childActive && !solid} />
          <div className="relative">
            <Icon className="w-5 h-5 flex-shrink-0" />
            {badgeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
          </div>
          {!sidebarCollapsed && (
            <span className="flex-1 text-left whitespace-nowrap overflow-hidden">
              {item.name}
            </span>
          )}
          {!sidebarCollapsed && hasChildren && (
            <ChevronDown
              className={cn('w-4 h-4 transition-transform', open && 'rotate-180')}
            />
          )}
        </button>

        {open && (
          <div className="ml-5 border-l pl-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
            {item.children!.map((child) => {
              const ChildIcon = child.icon;
              const cActive = isLeafActive(child, item);
              return (
                <button
                  key={child.name}
                  onClick={() => selectChild(child)}
                  disabled={child.disabled}
                  className={cn(
                    rowBase,
                    'py-2',
                    cActive && 'bg-accent text-accent-foreground',
                    child.disabled &&
                    'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-foreground',
                  )}
                >
                  <ActiveBar show={cActive} />
                  <ChildIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="whitespace-nowrap overflow-hidden">{child.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-card border-r',
        'flex flex-col transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Top — agency name */}
      <div className="h-16 flex items-center gap-2 px-4 border-b flex-shrink-0">
        <div className="w-8 h-8 rounded-lg overflow-hidden bg-primary flex items-center justify-center flex-shrink-0">
          {agencyLogo ? (
            <img src={agencyLogo} alt={agencyName} className="w-full h-full object-cover" />
          ) : (
            <Truck className="w-5 h-5 text-primary-foreground" />
          )}
        </div>
        {!sidebarCollapsed && (
          <span className="font-bold text-base truncate">{agencyName}</span>
        )}
      </div>

      {/* Primary navigation — scrolls between top and the pinned footer group */}
      <ScrollArea className="flex-1 min-h-0 py-4">
        <nav className="space-y-1 px-2">
          {PRIMARY_NAV.map(renderItem)}
        </nav>
      </ScrollArea>

      {/* Footer navigation — Account + Settings, pinned just above Platform Status */}
      <nav className="space-y-1 px-2 py-3 border-t flex-shrink-0">
        {FOOTER_NAV.map(renderItem)}
      </nav>

      {/* Footer — Jovi Mall platform + health, then the collapse toggle */}
      <div className="border-t flex-shrink-0">
        {sidebarCollapsed ? (
          <div className="flex justify-center py-3">
            <div className="relative w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Truck className="w-4 h-4 text-primary-foreground" />
              <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card p-0.5">
                <PlatformStatus compact />
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <Truck className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">Jovi Mall</p>
              <PlatformStatus />
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          onClick={toggleSidebar}
          className={cn(
            'w-full h-10 rounded-none border-t text-xs text-muted-foreground gap-2',
            sidebarCollapsed && 'px-0'
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              Collapse
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
