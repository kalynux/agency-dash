import { useCallback, useEffect, useState } from 'react';
import { combinedDeliveryRequestsService } from '@/services/combined-delivery-requests.service';

/**
 * How many combined-price requests are open — `meta.total` of a one-row page.
 *
 * `null` until known, and after a failure: a missing count must not read as "0
 * waiting" when we simply couldn't ask (e.g. a server that predates the endpoint).
 * `refetch` asks again (the page-refresh button).
 */
export function useOpenCombinedRequestCount() {
  const [count, setCount] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    combinedDeliveryRequestsService.list({ status: 'open', limit: 1 }).then(
      (res) => {
        if (!cancelled) setCount(res.meta.total);
      },
      () => {
        if (!cancelled) setCount(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refetch = useCallback(() => setTick((n) => n + 1), []);
  return { count, refetch };
}
