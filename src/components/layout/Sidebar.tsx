import { useState } from 'react';
import { useAuth, useUI, useRouter } from '@/App';
import { useNotificationStore, useUIStore } from '@/store';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Store,
  Bell,
  HelpCircle,
  LogOut,
  Shield,
  ChevronDown,
  User,
  CreditCard,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Overview', route: 'overview' as const, icon: LayoutDashboard },
  { name: 'Orders', route: 'orders' as const, icon: ShoppingCart, badge: 'orders' },
  { name: 'Products', route: 'products' as const, icon: Package },
  { name: 'Media', route: 'media' as const, icon: ImageIcon },
  { name: 'Customers', route: 'customers' as const, icon: Users },
  { name: 'Analytics', route: 'analytics' as const, icon: BarChart3 },
];

const adminNavigation = [
  { name: 'Agencies', route: 'vendors' as const, icon: Store },
  { name: 'Admin Settings', route: 'settings' as const, icon: Shield },
];

const bottomNavigation = [
  { name: 'Notifications', route: 'notifications' as const, icon: Bell, badge: 'notifications' },
  { name: 'Help & Support', route: 'support' as const, icon: HelpCircle },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUI();
  const { setSettingsTab, settingsTab } = useUIStore();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotificationStore();
  const { route, navigate } = useRouter();
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  const isAdmin = user?.role === 'admin';

  const isActive = (itemRoute: string) => {
    return route === itemRoute;
  };

  const handleSettingsClick = (tab: string) => {
    setSettingsTab(tab);
    navigate('settings');
  };

  const getBadgeCount = (badgeType?: string) => {
    if (badgeType === 'notifications') return unreadCount;
    if (badgeType === 'orders') return 3;
    return 0;
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-card border-r',
        'flex flex-col transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Store className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">Jovi Mall</span>
          </div>
        ) : (
          <div className="mx-auto">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Store className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn('h-8 w-8', sidebarCollapsed && 'hidden')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>



      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const badgeCount = getBadgeCount(item.badge);
            const active = isActive(item.route);

            return (
              <button
                key={item.name}
                onClick={() => navigate(item.route)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  active && 'bg-primary/10 text-primary',
                  sidebarCollapsed && 'justify-center'
                )}
              >
                <div className="relative">
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {badgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <span className="whitespace-nowrap overflow-hidden">
                    {item.name}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Admin Section */}
        {isAdmin && (
          <div className="mt-6">
            {!sidebarCollapsed && (
              <div className="px-4 mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Admin
                </span>
              </div>
            )}
            <nav className="space-y-1 px-2">
              {adminNavigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.route);

                return (
                  <button
                    key={item.name}
                    onClick={() => navigate(item.route)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      active && 'bg-primary/10 text-primary',
                      sidebarCollapsed && 'justify-center'
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <span className="whitespace-nowrap overflow-hidden">
                        {item.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </ScrollArea>

      {/* Bottom Navigation */}
      <div className="border-t py-2">
        <nav className="space-y-1 px-2">
          {bottomNavigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.route);

            return (
              <button
                key={item.name}
                onClick={() => navigate(item.route)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  active && 'bg-primary/10 text-primary',
                  sidebarCollapsed && 'justify-center'
                )}
              >
                <div className="relative">
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {item.badge === 'notifications' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <span className="whitespace-nowrap overflow-hidden">
                    {item.name}
                  </span>
                )}
              </button>
            );
          })}

          {/* Settings Group */}
          <div className="space-y-1">
            <button
              onClick={() => !sidebarCollapsed ? setSettingsExpanded(!settingsExpanded) : navigate('settings')}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                isActive('settings') && 'bg-primary/10 text-primary',
                sidebarCollapsed && 'justify-center'
              )}
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">Settings</span>
                  <ChevronDown
                    className={cn("w-4 h-4 transition-transform", settingsExpanded && "rotate-180")}
                  />
                </>
              )}
            </button>

            {!sidebarCollapsed && settingsExpanded && (
              <div className="pl-9 space-y-1 animate-in slide-in-from-top-2 duration-200">
                {[
                  { name: 'Profile', id: 'profile', icon: User },
                  { name: 'Store', id: 'store', icon: Store },
                  { name: 'Notifications', id: 'notifications', icon: Bell },
                  { name: 'Security', id: 'security', icon: Shield, disabled: true },
                  { name: 'Billing', id: 'billing', icon: CreditCard, disabled: true },
                ].map((subItem) => (
                  <button
                    key={subItem.id}
                    onClick={() => !subItem.disabled && handleSettingsClick(subItem.id)}
                    disabled={subItem.disabled}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                      settingsTab === subItem.id && isActive('settings')
                        ? 'text-primary bg-primary/5'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      subItem.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground'
                    )}
                  >
                    <subItem.icon className="w-3 h-3" />
                    <span>{subItem.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* User Profile */}
        <div className="mt-2 px-2">
          <div
            className={cn(
              'flex items-center gap-3 px-3 py-3 rounded-lg bg-muted/50',
              sidebarCollapsed && 'justify-center'
            )}
          >
            <img
              src={user?.avatar || `https://i.pravatar.cc/150?u=${user?.id}`}
              alt={user?.name}
              className="w-8 h-8 rounded-full flex-shrink-0"
            />
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="h-8 w-8 flex-shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expand Button (when collapsed) */}
      {sidebarCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-primary text-primary-foreground shadow-md"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      )}
    </aside>
  );
}
