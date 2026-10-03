import { api } from './api';
import type {
  AgencyAssignmentSettingsResponse,
  UpdateAssignmentSettingsPayload,
} from '@/types/assignment-settings.types';

/**
 * The agency's assignment preferences (api-doc/agency/assignment.md § settings).
 *
 * Supersedes `shipmentsService.getAssignmentSettings` / `updateAssignmentSettings`,
 * which only know `autoAssignEnabled` and always send it.
 */
export const assignmentSettingsService = {
  /** GET /agency/assignment-settings — the stored preferences. */
  get(): Promise<AgencyAssignmentSettingsResponse> {
    return api.get<AgencyAssignmentSettingsResponse>('/agency/assignment-settings');
  },

  /**
   * PATCH /agency/assignment-settings — partial update. Send only the field the
   * user changed, so one switch can never overwrite the other with a stale value.
   */
  update(payload: UpdateAssignmentSettingsPayload): Promise<AgencyAssignmentSettingsResponse> {
    return api.patch<AgencyAssignmentSettingsResponse>('/agency/assignment-settings', payload);
  },
};
