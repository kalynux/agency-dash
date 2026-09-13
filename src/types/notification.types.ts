// Agency Notifications — see api-doc/agency/notifications.md

/**
 * The button on a notification. `action: null` is a real state — render no
 * button, and do not invent a destination (deep-links.md rule 5).
 */
export interface AgencyNotificationAction {
  /**
   * The button's text, **already translated into the recipient's language**.
   * Render it; never write your own, or a French agency reads an English
   * button.
   */
  label: string;
  /**
   * The deep-link LABEL — `shipments/{id}`, `plans`. Not a route: the backend
   * does not know this app's routes and never will. Resolve it through
   * `resolveDeepLink`. See api-doc/notifications/deep-links.md § Agency.
   */
  path: string;
  /**
   * `path` glued onto `AGENCY_APP_URL`, for the channels that can only carry a
   * link (email, WhatsApp, Telegram). **Optional** — the in-app inbox row
   * carries it only sometimes.
   *
   * Route on `path` wherever you have it; this is the fallback for the one case
   * where you do not.
   */
  url?: string;
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
   * **Agent** contracts (`agent_contract.*`) — eight situations behind one
   * switch, deep-linking to `agents/{contractId}`:
   *
   * - the handshake: `request_received`, `approved`, `rejected`;
   * - changes to a contract that exists: `status_request_raised` /
   *   `status_request_resolved`, most often asking to leave;
   * - changes to the **terms**: `terms_countered` (they countered a pending
   *   offer — the right to accept is now yours), `terms_proposed` (a change to a
   *   live contract, whose current terms stay in force until you answer) and
   *   `terms_resolved`.
   *
   * A separate switch from `connectionUpdated` on purpose — recruiting couriers
   * and taking on vendors are different jobs, often different people.
   */
  contractUpdated: boolean;
  shipmentAssigned: boolean;
  payoutUpdates: boolean;
  codDepositUpdates: boolean;
  /** Billing: plan nearing expiry / expired, or shipment soft-cap exceeded. */
  planUpdates: boolean;
  /**
   * **Media-file quota.** Product images and delivery proofs crossed 80 / 90 / 100%
   * of the plan cap (`storage.alert`). Nothing to do with warehousing — see
   * {@link NotificationEventPreferences.stockRequestUpdates}, which shares only the
   * word "storage".
   */
  storageAlert: boolean;
  /**
   * **Physical goods on our shelves.** A stock adjustment on a SKU we warehouse:
   * the vendor proposed a quantity (ours to answer), or answered one we proposed —
   * `storage.stock_request.received` / `.approved` / `.rejected`. Nothing fires for
   * `withdrawn`.
   *
   * Switching it off silences the push, **not the obligation**: a vendor's request
   * still sits in the inbox awaiting an answer, the same way opting out of
   * `codDepositUpdates` does not stop the deposit clock. Label it distinctly from
   * `storageAlert` above or an agency will switch off the wrong one.
   */
  stockRequestUpdates: boolean;
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
