import { api } from './api';
import {
  CLOSURE_CONFIRM_PHRASE,
  type ClosureRequestMutationResponse,
  type ClosureRequestResponse,
} from '@/types/role-closure.types';

/**
 * Answering an administrator's request to close this agency account
 * (api-doc/me/role-closure.md). The role is taken from the SESSION — nothing in
 * the path or body ever names a user or a role.
 */
export const roleClosureService = {
  /** GET /me/closure-request — the pending request, or `data: null`. */
  get(): Promise<ClosureRequestResponse> {
    return api.get<ClosureRequestResponse>('/me/closure-request');
  },

  /**
   * POST /me/closure-request/confirm. Irreversible. Blockers are re-checked
   * server-side first (`422 ROLE_CLOSURE_BLOCKED`, `details.blockers`).
   *
   * On success the session cookies are already cleared — the caller must end
   * the session locally and not make another authenticated call.
   */
  confirm(): Promise<ClosureRequestMutationResponse> {
    return api.post<ClosureRequestMutationResponse>('/me/closure-request/confirm', {
      confirm: CLOSURE_CONFIRM_PHRASE,
    });
  },

  /** POST /me/closure-request/decline — nothing about the agency changes. */
  decline(note?: string): Promise<ClosureRequestMutationResponse> {
    const trimmed = note?.trim();
    return api.post<ClosureRequestMutationResponse>(
      '/me/closure-request/decline',
      trimmed ? { note: trimmed } : {},
    );
  },
};
