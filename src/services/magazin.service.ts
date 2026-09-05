import { api } from './api';
import type {
  AgencyMagazin,
  MagazinUpdatePayload,
  MagazinResponse,
} from '@/types/magazin.types';

/**
 * Agency magazin (business identity) management. See api-doc/agency/magazin.md.
 * The magazin is auto-provisioned on first access, so `getMagazin` never 404s
 * for a valid agency. `updateMagazin` uses optimistic locking — a stale
 * `version` returns `409 MAGAZIN_CONFLICT`; refresh and retry.
 */
export const magazinService = {
  /** GET /agency/magazin — the authenticated agency's business identity. */
  async getMagazin(): Promise<AgencyMagazin> {
    const res = await api.get<MagazinResponse>('/agency/magazin');
    return res.data;
  },

  /** PATCH /agency/magazin — partial update; `version` is required. */
  async updateMagazin(payload: MagazinUpdatePayload): Promise<AgencyMagazin> {
    const res = await api.patch<MagazinResponse>('/agency/magazin', payload);
    return res.data;
  },
};
