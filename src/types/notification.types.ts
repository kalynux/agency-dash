// Agency Notifications — see api-doc/agency/notifications.md

export interface AgencyNotificationAction {
  label: string;
  /** App-relative deep link, e.g. "vendor-connections/66f0a1..." or "shipments/{id}". */
  path: string;
  url: string;
}

export interface AgencyNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  aggregateType: string;
  aggregateId: string;
  /** Null only when no deep-link base URL is configured server-side. */
  action: AgencyNotificationAction | null;
  isRead: boolean;
  deliveredVia: string[];
  createdAt: string;
}

export interface NotificationListMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
}

export interface ListNotificationsResponse {
  success: true;
  data: AgencyNotification[];
  unreadCount: number;
  meta: NotificationListMeta;
}

export interface NotificationMutationResponse {
  success: true;
  data: AgencyNotification;
  message?: string;
}

export interface MarkAllReadResponse {
  success: true;
  data: { count: number };
  message?: string;
}

// ─── Preferences ───────────────────────────────────────────────────────────────

/** Per-event on/off subscriptions. */
export interface NotificationEventPreferences {
  connectionUpdated: boolean;
  shipmentAssigned: boolean;
  payoutUpdates: boolean;
  codDepositUpdates: boolean;
}

export type NotificationEventKey = keyof NotificationEventPreferences;

export interface NotificationPreferences {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  telegramEnabled: boolean;
  whatsappEnabled: boolean;
  /** Computed live from account state — read-only. */
  emailVerified: boolean;
  telegramVerified: boolean;
  whatsappVerified: boolean;
  preferences: NotificationEventPreferences;
}

export interface NotificationPreferencesResponse {
  success: true;
  data: NotificationPreferences;
  message?: string;
}

export type NotificationChannel = 'email' | 'telegram' | 'whatsapp';

export interface UpdateNotificationPreferencesPayload {
  emailEnabled?: boolean;
  telegramEnabled?: boolean;
  whatsappEnabled?: boolean;
  preferences?: Partial<NotificationEventPreferences>;
}

// ─── Push devices (FCM) ─────────────────────────────────────────────────────────

export type DevicePlatform = 'web' | 'android' | 'ios';

export interface RegisterDevicePayload {
  token: string;
  platform: DevicePlatform;
  userAgent?: string;
}

export interface RegisterDeviceResponse {
  success: true;
  data: { id: string; platform: string; lastUsedAt: string };
  message?: string;
}
