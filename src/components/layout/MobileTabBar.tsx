import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Truck, Wallet, Menu, Plus, ChevronRight } from 'lucide-react';
import { useNotifications } from '@/store/notifications.store';
import { useShipments } from '@/store/shipments.store';
import { cn } from '@/lib/utils';
import { MobileMoreDrawer } from './MobileMoreDrawer';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { QUICK_ACTIONS, type QuickAction } from '@/config/quickActions';

interface TabButtonProps {
  label: string;
  icon: React.ElementType;
  active?: boolean;
  badge?: number;
  onClick: () => void;
}

function TabButton({ label, icon: Icon, active, badge, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {active && (
        <span className="absolute -top-px h-0.5 w-9 rounded-full bg-primary" />
      )}
      <div className="relative">
        <Icon className={cn('w-5 h-5', active && 'scale-105 transition-transform')} />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -end-1.5 min-w-4 h-4 px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-background">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className={cn('text-[10px]', active && 'font-semibold')}>{label}</span>
    </button>
  );
}

function isPathActive(itemPath: string, pathname: string): boolean {
  if (itemPath === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/';
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function MobileTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useNotifications();
  const { activeCount: shipmentsBadge } = useShipments();
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const handleQuickAction = (action: QuickAction) => {
    navigate(
      `/dashboard/${action.route}`,
      action.intent ? { state: { create: true } } : undefined,
    );
    setQuickActionsOpen(false);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t shadow-[0_-4px_16px_rgba(6,36,26,0.06)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16 px-2">
          <TabButton
            label="Overview"
            icon={LayoutDashboard}
            active={isPathActive('/dashboard', location.pathname) && location.pathname === '/dashboard'}
            onClick={() => navigate('/dashboard')}
          />
          <TabButton
            label="Shipments"
            icon={Truck}
            active={isPathActive('/dashboard/shipments', location.pathname)}
            badge={shipmentsBadge}
            onClick={() => navigate('/dashboard/shipments')}
          />

          {/* FAB */}
          <button
            onClick={() => setQuickActionsOpen(true)}
            className="-mt-5 w-14 h-14 rounded-2xl bg-brand-gradient text-white shadow-brand flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
          >
            <Plus className="w-6 h-6" />
          </button>

          <TabButton
            label="Payout"
            icon={Wallet}
            active={isPathActive('/dashboard/account/payout', location.pathname)}
            onClick={() => navigate('/dashboard/account/payout')}
          />

          <TabButton
            label="More"
            icon={Menu}
            active={moreOpen}
            badge={unreadCount > 0 ? unreadCount : undefined}
            onClick={() => setMoreOpen(true)}
          />
        </div>
      </nav>

      <MobileMoreDrawer open={moreOpen} onOpenChange={setMoreOpen} />

      {/* Quick Actions Sheet */}
      <Sheet open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
        <SheetContent side="bottom" className="p-0 rounded-t-2xl">
          <div className="px-4 pt-4 pb-2 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Quick Actions
            </p>
          </div>
          <div className="py-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-accent transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <action.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
          <div className="h-2 pb-[env(safe-area-inset-bottom)]" />
        </SheetContent>
      </Sheet>
    </>
  );
}
