import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useActionRunner } from '@/hooks/useActionRunner';
import { shipmentsService } from '@/services/shipments.service';

/**
 * The agency's standing auto-assignment toggle
 * (`GET` / `PATCH /api/agency/assignment-settings`).
 *
 * The server is the only source of truth: when it is on, the backend starts the
 * auto-assignment broadcast itself for every shipment handed to the agency, so
 * nothing needs this page to be open. The value is shared module-wide so the
 * Settings switch and the Shipments status chip never disagree.
 */
type Snapshot = { enabled: boolean | null; error: boolean };

let snapshot: Snapshot = { enabled: null, error: false };
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: Snapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load(): Promise<void> {
  inFlight ??= shipmentsService
    .getAssignmentSettings()
    .then((res) => publish({ enabled: res.data.autoAssignEnabled, error: false }))
    .catch(() => publish({ ...snapshot, error: true }))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function useAutoAssignSetting() {
  const { t } = useTranslation('settings');
  const state = useSyncExternalStore(subscribe, () => snapshot);
  const { run, isBusy } = useActionRunner();

  // Refetch on every mount — another device may have changed it.
  useEffect(() => {
    void load();
  }, []);

  const setEnabled = useCallback(
    async (next: boolean) => {
      const result = await run(
        'assignment-settings',
        () => shipmentsService.updateAssignmentSettings(next),
        { success: next ? t('preferences.autoAssignOn') : t('preferences.autoAssignOff') },
      );
      if (result) publish({ enabled: result.data.autoAssignEnabled, error: false });
    },
    [run, t],
  );

  return {
    /** `null` until the first load resolves. */
    enabled: state.enabled,
    loadError: state.error && state.enabled === null,
    saving: isBusy,
    reload: load,
    setEnabled,
  };
}
