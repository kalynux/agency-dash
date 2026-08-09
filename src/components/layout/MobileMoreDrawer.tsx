import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown, Settings, Truck } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/store/notifications.store';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useVendorConnections } from '@/store/vendorConnections.store';
import { useAgentsRoster } from '@/store/agents.store';
import { useStockRequests } from '@/store/stockRequests.store';
import { PRIMARY_NAV, FOOTER_NAV, type NavItem, type NavChild, type NavBadge } from '@/config/navigation';
import { tx } from '@/i18n/tx';
import { cn } from '@/lib/utils';

// Items already present in the bottom tab bar — hidden from "More".
const TAB_BAR_PATHS = new Set(['/dashboard', '/dashboard/shipments']);

interface NavHandlers {
  go: (path: string) => void;
  badgeCount: (badge?: NavBadge) => number;
}

function MenuRow({ item, handlers }: { item: NavItem; handlers: NavHandlers }) {
  const { t } = useTranslation('nav');
  const Icon = item.icon;
  const hasChildren = !!item.children?.length;
  const [open, setOpen] = useState(false);
  const badge = handlers.badgeCount(item.badge);

  const onClick = () => {
    if (item.disabled) return;
    if (hasChildren) setOpen((o) => !o);
    else handlers.go(item.path);
  };

  return (
    <div>
      <button
        onClick={onClick}
        disabled={item.disabled}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors',
          item.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
        )}
      >
        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <span className="flex-1 text-start text-sm font-medium">{tx(t, item.labelKey)}</span>
        {badge > 0 && (
          <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center mr-1">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
        {hasChildren ? (
          <ChevronDown
            className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground rtl:-scale-x-100" />
        )}
      </button>

      {hasChildren && open && (
        <div className="bg-muted/30 border-t animate-in slide-in-from-top-1 duration-200">
          {item.children!.map((child: NavChild) => {
            const ChildIcon = child.icon;
            const childBadge = handlers.badgeCount(child.badge);
            return (
              <button
                key={child.path}
                disabled={child.disabled}
                onClick={() => {
                  if (child.disabled) return;
                  handlers.go(child.path);
                }}
                className={cn(
                  'w-full flex items-center gap-3 pl-8 pr-4 py-2.5 hover:bg-accent transition-colors',
                  child.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
                )}
              >
                <div className="w-7 h-7 rounded-lg bg-card border flex items-center justify-center flex-shrink-0">
                  <ChildIcon className="w-3.5 h-3.5" />
                </div>
                <span className="flex-1 text-start text-sm">{tx(t, child.labelKey)}</span>
                {childBadge > 0 && (
                  <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {childBadge > 9 ? '9+' : childBadge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MenuGroup({ items, handlers }: { items: NavItem[]; handlers: NavHandlers }) {
  if (!items.length) return null;
  return (
    <div className="bg-card rounded-xl mx-4 mb-3 overflow-hidden border divide-y">
      {items.map((item) => (
        <MenuRow key={item.path} item={item} handlers={handlers} />
      ))}
    </div>
  );
}

interface MobileMoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMoreDrawer({ open, onOpenChange }: MobileMoreDrawerProps) {
  const { t } = useTranslation('nav');
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const { pendingActionCount } = useVendorConnections();
  const { pendingActionCount: agentActionCount } = useAgentsRoster();
  const { awaitingCount: stockRequestCount } = useStockRequests();
  const roleEntity = useOnboarding().session?.role_entity;

  const agencyName = roleEntity?.agency_name || t('sidebar.fallbackAgencyName');
  const agencyLogo = roleEntity?.logo_url || null;

  const handlers: NavHandlers = {
    go: (path) => {
      navigate(path);
      onOpenChange(false);
    },
    badgeCount: (badge) => {
      if (badge === 'notifications') return unreadCount;
      if (badge === 'vendorConnections') return pendingActionCount;
      if (badge === 'agentContracts') return agentActionCount;
      if (badge === 'stockRequests') return stockRequestCount;
      return 0;
    },
  };

  // Primary items not already in the bottom tab bar.
  const primaryItems = PRIMARY_NAV.filter((item) => !TAB_BAR_PATHS.has(item.path));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-2xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 py-4 border-b flex-shrink-0">
            <h2 className="text-xl font-bold">{t('mobile.more')}</h2>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Agency profile card */}
            <div className="mx-4 mt-4 mb-4 p-4 bg-card rounded-xl border flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden bg-primary flex items-center justify-center">
                {agencyLogo ? (
                  <img src={agencyLogo} alt={agencyName} crossOrigin="use-credentials" className="w-full h-full object-cover" />
                ) : (
                  <Truck className="w-6 h-6 text-primary-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{agencyName}</p>
                <p className="text-sm text-muted-foreground">{t('mobile.roleLabel')}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlers.go('/dashboard/account/profile')}
                aria-label={t('mobile.openSettings')}
                className="flex-shrink-0"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            <MenuGroup items={primaryItems} handlers={handlers} />
            <MenuGroup items={FOOTER_NAV} handlers={handlers} />

            <div className="h-8" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
