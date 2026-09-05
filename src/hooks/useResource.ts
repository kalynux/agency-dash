import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiError } from '@/types/api';

/** Normalize any thrown value into an ApiError (status 0 = client/network). */
export function toApiError(
  err: unknown,
  fallbackCode = 'CLIENT_ERROR',
  fallbackMessage = 'Request failed',
): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError(0, fallbackCode, err instanceof Error ? err.message : fallbackMessage);
}

export interface Resource<T> {
  data: T | null;
  isLoading: boolean;
  error: ApiError | null;
  /** Re-run the fetcher. Safe to call from event handlers. */
  refetch: () => Promise<void>;
  /** Optimistically patch local data without a round-trip. */
  setData: Dispatch<SetStateAction<T | null>>;
}

/**
 * Standardized read hook: runs `fetcher` on mount and whenever `deps` change,
 * exposing `{ data, isLoading, error, refetch, setData }`. Every list/detail
 * surface in the dashboard uses this so loading/error handling is uniform.
 *
 * `fetcher` is read from a ref, so it never needs to be memoized by callers;
 * re-fetching is driven purely by `deps`.
 */
export function useResource<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (mounted.current) setData(result);
    } catch (err) {
      if (mounted.current) setError(toApiError(err));
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refetch();
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, isLoading, error, refetch, setData };
}
