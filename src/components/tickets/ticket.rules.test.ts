/**
 * The follower rules of 2026-10-09 (api-doc/agency/FRONTEND-CHANGELOG-ticket-followers.md).
 *
 * An agency now receives tickets it did not open, so "may I close this", "whom
 * may I wait on" and "who opened it" each have more than one answer. The system
 * note sentences are pinned against the backend's own strings
 * (`jovi-mall/src/modules/tickets/services/`): if one is reworded there, the
 * timeline falls back to the raw English text, and this is where that shows.
 */
import { describe, it, expect } from 'vitest';
import {
  actorName, followerName, isTicketCreator, mergeTicketWrite, offerableStatuses,
  parseSystemNote, ticketOpener,
} from './ticket.rules';
import type { Ticket, TicketActor, TicketStatus } from '@/types/ticket.types';

const ME = '665f1f77bcf86cd799439011';
const SYSTEM = '000000000000000000000001';

const ALL: TicketStatus[] = [
  'open', 'in_progress', 'waiting_on_admin', 'waiting_on_vendor', 'waiting_on_customer',
  'waiting_on_agency', 'waiting_on_agent', 'resolved', 'closed',
];

function actor(role: string, name: string, user_id = `${role}-id`): TicketActor {
  return { user_id, role, name, avatar: null };
}

function ticket(over: Partial<Ticket> = {}): Ticket {
  return {
    id: 't1',
    subject: 'Parcel arrived damaged',
    description: 'The box was crushed.',
    type: 'ORDER_ISSUE',
    importance: 'high',
    priority: 'normal',
    status: 'open',
    entity_type: 'ORDER',
    entity_id: 'o1',
    entity: { type: 'ORDER', id: 'o1', label: 'Order ORD-1', reference: 'ORD-1' },
    created_by_user_id: 'customer-id',
    created_by_role: 'customer',
    created_by: actor('customer', 'Jane Doe'),
    assigned_to_role: null,
    assigned_to: null,
    assigned_admin: null,
    priority_locked: false,
    followers: [actor('customer', 'Jane Doe'), actor('vendor', 'Acme Store'), actor('agency', 'FastTrack', ME)],
    createdAt: '2026-10-09T10:00:00.000Z',
    updatedAt: '2026-10-09T10:00:00.000Z',
    ...over,
  };
}

describe('actorName', () => {
  it('keeps a real name', () => {
    expect(actorName(actor('vendor', 'Acme Store'))).toBe('Acme Store');
  });

  it('treats an empty name and the unresolved-role fallback as no name', () => {
    expect(actorName(actor('agency', ''))).toBeNull();
    expect(actorName(actor('vendor', 'Vendor'))).toBeNull();
    expect(actorName(null)).toBeNull();
  });
});

describe('ticketOpener', () => {
  it('names the customer, vendor or agent who opened it', () => {
    expect(ticketOpener(ticket())).toMatchObject({ role: 'customer', name: 'Jane Doe', admin: null });
  });

  it('reads the platform from created_by_admin, not from created_by', () => {
    const opener = ticketOpener(
      ticket({
        created_by_user_id: SYSTEM,
        created_by_role: 'admin',
        created_by: actor('admin', 'Wi-Mall (automatic)', SYSTEM),
        created_by_admin: { name: 'Wi-Mall (automatic)', job_title: null, department: null, avatar_url: null },
      }),
    );
    expect(opener).toMatchObject({ role: 'admin', name: 'Wi-Mall (automatic)', actor: null });
    expect(opener.admin).not.toBeNull();
  });

  it('falls back to the creator role when the actor block is missing', () => {
    expect(ticketOpener(ticket({ created_by: null }))).toMatchObject({ role: 'customer', name: null });
  });
});

describe('isTicketCreator', () => {
  it('is true only for the signed-in user who opened it', () => {
    expect(isTicketCreator(ticket({ created_by_user_id: ME }), ME)).toBe(true);
    expect(isTicketCreator(ticket(), ME)).toBe(false);
  });

  it('is false while the session is unknown', () => {
    expect(isTicketCreator(ticket({ created_by_user_id: ME }), null)).toBe(false);
    expect(isTicketCreator(ticket({ created_by_user_id: ME }), undefined)).toBe(false);
  });
});

describe('followerName', () => {
  it('gives the platform follower its snapshot name', () => {
    const t = ticket({
      created_by_user_id: SYSTEM,
      created_by_role: 'admin',
      created_by_admin: { name: 'Wi-Mall (automatic)', job_title: null, department: null, avatar_url: null },
    });
    // The enrichment cannot resolve the system actor, so it arrives as "Admin".
    expect(followerName(actor('admin', 'Admin', SYSTEM), t)).toBe('Wi-Mall (automatic)');
    expect(followerName(actor('vendor', 'Acme Store'), t)).toBe('Acme Store');
  });
});

describe('offerableStatuses', () => {
  const followers = [actor('customer', 'Jane'), actor('agency', 'FastTrack', ME)];

  it('offers a waiting status only for a role that follows the ticket', () => {
    const offered = offerableStatuses(ALL, 'open', followers, false);
    expect(offered).toContain('waiting_on_customer');
    expect(offered).toContain('waiting_on_agency');
    expect(offered).not.toContain('waiting_on_vendor');
    expect(offered).not.toContain('waiting_on_agent');
  });

  it('always offers waiting on support', () => {
    expect(offerableStatuses(ALL, 'open', [], false)).toContain('waiting_on_admin');
  });

  it('offers closed to the creator only', () => {
    expect(offerableStatuses(ALL, 'open', followers, false)).not.toContain('closed');
    expect(offerableStatuses(ALL, 'open', followers, true)).toContain('closed');
  });

  it('keeps the current status even when it could not be chosen', () => {
    expect(offerableStatuses(ALL, 'waiting_on_vendor', followers, false)).toContain('waiting_on_vendor');
    expect(offerableStatuses(ALL, 'closed', followers, false)).toContain('closed');
  });
});

describe('mergeTicketWrite', () => {
  it('keeps the resolved blocks a write response does not carry', () => {
    const current = ticket();
    // What PATCH /:id/status actually answers with: the bare document.
    const written = {
      id: 't1',
      status: 'in_progress',
      created_by_user_id: 'customer-id',
      updatedAt: '2026-10-09T11:00:00.000Z',
    } as Ticket;

    const merged = mergeTicketWrite(current, written);
    expect(merged.status).toBe('in_progress');
    expect(merged.updatedAt).toBe('2026-10-09T11:00:00.000Z');
    expect(merged.followers).toHaveLength(3);
    expect(merged.created_by?.name).toBe('Jane Doe');
    expect(merged.entity?.reference).toBe('ORD-1');
  });

  it('does not swap the public admin snapshot for the internal one', () => {
    const publicSnapshot = { name: 'Wi-Mall (automatic)', job_title: null, department: null, avatar_url: null };
    const current = ticket({ created_by_admin: publicSnapshot });
    const written = {
      id: 't1',
      status: 'resolved',
      created_by_admin: { ...publicSnapshot, id: SYSTEM, source: 'admin', tier: 1 },
    } as unknown as Ticket;

    expect(mergeTicketWrite(current, written).created_by_admin).toBe(publicSnapshot);
  });
});

describe('parseSystemNote', () => {
  it('reads the note left when a party joins later', () => {
    expect(parseSystemNote('User added as follower (Role: agency)')).toEqual({
      kind: 'follower_added',
      role: 'agency',
    });
  });

  it('reads removals, status and priority changes', () => {
    expect(parseSystemNote('User removed from followers')).toEqual({ kind: 'follower_removed' });
    expect(parseSystemNote('Status changed from "open" to "waiting_on_vendor"')).toEqual({
      kind: 'status_changed',
      from: 'open',
      to: 'waiting_on_vendor',
    });
    expect(parseSystemNote('Priority changed from "normal" to "urgent" and locked by admin')).toEqual({
      kind: 'priority_changed',
      from: 'normal',
      to: 'urgent',
      locked: true,
    });
    expect(parseSystemNote('Priority changed from "normal" to "high"')).toMatchObject({ locked: false });
  });

  it('reads assignments without surfacing the raw user id', () => {
    expect(parseSystemNote('Assigned to admin pool')).toEqual({ kind: 'assigned', role: 'admin' });
    expect(parseSystemNote(`Assigned to agent (User ID: ${ME})`)).toEqual({ kind: 'assigned', role: 'agent' });
    expect(parseSystemNote('Assigned to Kofi Mensah by Ama Owusu')).toEqual({
      kind: 'assigned_admin',
      name: 'Kofi Mensah',
      by: 'Ama Owusu',
    });
    expect(parseSystemNote('Claimed by Kofi Mensah')).toEqual({
      kind: 'assigned_admin',
      name: 'Kofi Mensah',
      by: null,
    });
  });

  it('reads close and reopen', () => {
    expect(parseSystemNote('Ticket closed')).toEqual({ kind: 'closed' });
    expect(parseSystemNote('Ticket reopened by admin')).toEqual({ kind: 'reopened' });
  });

  it('returns null for free-text notes, which are shown as written', () => {
    expect(parseSystemNote('The earnings of this order are paused while this request is open.')).toBeNull();
  });
});
