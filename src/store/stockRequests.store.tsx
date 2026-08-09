import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { stockRequestsService } from '@/services/stock-requests.service';
import { toApiError } from '@/hooks/useResource';
import { ApiError } from '@/types/api';

// ─── How many stock adjustments are waiting on our signature.
//
// DELIBERATELY THIN. This provider owns the badge and nothing else: the count has
// to be correct from any route, which is the whole reason it is global, but the
// inbox itself carries page/status/direction state that only the tab can own.
// Putting the list here would give the tab two sources of truth about which page
// it is on. So the tab does its own `useResource` paging and calls `refetch()`
// after every approve/reject/withdraw, which is what keeps the badge, the inbox
// and the inventory rows from disagreeing.

const POLL_INTERVAL_MS = 60_000;

export interface StockRequestsState {
  /**
   * Requests the VENDOR raised that are still pending — `direction=awaiting_me`.
   * Never a total row count: the inbox carries the ones we raised ourselves too,
   * and badging those would tell the agency to go answer itself.
   */
  awaitingCount: number;
  isLoading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

const StockRequestsContext = createContext<StockRequestsState | null>(null);

export function StockRequestsProvider({ children }: { children: ReactNode }) {
  const [awaitingCount, setAwaitingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef(false);

  const refetch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    setError(null);
    try {
      setAwaitingCount(await stockRequestsService.countAwaitingMe());
    } catch (err) {
      setError(toApiError(err, 'STOCK_REQUESTS_FETCH_FAILED', 'Failed to load stock requests'));
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
    <StockRequestsContext.Provider value={{ awaitingCount, isLoading, error, refetch }}>
      {children}
    </StockRequestsContext.Provider>
  );
}

export function useStockRequests(): StockRequestsState {
  const ctx = useContext(StockRequestsContext);
  if (!ctx) throw new Error('useStockRequests must be used within a StockRequestsProvider');
  return ctx;
}
