import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/store/notifications.store';
import { cn } from '@/lib/utils';

const NOTIFICATIONS_PATH = '/dashboard/notifications';

/**
 * The unread-notifications bell, for the mobile app bar.
 *
 * The desktop shell has always had one in `Header`; the phone shell has no
 * header at all, so until now the only route to notifications was the bottom
 * tab bar's "More" sheet — two taps and a scroll for the one thing in the app
 * that is time-sensitive by definition. This puts it one tap from every screen.
 *
 * It **navigates** rather than opening a dropdown of recent items the way the
 * desktop header does. A phone has the room to show the real list and no room
 * to show a good preview of it, and the list screen can do everything the
 * preview can — mark read, filter, open.
 *
 * Renders nothing on the notifications page itself: a control whose only job is
 * to take you where you already are reads as broken.
 */
export function NotificationBell({ className }: { className?: string }) {
  const { t } = useTranslation('nav');
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useNotifications();

  if (location.pathname === NOTIFICATIONS_PATH) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => navigate(NOTIFICATIONS_PATH)}
      // The count belongs in the label, not just in the badge: a screen reader
      // announcing "Notifications" alone loses the only part that is news.
      aria-label={
        unreadCount > 0
          ? t('header.notificationsWithCount', { count: unreadCount })
          : t('header.notifications')
      }
      className={cn('relative h-9 w-9 flex-shrink-0', className)}
    >
      <Bell className="h-[1.15rem] w-[1.15rem]" />
      {unreadCount > 0 && (
        <span
          aria-hidden
          className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );
}
