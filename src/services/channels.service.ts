import { api } from './api';
import type {
  WhatsappLinkStatusResponse,
  WhatsappUnlinkResponse,
  WaVerificationResponse,
  TelegramStatusResponse,
  TelegramLinkTokenResponse,
  TelegramToggleResponse,
  TelegramDisconnectResponse,
} from '@/types/channel.types';

/**
 * WhatsApp account linking (role-scoped). See api-doc/whatsapp/README.md.
 *
 * The router is mounted at `/api/webhooks/whatsapp` — there is no `/api/whatsapp`
 * prefix. The two authenticated link routes share that prefix with the public
 * webhook, which also means they are exempt from rate limiting and stay
 * reachable during a maintenance window.
 */
export const whatsappService = {
  /** GET /webhooks/whatsapp/link/status — current WhatsApp link status for the active role. */
  getStatus(): Promise<WhatsappLinkStatusResponse> {
    return api.get<WhatsappLinkStatusResponse>('/webhooks/whatsapp/link/status');
  },

  /** DELETE /webhooks/whatsapp/link — unlink WhatsApp for the active role. */
  unlink(): Promise<WhatsappUnlinkResponse> {
    return api.delete<WhatsappUnlinkResponse>('/webhooks/whatsapp/link');
  },

  /**
   * POST /auth/request-wa-verification — start the WhatsApp verification flow.
   * Returns a `wa_link` (and `/link:CODE` command) the user opens in WhatsApp.
   */
  requestVerification(updateOtherRoles = false): Promise<WaVerificationResponse> {
    return api.post<WaVerificationResponse>('/auth/request-wa-verification', {
      update_other_roles: updateOtherRoles,
    });
  },
};

/** Telegram account linking & notifications. See api-doc/telegram/README.md. */
export const telegramService = {
  /** GET /webhooks/telegram/status — the caller's Telegram link status. */
  getStatus(): Promise<TelegramStatusResponse> {
    return api.get<TelegramStatusResponse>('/webhooks/telegram/status');
  },

  /** POST /webhooks/telegram/link-token — generate a deep-link + single-use token. */
  createLinkToken(): Promise<TelegramLinkTokenResponse> {
    return api.post<TelegramLinkTokenResponse>('/webhooks/telegram/link-token');
  },

  /** POST /webhooks/telegram/toggle — toggle Telegram notifications on/off (does not unlink). */
  toggle(): Promise<TelegramToggleResponse> {
    return api.post<TelegramToggleResponse>('/webhooks/telegram/toggle');
  },

  /** POST /webhooks/telegram/disconnect — unlink the Telegram account. */
  disconnect(): Promise<TelegramDisconnectResponse> {
    return api.post<TelegramDisconnectResponse>('/webhooks/telegram/disconnect');
  },
};
