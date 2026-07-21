import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, ChevronLeft, ChevronRight, Settings, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AsyncBoundary, EmptyState } from '@/components/common/state-views';
import { useNotifications } from '@/store/notifications.store';
import { notificationsService } from '@/services/notifications.service';
import { notificationVisual, notificationHref } from '@/lib/notification-display';
import { getApiErrorMessage } from '@/lib/errors';
import { toApiError } from '@/hooks/useResource';
import { cn } from '@/lib/utils';
import { ApiError } from '@/types/api';
import type { AgencyNotification, NotificationListMeta } from '@/types/notification.types';

const PAGE_LIMIT = 20;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function Notifications() {
  const navigate = useNavigate();
  const { unreadCount, markAsRead, markAllAsRead, refetch: refetchBadge } = useNotifications();

  const [items, setItems] = useState<AgencyNotification[]>([]);
  const [meta, setMeta] = useState<NotificationListMeta>({ total: 0, page: 1, limit: PAGE_LIMIT, pages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await notificationsService.list({ page, limit: PAGE_LIMIT });
      setItems(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpen = async (n: AgencyNotification) => {
    if (!n.isRead) {
      await markAsRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    }
    navigate(notificationHref(n.action));
  };

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
  };

  const handleMarkAll = async () => {
    await markAllAsRead();
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">Stay updated with your agency activity</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAll}>
              <Check className="w-4 h-4 mr-2" />
              Mark all as read
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => { load(); refetchBadge(); }} title="Refresh">
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate('/dashboard/settings/notifications')} title="Notification settings">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <AsyncBoundary
            isLoading={isLoading && items.length === 0}
            error={items.length === 0 ? error : undefined}
            onRetry={load}
            isEmpty={!isLoading && items.length === 0}
            emptyState={
              <EmptyState icon={Bell} title="No notifications yet" description="You're all caught up." className="border-0" />
            }
          >
            <div className="divide-y">
              {items.map((n) => {
                const visual = notificationVisual(n.type);
                const Icon = visual.icon;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-4 p-4 transition-colors hover:bg-muted/50 cursor-pointer',
                      !n.isRead && 'bg-primary/5',
                    )}
                    onClick={() => handleOpen(n)}
                  >
                    <div className={cn('p-2 rounded-lg flex-shrink-0', visual.chip)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('font-medium', !n.isRead && 'text-primary')}>{n.title}</p>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                      {n.action && (
                        <span className="inline-flex items-center gap-1 text-xs text-primary mt-2">
                          {n.action.label}
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    {!n.isRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkRead(n.id);
                        }}
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </AsyncBoundary>

          {!isLoading && !error && meta.pages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.pages} · {meta.total} total
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={meta.page >= meta.pages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && items.length > 0 && (
        <p className="text-sm text-destructive text-center">{getApiErrorMessage(error)}</p>
      )}
    </div>
  );
}
