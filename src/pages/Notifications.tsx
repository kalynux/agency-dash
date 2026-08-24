import { formatRelativeTime } from '@/lib/format';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Check, ChevronLeft, ChevronRight, Settings, ArrowRight, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AsyncBoundary, EmptyState } from '@/components/common/state-views';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { listSurfaceClass, PageHeader } from '@/components/layout/PageContainer';
import { useNotifications } from '@/store/notifications.store';
import { notificationsService } from '@/services/notifications.service';
import { notificationVisual, notificationHref } from '@/lib/notification-display';
import { getApiErrorMessage } from '@/lib/errors';
import { toApiError } from '@/hooks/useResource';
import { cn } from '@/lib/utils';
import { ApiError } from '@/types/api';
import type { AgencyNotification, NotificationListMeta } from '@/types/notification.types';

const PAGE_LIMIT = 20;

type ReadFilter = 'all' | 'unread' | 'read';

export function Notifications() {
  // A notification's own title/message/action label arrive already translated —
  // the backend renders them in the agency's `preferred_language`, which is the
  // same setting that drives this dashboard. Only the chrome is translated here.
  const { t } = useTranslation(['notifications', 'common']);
  const navigate = useNavigate();
  const { unreadCount, markAsRead, markAllAsRead, refetch: refetchBadge } = useNotifications();

  const [items, setItems] = useState<AgencyNotification[]>([]);
  const [meta, setMeta] = useState<NotificationListMeta>({ total: 0, page: 1, limit: PAGE_LIMIT, pages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const readOptions = useMemo(
    () => [
      { value: 'all' as const, label: t('filters.all') },
      { value: 'unread' as const, label: t('filters.unread') },
      { value: 'read' as const, label: t('filters.read') },
    ],
    [t],
  );

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

  // Neither read status nor text has a server-side filter (the list endpoint only
  // takes page/limit), so both narrow the current page's items.
  const query = searchQuery.trim().toLowerCase();
  const visibleItems = items.filter((n) => {
    if (readFilter === 'unread' && n.isRead) return false;
    if (readFilter === 'read' && !n.isRead) return false;
    if (!query) return true;
    return n.title.toLowerCase().includes(query) || n.message.toLowerCase().includes(query);
  });

  const NotificationRow = ({ n }: { n: AgencyNotification }) => {
    const visual = notificationVisual(n.type);
    const Icon = visual.icon;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleOpen(n)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpen(n);
          }
        }}
        className={cn(
          'flex items-start gap-4 p-4 transition-colors hover:bg-muted/50 cursor-pointer',
          !n.isRead && 'bg-primary/5',
        )}
      >
        <div className={cn('p-2 rounded-lg flex-shrink-0', visual.chip)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('font-medium', !n.isRead && 'text-primary')}>{n.title}</p>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatRelativeTime(n.createdAt)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
          {n.action && (
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto mt-2 gap-1"
              onClick={(e) => {
                e.stopPropagation();
                handleOpen(n);
              }}
            >
              {n.action.label}
              <ArrowRight className="w-3 h-3 rtl:-scale-x-100" />
            </Button>
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
            title={t('page.markRead')}
            aria-label={t('page.markRead')}
          >
            <Check className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  };

  const isNarrowed = readFilter !== 'all' || query.length > 0;

  const notificationList = (
    <Card className={listSurfaceClass}>
      <CardContent className="p-0">
        <AsyncBoundary
          isLoading={isLoading && items.length === 0}
          error={items.length === 0 ? error : undefined}
          onRetry={load}
          isEmpty={!isLoading && visibleItems.length === 0}
          emptyState={
            <EmptyState
              icon={Bell}
              title={isNarrowed ? t('empty.narrowedTitle') : t('empty.title')}
              description={
                isNarrowed ? t('empty.narrowedDescription') : t('empty.description')
              }
              className="border-0"
            />
          }
        >
          <div className="divide-y">
            {visibleItems.map((n) => (
              <NotificationRow key={n.id} n={n} />
            ))}
          </div>
        </AsyncBoundary>

        {!isLoading && !error && meta.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              {t('pagination', { page: meta.page, pages: meta.pages, total: meta.total })}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={t('common:pagination.previous')}>
                <ChevronLeft className="w-4 h-4 rtl:-scale-x-100" />
              </Button>
              <Button variant="outline" size="sm" disabled={meta.page >= meta.pages} onClick={() => setPage((p) => p + 1)} aria-label={t('common:pagination.next')}>
                <ChevronRight className="w-4 h-4 rtl:-scale-x-100" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('page.title')}
        description={t('page.description')}
        // Counts read as badges next to the title — desktop only, as the cards
        // they replaced were. On a phone the same numbers are already on the
        // tab bar's badge and in the list itself.
        actions={
          <div className="flex items-center gap-2 max-md:hidden">
            <Badge variant={unreadCount > 0 ? 'default' : 'secondary'}>
              <Bell />
              <span className="tabular-nums">{unreadCount}</span>
              {t('stats.unread')}
            </Badge>
            <Badge variant="outline">
              <span className="tabular-nums">{meta.total}</span>
              {t('stats.total')}
            </Badge>
          </div>
        }
        actionItems={[
          // Conditional, because "mark all read" with nothing unread is a
          // button that cannot do anything.
          ...(unreadCount > 0
            ? [
                {
                  id: 'mark-all',
                  label: t('page.markAllRead'),
                  icon: Check,
                  onSelect: handleMarkAll,
                  primary: true,
                },
              ]
            : []),
          {
            id: 'refresh',
            label: t('page.refresh'),
            icon: RefreshCw,
            onSelect: () => {
              load();
              refetchBadge();
            },
            busy: isLoading,
          },
          {
            id: 'settings',
            label: t('page.settings'),
            icon: Settings,
            onSelect: () => navigate('/dashboard/settings/notifications'),
          },
        ]}
      />

      <SearchFilterBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t('filters.searchPlaceholder')}
        searchLabel={t('filters.searchLabel')}
        activeCount={readFilter === 'all' ? 0 : 1}
        onReset={() => setReadFilter('all')}
        filterDescription={t('filters.description')}
        resultCount={visibleItems.length}
        resultNounKey="common:nouns.notification"
      >
        <FilterSection label={t('filters.readStatus')}>
          <FilterOptionGroup value={readFilter} onChange={setReadFilter} options={readOptions} />
        </FilterSection>
      </SearchFilterBar>

      {notificationList}

      {error && items.length > 0 && (
        <p className="text-sm text-destructive text-center">{getApiErrorMessage(error)}</p>
      )}
    </div>
  );
}
