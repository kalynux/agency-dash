import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useActionRunner } from '@/hooks/useActionRunner';
import { assignmentSettingsService } from '@/services/assignment-settings.service';
import type { AgencyAssignmentSettings } from '@/types/assignment-settings.types';

/**
 * The agency's assignment preferences
 * (`GET` / `PATCH /api/agency/assignment-settings`): the standing auto-assignment
 * toggle and, since 2026-10-02, whether agents may propose delivery fees.
 *
 * The server is the only source of truth: when auto-assign is on, the backend
 * starts the auto-assignment broadcast itself for every shipment handed to the
 * agency, so nothing needs this page to be open. The values are shared
 * module-wide so the Settings switches and the Shipments status chip never
 * disagree.
 *
 * The PATCH is partial — each setter sends only its own key, so flipping one
 * switch can never write back a stale copy of the other.
 */
type Snapshot = {
  enabled: boolean | null;
  agentsCanProposeDeliveryFee: boolean | null;
  error: boolean;
};

let snapshot: Snapshot = { enabled: null, agentsCanProposeDeliveryFee: null, error: false };
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: Snapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

function publishSettings(data: AgencyAssignmentSettings) {
  publish({
    enabled: data.autoAssignEnabled,
    // A backend that predates the field omits it — the documented default is off.
    agentsCanProposeDeliveryFee: data.agentsCanProposeDeliveryFee ?? false,
    error: false,
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load(): Promise<void> {
  inFlight ??= assignmentSettingsService
    .get()
    .then((res) => publishSettings(res.data))
    .catch(() => publish({ ...snapshot, error: true }))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

const AUTO_ASSIGN_KEY = 'assignment-settings';
const AGENT_FEE_KEY = 'assignment-settings:agent-fee';

export function useAutoAssignSetting() {
  const { t } = useTranslation('settings');
  const state = useSyncExternalStore(subscribe, () => snapshot);
  const { run, isPending } = useActionRunner();

  // Refetch on every mount — another device may have changed it.
  useEffect(() => {
    void load();
  }, []);

  const setEnabled = useCallback(
    async (next: boolean) => {
      const result = await run(
        AUTO_ASSIGN_KEY,
        () => assignmentSettingsService.update({ autoAssignEnabled: next }),
        { success: next ? t('preferences.autoAssignOn') : t('preferences.autoAssignOff') },
      );
      if (result) publishSettings(result.data);
    },
    [run, t],
  );

  const setAgentsCanProposeDeliveryFee = useCallback(
    async (next: boolean) => {
      const result = await run(
        AGENT_FEE_KEY,
        () => assignmentSettingsService.update({ agentsCanProposeDeliveryFee: next }),
        {
          success: next
            ? t('preferences.agentFeeProposalsOn')
            : t('preferences.agentFeeProposalsOff'),
        },
      );
      if (result) publishSettings(result.data);
    },
    [run, t],
  );

  return {
    /** `null` until the first load resolves. */
    enabled: state.enabled,
    /** `null` until the first load resolves; `false` when the backend omits it. */
    agentsCanProposeDeliveryFee: state.agentsCanProposeDeliveryFee,
    loadError: state.error && state.enabled === null,
    saving: isPending(AUTO_ASSIGN_KEY),
    savingAgentFee: isPending(AGENT_FEE_KEY),
    reload: load,
    setEnabled,
    setAgentsCanProposeDeliveryFee,
  };
}
