import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { notificationsService } from '@/services/notifications.service';
import { toApiError } from '@/hooks/useResource';
import { getApiErrorMessage } from '@/lib/errors';
import { toast } from 'sonner';
import { ApiError } from '@/types/api';
import type { AgencyNotification } from '@/types/notification.types';

// ─── Real notifications store — powers the sidebar/mobile badge, the header
// dropdown, and seeds the Notifications page. Polls the recent page; the page
// handles deeper pagination itself and calls `refetch()` to resync.

const POLL_INTERVAL_MS = 60_000;
const RECENT_LIMIT = 20;

export interface NotificationsState {
  notifications: AgencyNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsState | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AgencyNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef(false);

  const refetch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const res = await notificationsService.list({ page: 1, limit: RECENT_LIMIT });
      setNotifications(res.data);
      setUnreadCount(res.unreadCount ?? 0);
    } catch (err) {
      setError(toApiError(err, 'NOTIFICATIONS_FETCH_FAILED', 'Failed to load notifications'));
    } finally {
      setIsLoading(false);
      inFlight.current = false;
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationsService.markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    refetch();
    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      refetch();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refetch]);

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, isLoading, error, refetch, markAsRead, markAllAsRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
