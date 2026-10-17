import { api } from './api';
import type {
  CreateTicketPayload,
  ListTicketsParams,
  ListTicketsResponse,
  TicketPagination,
  TicketResponse,
  TicketStatus,
  TicketPriority,
  TicketRole,
  TicketNoteResponse,
  ListTicketNotesResponse,
  TicketAttachmentResponse,
  ListTicketAttachmentsResponse,
  ListReferenceOrdersResponse,
  ListReferenceProductsResponse,
} from '@/types/ticket.types';

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

/**
 * Guarantee `id` on a ticket or note, whichever identifier the response carried.
 *
 * ⚠ **This is the whole reason the screens can chain actions.** A ticket's
 * `toJSON` deletes `_id` and exposes the `id` virtual, so the *write* endpoints
 * answer with `id` alone; only create/list/detail carry a duplicate `_id`,
 * because their enrichment path uses `toObject({ virtuals: true })` and applies
 * no transform. `TicketDetailSheet` replaces its state with the write response,
 * so a screen keying on `_id` loses the identifier on the first status change
 * and every following action posts to `/agency/tickets/undefined/…`.
 *
 * Normalising here rather than at each call site means there is one place to
 * delete when the backend stops sending `_id`. See api-doc/agency/tickets.md.
 */
function withId<T extends { id?: string; _id?: string }>(entity: T): T {
  return { ...entity, id: entity.id ?? entity._id ?? '' };
}

function normalizeTicket(res: TicketResponse): TicketResponse {
  return { ...res, data: withId(res.data) };
}

/**
 * The ticket list counts its pages in `totalPages`; the two reference lists on
 * the same router use `pages`. Read either, so the list's pager does not depend
 * on which spelling the backend settles on.
 */
function normalizePagination(raw: Partial<TicketPagination> & { totalPages?: number }): TicketPagination {
  return {
    total: raw.total ?? 0,
    page: raw.page ?? 1,
    limit: raw.limit ?? 20,
    pages: raw.pages ?? raw.totalPages ?? 1,
  };
}

export const ticketsService = {
  /** POST /agency/tickets — create a support ticket. */
  async create(payload: CreateTicketPayload): Promise<TicketResponse> {
    return normalizeTicket(await api.post<TicketResponse>('/agency/tickets', payload));
  },

  /**
   * GET /agency/tickets — every ticket this agency FOLLOWS, not only the ones it
   * opened. Since 2026-10-09 that includes each ticket about an order it
   * carries, whoever opened it; `createdByUserId` narrows to its own. Rows carry
   * no `followers`. See api-doc/agency/FRONTEND-CHANGELOG-ticket-followers.md.
   */
  async list(params: ListTicketsParams = {}): Promise<ListTicketsResponse> {
    const res = await api.get<ListTicketsResponse>(
      `/agency/tickets${buildQueryString(params as Record<string, unknown>)}`,
    );
    return { ...res, data: res.data.map(withId), pagination: normalizePagination(res.pagination) };
  },

  /**
   * GET /agency/tickets/:id — full ticket detail (+ followers).
   * `403 TICKET_ACCESS_DENIED` once an administrator has removed this agency
   * from the ticket's followers.
   */
  async getById(id: string): Promise<TicketResponse> {
    return normalizeTicket(await api.get<TicketResponse>(`/agency/tickets/${id}`));
  },

  // ⚠ The five writes below answer with the ticket document UN-ENRICHED:
  // `created_by`, `assigned_to`, `assigned_admin`, `entity` and `followers` are
  // added on create/list/detail only. Merge a write over the ticket already on
  // screen (`mergeTicketWrite`) rather than replacing it.

  /** PATCH /agency/tickets/:id — update subject and/or description. */
  async update(id: string, body: { subject?: string; description?: string }): Promise<TicketResponse> {
    return normalizeTicket(await api.patch<TicketResponse>(`/agency/tickets/${id}`, body));
  },

  /** PATCH /agency/tickets/:id/status — update ticket status. */
  async updateStatus(id: string, status: TicketStatus): Promise<TicketResponse> {
    return normalizeTicket(await api.patch<TicketResponse>(`/agency/tickets/${id}/status`, { status }));
  },

  /** PATCH /agency/tickets/:id/priority — update ticket priority. */
  async updatePriority(id: string, priority: TicketPriority): Promise<TicketResponse> {
    return normalizeTicket(await api.patch<TicketResponse>(`/agency/tickets/${id}/priority`, { priority }));
  },

  /** PATCH /agency/tickets/:id/assign — assign to a role (admin supports pool). */
  async assign(id: string, targetRole: TicketRole, targetUserId?: string): Promise<TicketResponse> {
    return normalizeTicket(
      await api.patch<TicketResponse>(`/agency/tickets/${id}/assign`, {
        targetRole,
        targetUserId: targetUserId ?? null,
      }),
    );
  },

  /**
   * POST /agency/tickets/:id/close — the one write that checks authorship, not
   * followership: `403 TICKET_ACCESS_DENIED` unless this agency opened the ticket.
   */
  async close(id: string): Promise<TicketResponse> {
    return normalizeTicket(await api.post<TicketResponse>(`/agency/tickets/${id}/close`));
  },

  /** GET /agency/tickets/:ticketId/notes — list notes visible to this agency. */
  async listNotes(ticketId: string): Promise<ListTicketNotesResponse> {
    const res = await api.get<ListTicketNotesResponse>(`/agency/tickets/${ticketId}/notes`);
    return { ...res, data: res.data.map(withId) };
  },

  /** POST /agency/tickets/:ticketId/notes — add a note. */
  async addNote(
    ticketId: string,
    content: string,
    visibility: 'public' | 'private' = 'public',
    visibleToUserIds?: string[],
  ): Promise<TicketNoteResponse> {
    const res = await api.post<TicketNoteResponse>(`/agency/tickets/${ticketId}/notes`, {
      content,
      visibility,
      ...(visibility === 'private' && visibleToUserIds?.length ? { visibleToUserIds } : {}),
    });
    return { ...res, data: withId(res.data) };
  },

  /** GET /agency/tickets/:ticketId/attachments — list attachments. */
  listAttachments(ticketId: string): Promise<ListTicketAttachmentsResponse> {
    return api.get<ListTicketAttachmentsResponse>(`/agency/tickets/${ticketId}/attachments`);
  },

  /** POST /agency/tickets/:ticketId/attachments — attach an already-uploaded file. */
  addAttachment(
    ticketId: string,
    fileId: string,
    visibility: 'PUBLIC' | 'PRIVATE' = 'PUBLIC',
    visibleToUserIds?: string[],
  ): Promise<TicketAttachmentResponse> {
    return api.post<TicketAttachmentResponse>(`/agency/tickets/${ticketId}/attachments`, {
      fileId,
      visibility,
      ...(visibility === 'PRIVATE' && visibleToUserIds?.length ? { visibleToUserIds } : {}),
    });
  },

  /** GET /agency/tickets/reference/orders — orders this agency can reference. */
  referenceOrders(params: { page?: number; limit?: number; q?: string } = {}): Promise<ListReferenceOrdersResponse> {
    return api.get<ListReferenceOrdersResponse>(
      `/agency/tickets/reference/orders${buildQueryString(params as Record<string, unknown>)}`,
    );
  },

  /** GET /agency/tickets/reference/products — products this agency can reference. */
  referenceProducts(params: { page?: number; limit?: number; q?: string } = {}): Promise<ListReferenceProductsResponse> {
    return api.get<ListReferenceProductsResponse>(
      `/agency/tickets/reference/products${buildQueryString(params as Record<string, unknown>)}`,
    );
  },
};
