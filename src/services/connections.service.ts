// Messaging connections — `/api/me/connections`.
//
// This file replaces `channels.service.ts`, whose seven calls all answered 404:
// the authenticated link routes under `/api/webhooks/*` were deleted, and
// `POST /api/auth/request-wa-verification` with them. What survives at those
// prefixes is exactly `POST /api/webhooks/whatsapp/` and
// `POST /api/webhooks/telegram/webhook` — inbound provider webhooks that no
// client of this app can call.
//
// | Gone                                       | Replacement                          |
// |--------------------------------------------|--------------------------------------|
// | `GET  /webhooks/whatsapp/link/status`      | `GET    /api/me/connections`         |
// | `DELETE /webhooks/whatsapp/link`           | `DELETE /api/me/connections/whatsapp`|
// | `POST /auth/request-wa-verification`       | `POST   /api/me/connections`         |
// | `GET  /webhooks/telegram/status`           | `GET    /api/me/connections`         |
// | `POST /webhooks/telegram/link-token`       | `GET    /api/me/connections`         |
// | `POST /webhooks/telegram/toggle`           | nothing — see below                  |
// | `POST /webhooks/telegram/disconnect`       | `DELETE /api/me/connections/telegram`|
//
// ⚠ `telegram/toggle` has **no replacement and needs none**. It was a third
// switch that muted delivery *and* made `telegramVerified` report `false`, so a
// connected user's settings screen offered them "Connect" again. `telegramEnabled`
// in notification preferences is now the only mute, exactly as WhatsApp already
// worked.
//
// Auth is any role — the connection binds to the **User**, not the role entity.
// See api-doc/connections/README.md and api-doc/MIGRATION-2026-08.md § 1.

import { api } from './api';
import type {
  DisconnectConnectionResponse,
  ListConnectionsResponse,
  MessagingChannel,
  MessagingConnection,
  RedeemConnectionResponse,
} from '@/types/connection.types';

export const connectionsService = {
  /**
   * GET /me/connections — every channel, connected or not, in one call.
   *
   * Enough to render the whole screen: each unconnected entry carries a
   * `howToConnect` telling the user which bot to message and what to send.
   */
  async list(): Promise<MessagingConnection[]> {
    const res = await api.get<ListConnectionsResponse>('/me/connections');
    return res.data.connections;
  },

  /**
   * POST /me/connections — redeem the 6-character code the bot replied with.
   *
   * Pass the raw user input. Matching is case-insensitive and forgiving
   * (`O`→`0`, `I`/`L`→`1`, punctuation ignored), and normalising client-side can
   * only turn a code the server would have accepted into one it will not.
   *
   * **No channel is sent** — the code carries it. Re-connecting *replaces*: a
   * code for a different WhatsApp number simply wins, with no "disconnect first"
   * step. Redeeming an identity already on this account is an idempotent 200.
   */
  async redeem(code: string): Promise<MessagingConnection> {
    const res = await api.post<RedeemConnectionResponse>('/me/connections', { code });
    return res.data;
  },

  /**
   * DELETE /me/connections/:channel — disconnect one channel.
   *
   * `404 MESSAGING_CONNECTION_NOT_FOUND` when nothing is connected there, which
   * for a screen rendered off {@link list} means the state was stale — refetch
   * rather than surfacing it as a failure.
   */
  disconnect(channel: MessagingChannel): Promise<DisconnectConnectionResponse> {
    return api.delete<DisconnectConnectionResponse>(`/me/connections/${channel}`);
  },
};
