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
  /** **Vendor** connections — the agency-side mirror of the vendor's own switch. */
  connectionUpdated: boolean;
  /**
   * **Agent** contracts (`agent_contract.*`): an agent applied to deliver for
   * you, answered a request you raised, or proposed a change to a contract they
   * already hold — `status_request_raised` / `status_request_resolved`, most
   * often asking to leave. A separate switch from `connectionUpdated` on purpose
   * — recruiting couriers and taking on vendors are different jobs, often
   * different people.
   */
  contractUpdated: boolean;
  shipmentAssigned: boolean;
  payoutUpdates: boolean;
  codDepositUpdates: boolean;
  /** Billing: plan nearing expiry / expired, or shipment soft-cap exceeded. */
  planUpdates: boolean;
  /** Media storage crossed 80 / 90 / 100% of the plan cap (`storage.alert`). */
  storageAlert: boolean;
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

/** Radio-group selection for the delivery channel: in-app only, or one secondary channel. */
export type DeliveryChannelChoice = 'in-app' | NotificationChannel;

/** Languages a notification can be rendered in. Lives on the agency profile. */
export type PreferredLanguage = 'en' | 'fr' | 'pt' | 'es' | 'ar';

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
