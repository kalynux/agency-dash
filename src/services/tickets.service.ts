import { api } from './api';
import type {
  CreateTicketPayload,
  ListTicketsParams,
  ListTicketsResponse,
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

export const ticketsService = {
  /** POST /agency/tickets — create a support ticket. */
  create(payload: CreateTicketPayload): Promise<TicketResponse> {
    return api.post<TicketResponse>('/agency/tickets', payload);
  },

  /** GET /agency/tickets — list tickets visible to this agency. */
  list(params: ListTicketsParams = {}): Promise<ListTicketsResponse> {
    return api.get<ListTicketsResponse>(`/agency/tickets${buildQueryString(params as Record<string, unknown>)}`);
  },

  /** GET /agency/tickets/:id — full ticket detail (+ followers). */
  getById(id: string): Promise<TicketResponse> {
    return api.get<TicketResponse>(`/agency/tickets/${id}`);
  },

  /** PATCH /agency/tickets/:id — update subject and/or description. */
  update(id: string, body: { subject?: string; description?: string }): Promise<TicketResponse> {
    return api.patch<TicketResponse>(`/agency/tickets/${id}`, body);
  },

  /** PATCH /agency/tickets/:id/status — update ticket status. */
  updateStatus(id: string, status: TicketStatus): Promise<TicketResponse> {
    return api.patch<TicketResponse>(`/agency/tickets/${id}/status`, { status });
  },

  /** PATCH /agency/tickets/:id/priority — update ticket priority. */
  updatePriority(id: string, priority: TicketPriority): Promise<TicketResponse> {
    return api.patch<TicketResponse>(`/agency/tickets/${id}/priority`, { priority });
  },

  /** PATCH /agency/tickets/:id/assign — assign to a role (admin supports pool). */
  assign(id: string, targetRole: TicketRole, targetUserId?: string): Promise<TicketResponse> {
    return api.patch<TicketResponse>(`/agency/tickets/${id}/assign`, {
      targetRole,
      targetUserId: targetUserId ?? null,
    });
  },

  /** POST /agency/tickets/:id/close — close a ticket (creator or admin only). */
  close(id: string): Promise<TicketResponse> {
    return api.post<TicketResponse>(`/agency/tickets/${id}/close`);
  },

  /** GET /agency/tickets/:ticketId/notes — list notes visible to this agency. */
  listNotes(ticketId: string): Promise<ListTicketNotesResponse> {
    return api.get<ListTicketNotesResponse>(`/agency/tickets/${ticketId}/notes`);
  },

  /** POST /agency/tickets/:ticketId/notes — add a note. */
  addNote(
    ticketId: string,
    content: string,
    visibility: 'public' | 'private' = 'public',
    visibleToUserIds?: string[],
  ): Promise<TicketNoteResponse> {
    return api.post<TicketNoteResponse>(`/agency/tickets/${ticketId}/notes`, {
      content,
      visibility,
      ...(visibility === 'private' && visibleToUserIds?.length ? { visibleToUserIds } : {}),
    });
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
