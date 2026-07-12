import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { vendorConnectionsService } from '@/services/vendor-connections.service';
import { ApiError } from '@/types/api';
import type { ConnectionDto } from '@/types/vendor-connection.types';

// ─── Polling — agency-side notifications for connection events aren't wired up
// on the backend yet ("agencies should poll"), so this context is the single
// source of truth for the pending-action count shown on the sidebar and the
// Vendors tab pill.

const POLL_INTERVAL_MS = 60_000;
const MAX_PAGES = 5; // 5 * 100 = 500 connections, a generous ceiling per status
const PAGE_LIMIT = 100;

async function fetchAllByStatus(status: 'pending' | 'paused_reapproval'): Promise<ConnectionDto[]> {
  const all: ConnectionDto[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= MAX_PAGES) {
    const { data, meta } = await vendorConnectionsService.list({ status, page, limit: PAGE_LIMIT });
    all.push(...data);
    totalPages = meta.totalPages;
    page += 1;
  }
  return all;
}

/** Only counts connections that need *our* action — not ones we're waiting on the vendor for. */
function countActionable(pending: ConnectionDto[], paused: ConnectionDto[]): number {
  const oursToApprove = pending.filter((c) => c.requesterRole === 'vendor').length;
  const oursToReapprove = paused.filter((c) => c.reapprovalRequiredFrom === 'agency').length;
  return oursToApprove + oursToReapprove;
}

export interface VendorConnectionsState {
  pendingActionCount: number;
  isLoading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

const VendorConnectionsContext = createContext<VendorConnectionsState | null>(null);

export function VendorConnectionsProvider({ children }: { children: ReactNode }) {
  const [pendingActionCount, setPendingActionCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef(false);

  const refetch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const [pending, paused] = await Promise.all([
        fetchAllByStatus('pending'),
        fetchAllByStatus('paused_reapproval'),
      ]);
      setPendingActionCount(countActionable(pending, paused));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError(500, 'VENDOR_CONNECTIONS_FETCH_FAILED', 'Failed to load vendor connections'),
      );
    } finally {
      setIsLoading(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    refetch();
    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      refetch();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refetch]);

  return (
    <VendorConnectionsContext.Provider value={{ pendingActionCount, isLoading, error, refetch }}>
      {children}
    </VendorConnectionsContext.Provider>
  );
}

export function useVendorConnections(): VendorConnectionsState {
  const ctx = useContext(VendorConnectionsContext);
  if (!ctx) throw new Error('useVendorConnections must be used within a VendorConnectionsProvider');
  return ctx;
}
