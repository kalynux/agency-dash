// WhatsApp & Telegram account linking — see api-doc/whatsapp/README.md, api-doc/telegram/README.md
// NB: link-status endpoints now use the standard envelope (breaking change 2026-07-17).

// ─── WhatsApp ───────────────────────────────────────────────────────────────────

export interface WhatsappLinkStatus {
  linked: boolean;
  wa_phone_id?: string;
  name?: string;
  bound_at?: string;
}

export interface WhatsappLinkStatusResponse {
  success: true;
  data: WhatsappLinkStatus;
}

export interface WhatsappUnlinkResponse {
  success: true;
  message?: string;
}

/** POST /auth/request-wa-verification response. */
export interface WaVerificationData {
  code: string;
  command: string;
  wa_link: string;
  expires_in_seconds: number;
  instructions: string;
}

export interface WaVerificationResponse {
  success: true;
  data: WaVerificationData;
}

// ─── Telegram ───────────────────────────────────────────────────────────────────

export interface TelegramLinkStatus {
  linked: boolean;
  chatId?: string;
  telegramUserId?: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  isActive?: boolean;
  connectedAt?: string;
}

export interface TelegramStatusResponse {
  success: true;
  data: TelegramLinkStatus;
}

export interface TelegramLinkTokenResponse {
  success: true;
  data: { bot_url: string; expires_at: string };
}

export interface TelegramToggleResponse {
  success: true;
  data: { is_active: boolean };
}

export interface TelegramDisconnectResponse {
  success: true;
  data: null;
  message?: string;
}
