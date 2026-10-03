// Agency assignment preferences — see api-doc/agency/assignment.md § settings.
//
// Lives apart from shipment.types.ts on purpose: these are agency-wide
// preferences, not shipment data. The older `AssignmentSettings` in
// shipment.types.ts predates `agentsCanProposeDeliveryFee`.

export interface AgencyAssignmentSettings {
  /** Standing auto-assignment participation. `false` when never set. */
  autoAssignEnabled: boolean;
  /**
   * Since 2026-10-02. When on, the agent holding a shipment's accepted offer may
   * propose a different delivery fee for it; the proposal goes straight to the
   * vendor, and the agency sees it and may edit it. The agency itself can always
   * propose. `false` when never set — and treat a missing field (an older
   * backend) as `false` too.
   */
  agentsCanProposeDeliveryFee: boolean;
}

export interface AgencyAssignmentSettingsResponse {
  success: true;
  data: AgencyAssignmentSettings;
  message?: string;
}

/**
 * `PATCH /api/agency/assignment-settings` is partial: send one field or both,
 * never none (`{}` is `400 VALIDATION_ERROR`). An omitted field is left as is.
 */
export type UpdateAssignmentSettingsPayload =
  | { autoAssignEnabled: boolean; agentsCanProposeDeliveryFee?: boolean }
  | { autoAssignEnabled?: boolean; agentsCanProposeDeliveryFee: boolean };
