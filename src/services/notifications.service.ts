import { api } from './api';
import type {
  ListNotificationsParams,
  ListNotificationsResponse,
  NotificationMutationResponse,
  MarkAllReadResponse,
  NotificationPreferencesResponse,
  UpdateNotificationPreferencesPayload,
  RegisterDevicePayload,
  RegisterDeviceResponse,
} from '@/types/notification.types';

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const notificationsService = {
  /** GET /agency/notifications — list notifications (newest first), paginated. */
  list(params: ListNotificationsParams = {}): Promise<ListNotificationsResponse> {
    return api.get<ListNotificationsResponse>(
      `/agency/notifications${buildQueryString(params as Record<string, unknown>)}`,
    );
  },

  /** PATCH /agency/notifications/:id/read — mark a single notification as read (idempotent). */
  markRead(id: string): Promise<NotificationMutationResponse> {
    return api.patch<NotificationMutationResponse>(`/agency/notifications/${id}/read`);
  },

  /** POST /agency/notifications/read-all — mark all notifications as read. */
  markAllRead(): Promise<MarkAllReadResponse> {
    return api.post<MarkAllReadResponse>('/agency/notifications/read-all');
  },

  /** GET /agency/notification-preferences — channel enablement, verification, per-event subs. */
  getPreferences(): Promise<NotificationPreferencesResponse> {
    return api.get<NotificationPreferencesResponse>('/agency/notification-preferences');
  },

  /** PATCH /agency/notification-preferences — update channels and/or per-event subs. */
  updatePreferences(payload: UpdateNotificationPreferencesPayload): Promise<NotificationPreferencesResponse> {
    return api.patch<NotificationPreferencesResponse>('/agency/notification-preferences', payload);
  },

  /** POST /agency/devices — register (or refresh) this device's FCM token for push. */
  registerDevice(payload: RegisterDevicePayload): Promise<RegisterDeviceResponse> {
    return api.post<RegisterDeviceResponse>('/agency/devices', payload);
  },

  /** DELETE /agency/devices — unregister a push token (call on logout). */
  unregisterDevice(token: string): Promise<{ success: true; message?: string }> {
    return api.delete<{ success: true; message?: string }>('/agency/devices', { token });
  },
};
