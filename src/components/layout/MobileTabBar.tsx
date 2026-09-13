import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Truck, Wallet, Menu, Plus, ChevronRight } from 'lucide-react';
import { useNotifications } from '@/store/notifications.store';
import { useShipments } from '@/store/shipments.store';
import { useKeyboardOpen } from '@/platform/shell/keyboard';
import { cn } from '@/lib/utils';
import { MobileMoreDrawer } from './MobileMoreDrawer';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { QUICK_ACTIONS, type QuickAction } from '@/config/quickActions';
import { tx } from '@/i18n/tx';

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
  const { t } = useTranslation('nav');
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useNotifications();
  const { activeCount: shipmentsBadge } = useShipments();
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  // Always false on the web, so the browser build is unchanged (P3.2).
  const keyboardOpen = useKeyboardOpen();

  const handleQuickAction = (action: QuickAction) => {
    navigate(
      `/dashboard/${action.route}`,
      action.intent ? { state: { create: true } } : undefined,
    );
    setQuickActionsOpen(false);
  };

  return (
    <>
      {/* Hidden while the on-screen keyboard is up. The bar is `fixed
          bottom-0`, so a resized WebView re-pins it directly on top of the
          keyboard — a row of navigation buttons wedged between the field being
          typed into and the keys. The drawers below stay mounted either way:
          unmounting them with the bar would close an open sheet the moment its
          own text field was focused. */}
      {!keyboardOpen && (
        <nav className="fixed bottom-0 start-0 end-0 z-50 bg-background/95 backdrop-blur-sm border-t shadow-[0_-4px_16px_rgba(6,36,26,0.06)] pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around h-16 px-2">
            <TabButton
              label={t('primary.overview')}
              icon={LayoutDashboard}
              active={isPathActive('/dashboard', location.pathname) && location.pathname === '/dashboard'}
              onClick={() => navigate('/dashboard')}
            />
            <TabButton
              label={t('primary.shipments')}
              icon={Truck}
              active={isPathActive('/dashboard/shipments', location.pathname)}
              badge={shipmentsBadge}
              onClick={() => navigate('/dashboard/shipments')}
            />

            {/* FAB */}
            <button
              onClick={() => setQuickActionsOpen(true)}
              aria-label={t('header.quickActions')}
              className="-mt-5 w-14 h-14 rounded-2xl bg-brand-gradient text-white shadow-brand flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
            >
              <Plus className="w-6 h-6" />
            </button>

            <TabButton
              label={t('footer.accountPayout')}
              icon={Wallet}
              active={isPathActive('/dashboard/account/payout', location.pathname)}
              onClick={() => navigate('/dashboard/account/payout')}
            />

            <TabButton
              label={t('mobile.more')}
              icon={Menu}
              active={moreOpen}
              badge={unreadCount > 0 ? unreadCount : undefined}
              onClick={() => setMoreOpen(true)}
            />
          </div>
        </nav>
      )}

      <MobileMoreDrawer open={moreOpen} onOpenChange={setMoreOpen} />

      {/* Quick Actions Sheet */}
      <Sheet open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
        <SheetContent side="bottom" className="p-0 rounded-t-2xl">
          <div className="px-4 pt-4 pb-2 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {t('header.quickActions')}
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
                <div className="flex-1 text-start">
                  <p className="text-sm font-semibold">{tx(t, action.labelKey)}</p>
                  <p className="text-xs text-muted-foreground">{tx(t, action.descriptionKey)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 rtl:-scale-x-100" />
              </button>
            ))}
          </div>
          <div className="h-2 pb-[env(safe-area-inset-bottom)]" />
        </SheetContent>
      </Sheet>
    </>
  );
}
