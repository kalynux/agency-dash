// Messaging connections — see api-doc/connections/README.md.
//
// ONE mechanism connects ANY messaging channel to a platform account. It
// replaced two separate flows that disagreed on almost everything: WhatsApp's
// `/link:CODE` verification and Telegram's deep-link token. All seven of their
// endpoints are DELETED, not deprecated, and every one now answers 404.
//
// ─── The inversion that matters ───────────────────────────────────────────────
//
// The 6-character code is minted by the BOT, not by the platform. So the flow is
//
//     the user messages the bot  →  the bot replies with a code  →  the user
//     types it here
//
// and NOT "we give you a link to open", which is what the old flow did and what
// a UI built against it will still be shaped like. The user never carries a
// platform secret into a chat window, and the platform never has to trust a
// webhook's claim about who sent a message.
//
// ─── Two other things that changed with it ────────────────────────────────────
//
//   * Connections are NO LONGER PER-ROLE. They bind to the User, so somebody who
//     is both an agency and a customer connects once and it holds everywhere.
//     The old `update_other_roles` flag existed to paper over that and is gone.
//   * `wa: { verified, name }` was REMOVED from `GET /api/agency/profile`. This
//     is the one source for connection state now.

/** The channels a platform account can connect. Iterate the array — never hardcode two cards. */
export type MessagingChannel = 'whatsapp' | 'telegram';

/**
 * What to tell the user so they can get a code. Present **only** when
 * `connected` is `false`.
 */
export interface ConnectionInstructions {
  /** What to send the bot. `/connect` on both channels today. */
  command: string;
  /** e.g. `@JoviMallBot`. */
  botHandle: string;
  /**
   * Opens the chat. **May be `null`** when the bot is not configured
   * server-side — show `command` and `botHandle` as text then; the flow still
   * works for anyone who can find the bot.
   *
   * WhatsApp's pre-fills the message (`https://wa.me/<n>?text=%2Fconnect`).
   * Telegram's cannot — it only opens the chat and the user types the command.
   * So show the command next to the button on **both**.
   */
  deepLink: string | null;
}

/**
 * One channel's state. `GET /api/me/connections` returns every channel, connected
 * or not, so one call renders the whole screen.
 */
export interface MessagingConnection {
  channel: MessagingChannel;
  /** The only flag that decides Connect vs Disconnect. */
  connected: boolean;
  /** The WhatsApp profile name or Telegram display name. May be `null`. */
  displayName: string | null;
  /**
   * `••••1234` for WhatsApp, `@handle` for Telegram. **May be `null`** — render
   * `displayName` alone then.
   *
   * There is deliberately no phone number and no chat id anywhere in this
   * payload: the raw messaging identifier never leaves the backend. This hint is
   * all a settings screen needs, and it is not reversible.
   */
  identityHint: string | null;
  connectedAt: string | null;
  /** Present only while `connected` is `false`. */
  howToConnect?: ConnectionInstructions;
}

export interface ListConnectionsResponse {
  success: true;
  data: { connections: MessagingConnection[] };
}

/**
 * `POST /api/me/connections` — redeem a code.
 *
 * **The client does not say which channel it is redeeming.** The code carries
 * that, which is why this is one input box and one button rather than a pair of
 * per-channel forms.
 */
export interface RedeemConnectionPayload {
  /**
   * The 6-character code the bot replied with.
   *
   * **Send whatever the user typed.** Matching is case-insensitive and
   * forgiving: `a7k9p2`, `A7K9-P2` and `A7K9P2` are the same code, `O` is read
   * as `0`, and `I`/`L` as `1`. Do not normalise, uppercase or strip it in the
   * client — the server's rules are broader than any we would reimplement, and a
   * client-side "fix" can only ever turn a valid code into an invalid one.
   */
  code: string;
}

export interface RedeemConnectionResponse {
  success: true;
  /** The newly connected channel, in the same shape as a list entry. */
  data: MessagingConnection;
  message?: string;
}

export interface DisconnectConnectionResponse {
  success: true;
  data: null;
  message?: string;
}

// ─── Error codes worth branching on ───────────────────────────────────────────

/**
 * `EXPIRED` and `INVALID` are genuinely different and must read differently.
 *
 * Expiry is the common failure — somebody read the code, got distracted, came
 * back — and the fix is "send `/connect` again". `INVALID` means check what you
 * typed. Collapsing them into one message makes the common case unactionable.
 *
 * (The backend can only tell them apart for a limited window after expiry; an
 * ancient code reads as `INVALID`. That is correct rather than a bug — it is old
 * enough that a fresh one is the answer either way.)
 */
export const CONNECTION_CODE_EXPIRED = 'CONNECTION_CODE_EXPIRED';
export const CONNECTION_CODE_INVALID = 'CONNECTION_CODE_INVALID';

/**
 * That messaging account belongs to a **different** platform account.
 *
 * Ownership is never transferred silently. `details.channel` says which one.
 *
 * ⚠ The response says nothing about the other account — no email, no name, no
 * masked identifier — deliberately. Never present this as "this number belongs
 * to user X". The honest message is: this account is connected elsewhere;
 * disconnect it there first, or contact support.
 */
export const MESSAGING_IDENTITY_ALREADY_LINKED = 'MESSAGING_IDENTITY_ALREADY_LINKED';

/**
 * More than 5 redeem attempts in 10 minutes, **per account**.
 *
 * Distinct from `RATE_LIMIT_EXCEEDED`, which is 30/min **per IP** — a shared
 * office network can hit the second without any one person hitting the first.
 * Neither should be retried in a loop.
 */
export const CONNECTION_CODE_ATTEMPTS_EXCEEDED = 'CONNECTION_CODE_ATTEMPTS_EXCEEDED';

/** Nothing connected on that channel. */
export const MESSAGING_CONNECTION_NOT_FOUND = 'MESSAGING_CONNECTION_NOT_FOUND';

/**
 * A code is single-use **even when the redeem fails** — it is spent by the
 * attempt. So every one of these means "send `/connect` again for a fresh code",
 * never "retry with the same one".
 */
export const CODE_SPENDING_ERRORS: ReadonlySet<string> = new Set([
  CONNECTION_CODE_EXPIRED,
  CONNECTION_CODE_INVALID,
  MESSAGING_IDENTITY_ALREADY_LINKED,
]);
