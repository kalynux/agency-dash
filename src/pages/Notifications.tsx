import { useEffect } from 'react';
import {
  Bell,
  ShoppingCart,
  Package,
  Users,
  AlertCircle,
  Check,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotificationStore } from '@/store';
import { cn } from '@/lib/utils';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'order':
      return ShoppingCart;
    case 'product':
      return Package;
    case 'customer':
      return Users;
    case 'alert':
      return AlertCircle;
    default:
      return Bell;
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case 'order':
      return 'bg-blue-100 text-blue-600';
    case 'product':
      return 'bg-purple-100 text-purple-600';
    case 'customer':
      return 'bg-green-100 text-green-600';
    case 'alert':
      return 'bg-red-100 text-red-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

export function Notifications() {
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadNotifications = notifications.filter((n: { read: boolean }) => !n.read);
  const readNotifications = notifications.filter((n: { read: boolean }) => n.read);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const NotificationItem = ({ notification }: { notification: { id: string; type: string; title: string; message: string; read: boolean; createdAt: string; actionUrl?: string } }) => {
    const Icon = getNotificationIcon(notification.type);
    
    return (
      <div
        className={cn(
          'flex items-start gap-4 p-4 rounded-lg transition-colors',
          !notification.read && 'bg-primary/5',
          'hover:bg-muted/50'
        )}
      >
        <div className={cn('p-2 rounded-lg flex-shrink-0', getNotificationColor(notification.type))}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={cn('font-medium', !notification.read && 'text-primary')}>
                {notification.title}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatDate(notification.createdAt)}
            </span>
          </div>
          {notification.actionUrl && (
            <Button variant="link" size="sm" className="p-0 h-auto mt-2 gap-1">
              View details
              <ArrowRight className="w-3 h-3" />
            </Button>
          )}
        </div>
        {!notification.read && (
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 h-8 w-8"
            onClick={() => markAsRead(notification.id)}
          >
            <Check className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated with your store activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={() => markAllAsRead()}>
              <Check className="w-4 h-4 mr-2" />
              Mark all as read
            </Button>
          )}
          <Button variant="outline" size="icon">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unread</p>
                <p className="text-2xl font-bold">{unreadCount}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Bell className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{notifications.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Check className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold">24</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications List */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            All
            <Badge variant="secondary">{notifications.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="unread" className="gap-2">
            Unread
            {unreadCount > 0 && <Badge variant="destructive">{unreadCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="read">Read</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification: { id: string; type: string; title: string; message: string; read: boolean; createdAt: string; actionUrl?: string }) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unread" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {unreadNotifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Check className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">All caught up!</p>
                </div>
              ) : (
                <div className="divide-y">
                  {unreadNotifications.map((notification: { id: string; type: string; title: string; message: string; read: boolean; createdAt: string; actionUrl?: string }) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="read" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {readNotifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No read notifications</p>
                </div>
              ) : (
                <div className="divide-y">
                  {readNotifications.map((notification: { id: string; type: string; title: string; message: string; read: boolean; createdAt: string; actionUrl?: string }) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
