import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { deliveryFeeProposalsService } from '@/services/delivery-fee-proposals.service';

// ─── How many fees the payer proposed that are still pending (ADR-A12).
//
// Thin on purpose, like the stock-requests badge: it owns the count, because the
// sidebar needs it from every route, and nothing else. The inbox page pages its
// own list and calls `refetch()` after every answer, and so does the shipment
// sheet, so the badge never lags an answer made here.
//
// The number is `meta.total` of `?status=pending` — the API's figure, not one we
// count. It includes a higher fee you already accepted that is waiting for the
// customer's online payment: that proposal is still `pending`, and pickup is still
// blocked on it.

const POLL_INTERVAL_MS = 60_000;

export interface FeeProposalsState {
  /** `0` until known and after a failure (an older server has no inbox). */
  pendingCount: number;
  refetch: () => Promise<void>;
}

const FeeProposalsContext = createContext<FeeProposalsState | null>(null);

export function FeeProposalsProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const inFlight = useRef(false);

  const refetch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await deliveryFeeProposalsService.listInbox({ status: 'pending', limit: 1 });
      setPendingCount(res.meta?.total ?? 0);
    } catch {
      // Keep the last known count: a blip must not flash the badge away.
    } finally {
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

  return <FeeProposalsContext.Provider value={{ pendingCount, refetch }}>{children}</FeeProposalsContext.Provider>;
}

export function useFeeProposals(): FeeProposalsState {
  const ctx = useContext(FeeProposalsContext);
  if (!ctx) throw new Error('useFeeProposals must be used within a FeeProposalsProvider');
  return ctx;
}
