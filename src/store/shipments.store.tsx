import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { shipmentsService } from '@/services/shipments.service';
import { ApiError } from '@/types/api';

// ─── Polling — surfaces a "needs attention" count (newly assigned + failed
// shipments) on the sidebar/mobile nav badge. Each check only asks for
// `limit: 1` since `meta.total` is all that's needed, not the rows themselves.

const POLL_INTERVAL_MS = 60_000;

async function countByStatus(status: 'assigned' | 'failed'): Promise<number> {
  const { meta } = await shipmentsService.list({ status, page: 1, limit: 1 });
  return meta.total;
}

export interface ShipmentsState {
  /** Newly assigned (awaiting pickup/reject) or failed (awaiting retry/return) shipments — need agency action. */
  activeCount: number;
  isLoading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

const ShipmentsContext = createContext<ShipmentsState | null>(null);

export function ShipmentsProvider({ children }: { children: ReactNode }) {
  const [activeCount, setActiveCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef(false);

  const refetch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const [assigned, failed] = await Promise.all([countByStatus('assigned'), countByStatus('failed')]);
      setActiveCount(assigned + failed);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError(500, 'SHIPMENTS_FETCH_FAILED', 'Failed to load shipments'),
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
    <ShipmentsContext.Provider value={{ activeCount, isLoading, error, refetch }}>
      {children}
    </ShipmentsContext.Provider>
  );
}

export function useShipments(): ShipmentsState {
  const ctx = useContext(ShipmentsContext);
  if (!ctx) throw new Error('useShipments must be used within a ShipmentsProvider');
  return ctx;
}
