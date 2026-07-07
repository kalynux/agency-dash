import { useState } from 'react';
import { useAuth, useRouter } from '@/App';
import { useNotificationStore } from '@/store';
import {
  Search,
  Bell,
  Plus,
  Command,
  X,
  ArrowRight,
  ShoppingCart,
  Package,
  Users,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const quickActions = [
  { name: 'Create Product', icon: Package, route: 'products' as const },
  { name: 'Create Order', icon: ShoppingCart, route: 'orders' as const },
  { name: 'Add Customer', icon: Users, route: 'customers' as const },
  { name: 'Generate Report', icon: FileText, route: 'analytics' as const },
];

const recentSearches = [
  'Order #1001',
  'Wireless Headphones',
  'Alice Johnson',
  'Tech Gadgets Pro',
];

export function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const { navigate } = useRouter();
  const { notifications, unreadCount, markAllAsRead } = useNotificationStore();

  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
  };

  const unreadNotifications = notifications.filter((n: { read: boolean }) => !n.read).slice(0, 5);

  return (
    <>
      <header className="h-16 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="h-full px-6 flex items-center justify-between">
          {/* Left - Breadcrumbs could go here */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              className="h-9 gap-2 text-muted-foreground"
              onClick={toggleSearch}
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search...</span>
              <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                <Command className="w-3 h-3" />
                <span>K</span>
              </kbd>
            </Button>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-3">
            {/* Quick Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Plus className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {quickActions.map((action) => (
                  <DropdownMenuItem
                    key={action.name}
                    onClick={() => navigate(action.route)}
                    className="gap-3"
                  >
                    <action.icon className="w-4 h-4" />
                    <span className="flex-1">{action.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 relative">
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-3 py-2">
                  <DropdownMenuLabel className="m-0">Notifications</DropdownMenuLabel>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAllAsRead()}
                      className="h-auto py-1 px-2 text-xs"
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
                <DropdownMenuSeparator />
                {unreadNotifications.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No new notifications</p>
                  </div>
                ) : (
                  unreadNotifications.map((notification: { id: string; type: string; title: string; message: string; createdAt: string; actionUrl?: string }) => (
                    <DropdownMenuItem
                      key={notification.id}
                      onClick={() => notification.actionUrl && navigate('notifications')}
                      className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className={
                          notification.type === 'order' ? 'w-2 h-2 rounded-full bg-blue-500' :
                          notification.type === 'alert' ? 'w-2 h-2 rounded-full bg-red-500' :
                          notification.type === 'customer' ? 'w-2 h-2 rounded-full bg-green-500' :
                          'w-2 h-2 rounded-full bg-gray-500'
                        } />
                        <span className="font-medium text-sm flex-1">{notification.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 pl-4">
                        {notification.message}
                      </p>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate('notifications')}
                  className="justify-center text-sm text-primary"
                >
                  View all notifications
                  <ArrowRight className="w-4 h-4 ml-1" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <img
                    src={user?.avatar || `https://i.pravatar.cc/150?u=${user?.id}`}
                    alt={user?.name}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user?.name}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {user?.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('settings')}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('settings')}>
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive"
                >
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Global Search Overlay */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card rounded-xl shadow-2xl border overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 p-4 border-b">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Input
                  id="global-search"
                  placeholder="Search orders, products, customers..."
                  className="flex-1 border-0 bg-transparent text-lg focus-visible:ring-0 placeholder:text-muted-foreground"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <kbd className="hidden sm:inline-flex h-7 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-xs font-medium">
                  ESC
                </kbd>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsSearchOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Search Results */}
              <div className="max-h-[60vh] overflow-auto">
                {searchQuery ? (
                  <div className="p-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Search results for &quot;{searchQuery}&quot;
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer">
                        <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">Order #1001</p>
                          <p className="text-sm text-muted-foreground">Alice Johnson - $284.97</p>
                        </div>
                        <Badge variant="secondary">Order</Badge>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer">
                        <Package className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">Wireless Bluetooth Headphones</p>
                          <p className="text-sm text-muted-foreground">SKU: WBH-001 - $149.99</p>
                        </div>
                        <Badge variant="secondary">Product</Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    {/* Quick Actions */}
                    <div className="mb-6">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        Quick Actions
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {quickActions.map((action) => (
                          <button
                            key={action.name}
                            onClick={() => {
                              navigate(action.route);
                              setIsSearchOpen(false);
                            }}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent text-left transition-colors"
                          >
                            <action.icon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{action.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Recent Searches */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        Recent Searches
                      </p>
                      <div className="space-y-1">
                        {recentSearches.map((search, index) => (
                          <button
                            key={index}
                            onClick={() => setSearchQuery(search)}
                            className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-accent text-left transition-colors"
                          >
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{search}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-t text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="bg-muted px-1.5 py-0.5 rounded border">↑↓</kbd>
                    to navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="bg-muted px-1.5 py-0.5 rounded border">↵</kbd>
                    to select
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="bg-muted px-1.5 py-0.5 rounded border">esc</kbd>
                  to close
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
