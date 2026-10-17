import { useCallback, useEffect, useState } from 'react';
import { codCashService } from '@/services/cod-cash.service';
import { getApiErrorMessage } from '@/lib/errors';
import type { CodLimit } from '@/types/cod-cash.types';

export interface CodLimitState {
  limit: CodLimit | null;
  isLoading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
}

/**
 * `GET /agency/cod/limit`, fetched on mount and again whenever `refetchKey`
 * changes.
 *
 * The refetch matters more than it looks: the agency is **not notified** when
 * an administrator pauses or resumes its cash on delivery (`codRestricted`), so
 * the banner this read drives is the only way it finds out. The Cash page
 * passes its active tab as the key — the page stays mounted across tabs, and
 * each tab is a way of opening it.
 *
 * A failed reload keeps the last report rather than blanking it.
 *
 * Does not register with the page-refresh icon: Settings reads this too, and a
 * reload there would throw away an edit. The Cash page registers `reload` itself.
 */
export function useCodLimit(refetchKey?: unknown): CodLimitState {
  const [limit, setLimit] = useState<CodLimit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await codCashService.getCodLimit();
      setLimit(data);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refetchKey]);

  return { limit, isLoading, loadError, reload };
}
