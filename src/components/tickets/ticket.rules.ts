// ─── Agency Tickets — the rules the screens branch on ─────────────────────────
//
// Since 2026-10-09 an agency follows every ticket about an order it carries, so
// most of what the detail sheet used to assume ("this is my ticket") is now a
// question with two answers. The answers live here, as pure functions, so they
// are testable without rendering anything.
// See api-doc/agency/FRONTEND-CHANGELOG-ticket-followers.md.
//
// No copy and no i18n in this module — it returns roles and tokens, and the
// components turn them into words.

import type {
  Ticket, TicketActor, TicketAdminSnapshot, TicketRole, TicketStatus,
} from '@/types/ticket.types';

// ─── People ───────────────────────────────────────────────────────────────────

/**
 * An actor's name when it is worth showing, else `null` (say the role instead).
 *
 * Two values mean "we have no name": `''` — a vendor or agency with neither a
 * display name nor a store/magazin — and the capitalised role (`"Vendor"`),
 * which is what an unresolved reference falls back to and would otherwise show
 * up untranslated beside its own role label.
 */
export function actorName(actor: Pick<TicketActor, 'name' | 'role'> | null | undefined): string | null {
  const name = actor?.name?.trim();
  if (!name) return null;
  return name.toLowerCase() === actor?.role?.toLowerCase() ? null : name;
}

export interface TicketOpener {
  role: string;
  /** `null` when there is no usable name — show the role label. */
  name: string | null;
  /** The resolved actor, for the avatar and the verified badge. `null` for support/platform. */
  actor: TicketActor | null;
  /** Set when an administrator or the platform opened the ticket. */
  admin: TicketAdminSnapshot | null;
}

/**
 * Who opened the ticket. Reads `created_by_admin` first: on a ticket support or
 * the platform opened, `created_by` is also there but names nobody this app can
 * resolve.
 */
export function ticketOpener(ticket: Ticket): TicketOpener {
  const admin = ticket.created_by_admin ?? null;
  if (admin) {
    return { role: 'admin', name: admin.name?.trim() || null, actor: null, admin };
  }
  const actor = ticket.created_by ?? null;
  return {
    role: actor?.role ?? ticket.created_by_role,
    name: actorName(actor),
    actor,
    admin: null,
  };
}

/**
 * Whether the signed-in user opened this ticket — the only non-admin who may
 * close it. Any other follower gets `403 TICKET_ACCESS_DENIED` from
 * `POST /:id/close`.
 */
export function isTicketCreator(ticket: Pick<Ticket, 'created_by_user_id'>, userId: string | null | undefined): boolean {
  return !!userId && !!ticket.created_by_user_id && String(ticket.created_by_user_id) === String(userId);
}

/**
 * A follower's display name. The platform's own follower row (it follows the
 * tickets it opens) resolves to nothing, so it borrows the opener's snapshot.
 */
export function followerName(follower: TicketActor, ticket: Ticket): string | null {
  if (
    follower.role === 'admin' &&
    ticket.created_by_admin &&
    String(follower.user_id) === String(ticket.created_by_user_id)
  ) {
    return ticket.created_by_admin.name?.trim() || null;
  }
  return actorName(follower);
}

// ─── Status ───────────────────────────────────────────────────────────────────

/** The follower role a `waiting_on_<role>` status needs on the ticket. */
const WAITING_ROLE: Partial<Record<TicketStatus, TicketRole>> = {
  waiting_on_admin: 'admin',
  waiting_on_vendor: 'vendor',
  waiting_on_customer: 'customer',
  waiting_on_agency: 'agency',
  waiting_on_agent: 'agent',
};

/**
 * The statuses to offer in the detail control, in `all`'s order.
 *
 * - `waiting_on_<role>` only when `followers` holds that role — the backend
 *   answers `400 TICKET_WAITING_TARGET_NOT_PARTICIPANT` otherwise.
 *   `waiting_on_admin` is always allowed: support is implicit.
 * - `closed` only for the ticket's creator.
 * - The ticket's current status always, whatever the rules say, so the control
 *   can display where the ticket is.
 */
export function offerableStatuses(
  all: readonly TicketStatus[],
  current: TicketStatus,
  followers: readonly Pick<TicketActor, 'role'>[],
  isCreator: boolean,
): TicketStatus[] {
  const roles = new Set(followers.map((f) => f.role));
  return all.filter((status) => {
    if (status === current) return true;
    if (status === 'closed') return isCreator;
    const needs = WAITING_ROLE[status];
    return !needs || needs === 'admin' || roles.has(needs);
  });
}

// ─── Write responses ──────────────────────────────────────────────────────────

/**
 * Apply a write response to the ticket on screen.
 *
 * Status, priority, assign, close and the subject/description `PATCH` all answer
 * with the bare document: no `created_by`, `assigned_to`, `assigned_admin`,
 * `entity` or `followers`. Replacing state with it wipes the followers list —
 * and with it the waiting-status options and the private-note recipients — so
 * the resolved blocks are carried over from what was already loaded.
 *
 * `created_by_admin` is the one block a write does carry, in its internal form;
 * the copy already on screen is the one meant for a follower, so it wins.
 */
export function mergeTicketWrite(current: Ticket, written: Ticket): Ticket {
  return {
    ...current,
    ...written,
    created_by: written.created_by ?? current.created_by,
    created_by_admin: current.created_by_admin ?? null,
    assigned_to: written.assigned_to ?? current.assigned_to,
    assigned_admin: written.assigned_admin ?? current.assigned_admin,
    entity: written.entity ?? current.entity,
    followers: written.followers ?? current.followers,
  };
}

// ─── System notes ─────────────────────────────────────────────────────────────

/**
 * What a system note (`is_system_note: true`) records, recovered from its text.
 *
 * The backend writes these as fixed English sentences — one of them embeds a raw
 * user id — so they are parsed into an event and re-worded in the reader's
 * language. Anything unrecognised (payout, refund and earnings notes are free
 * text) returns `null` and is shown as written.
 */
export type SystemNoteEvent =
  | { kind: 'follower_added'; role: string }
  | { kind: 'follower_removed' }
  | { kind: 'status_changed'; from: string; to: string }
  | { kind: 'priority_changed'; from: string; to: string; locked: boolean }
  | { kind: 'assigned'; role: string }
  | { kind: 'assigned_admin'; name: string; by: string | null }
  | { kind: 'closed' }
  | { kind: 'reopened' };

export function parseSystemNote(content: string): SystemNoteEvent | null {
  const text = content.trim();
  let m: RegExpExecArray | null;

  if ((m = /^User added as follower \(Role: (\w+)\)$/.exec(text))) {
    return { kind: 'follower_added', role: m[1] };
  }
  if (text === 'User removed from followers') return { kind: 'follower_removed' };
  if ((m = /^Status changed from "([^"]+)" to "([^"]+)"$/.exec(text))) {
    return { kind: 'status_changed', from: m[1], to: m[2] };
  }
  if ((m = /^Priority changed from "([^"]+)" to "([^"]+)"( and locked by admin)?$/.exec(text))) {
    return { kind: 'priority_changed', from: m[1], to: m[2], locked: !!m[3] };
  }
  if ((m = /^Assigned to (admin|vendor|customer|agency|agent) (?:pool|\(User ID: [^)]*\))$/.exec(text))) {
    return { kind: 'assigned', role: m[1] };
  }
  if ((m = /^Assigned to (.+) by (.+)$/.exec(text))) {
    return { kind: 'assigned_admin', name: m[1], by: m[2] };
  }
  if ((m = /^Claimed by (.+)$/.exec(text))) {
    return { kind: 'assigned_admin', name: m[1], by: null };
  }
  if (text === 'Ticket closed') return { kind: 'closed' };
  if (text === 'Ticket reopened by admin') return { kind: 'reopened' };
  return null;
}
