import { formatDate } from '@/lib/format';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/store/notifications.store';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import type { AgencyNotification } from '@/types/notification.types';
import {
  Search,
  Bell,
  Plus,
  Command,
  ArrowRight,
  LogOut,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalSearch } from '@/components/layout/GlobalSearch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog';
import { QUICK_ACTIONS, type QuickAction } from '@/config/quickActions';
import { notificationVisual, notificationHref } from '@/lib/notification-display';
import { tx } from '@/i18n/tx';

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Header() {
  const { t } = useTranslation(['nav', 'common']);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  // The ⌘K the button advertises. Ctrl+K too — most agencies are on Windows
  // or Android, where there is no ⌘.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  // The sign-out call itself lives in `LogoutConfirmDialog` now; this only
  // needs the session for the avatar and the name beside it.
  const { session } = useOnboarding();
  const roleEntity = session?.role_entity;

  const agencyName = roleEntity?.agency_name || t('sidebar.fallbackAgencyName');
  const agencyLogo = roleEntity?.logo_url || null;
  const agencyEmail = roleEntity?.email ?? '';

  const toggleSearch = () => setIsSearchOpen((v) => !v);

  const handleQuickAction = (action: QuickAction) => {
    setIsSearchOpen(false);
    navigate(
      `/dashboard/${action.route}`,
      action.intent ? { state: { create: true } } : undefined,
    );
  };

  const goToProfile = () => navigate('/dashboard/account/profile');

  const unreadNotifications = notifications.filter((n) => !n.isRead).slice(0, 5);

  const openNotification = (n: AgencyNotification) => {
    markAsRead(n.id);
    navigate(notificationHref(n.action, n.type));
  };

  return (
    <>
      <header className="h-16 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="h-full mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Left - search */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              className="h-9 gap-2 text-muted-foreground"
              onClick={toggleSearch}
              aria-label={t('header.searchLabel')}
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">{t('header.searchPlaceholderShort')}</span>
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
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  aria-label={t('header.quickActions')}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>{t('header.quickActions')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {QUICK_ACTIONS.map((action) => (
                  <DropdownMenuItem
                    key={action.id}
                    onClick={() => handleQuickAction(action)}
                    className="gap-3"
                  >
                    <action.icon className="w-4 h-4" />
                    <div className="flex flex-col">
                      <span>{tx(t, action.labelKey)}</span>
                      <span className="text-xs text-muted-foreground">
                        {tx(t, action.descriptionKey)}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 relative"
                  aria-label={t('header.notifications')}
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -end-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-3 py-2">
                  <DropdownMenuLabel className="m-0">{t('header.notifications')}</DropdownMenuLabel>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAllAsRead()}
                      className="h-auto py-1 px-2 text-xs"
                    >
                      {t('header.markAllRead')}
                    </Button>
                  )}
                </div>
                <DropdownMenuSeparator />
                {unreadNotifications.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('header.noNewNotifications')}</p>
                  </div>
                ) : (
                  unreadNotifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      onClick={() => openNotification(notification)}
                      className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className={`w-2 h-2 rounded-full ${notificationVisual(notification.type).dot}`} />
                        <span className="font-medium text-sm flex-1">{notification.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 ps-4">
                        {notification.message}
                      </p>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate('/dashboard/notifications')}
                  className="justify-center text-sm text-primary"
                >
                  {t('header.viewAllNotifications')}
                  <ArrowRight className="w-4 h-4 ms-1 rtl:-scale-x-100" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={agencyLogo ?? undefined} alt={agencyName} />
                    <AvatarFallback className="text-xs font-semibold">
                      {initialsOf(agencyName)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="truncate">{agencyName}</span>
                    {agencyEmail && (
                      <span className="text-xs text-muted-foreground font-normal truncate">
                        {agencyEmail}
                      </span>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={goToProfile} className="gap-2">
                  <User className="w-4 h-4" />
                  {t('header.profile')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setLogoutOpen(true);
                  }}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                  {t('header.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Logout confirmation — shared with Account → Profile on mobile. */}
      <LogoutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} />

      {/* ⌘K palette — pages, quick actions, shipments. */}
      <GlobalSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  );
}
