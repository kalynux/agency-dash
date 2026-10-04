import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { roleClosureService } from '@/services/role-closure.service';
import { toApiError } from '@/hooks/useResource';
import { useNotifications } from '@/store/notifications.store';
import { ApiError } from '@/types/api';
import type { RoleClosureRequest } from '@/types/role-closure.types';

// ─── Whether an administrator has asked to close this agency account.
//
// Global because two surfaces read it — the banner over every dashboard page
// and the closure screen itself — and they must never disagree: a decline on
// the screen has to take the banner down in the same render.
//
// No timer. A request is rare and lasts seven days, so it is read on load, when
// the app comes back to the foreground, and whenever a new notification lands
// (the request arrives as `account.closure_requested`, which no preference can
// mute, so the unread count moving is exactly the signal to look again).

export interface ClosureRequestState {
  /** The pending request, or `null` when nothing is waiting (the ordinary answer). */
  request: RoleClosureRequest | null;
  isLoading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
  setRequest: Dispatch<SetStateAction<RoleClosureRequest | null>>;
}

const ClosureRequestContext = createContext<ClosureRequestState | null>(null);

export function ClosureRequestProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<RoleClosureRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef(false);
  const { unreadCount } = useNotifications();

  const refetch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const res = await roleClosureService.get();
      setRequest(res.data);
    } catch (err) {
      setError(toApiError(err, 'CLOSURE_REQUEST_FETCH_FAILED', 'Failed to load the closure request'));
    } finally {
      setIsLoading(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void refetch();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refetch]);

  // Only on a RISE: marking things read must not cost a request.
  const lastUnread = useRef(unreadCount);
  useEffect(() => {
    if (unreadCount > lastUnread.current) void refetch();
    lastUnread.current = unreadCount;
  }, [unreadCount, refetch]);

  return (
    <ClosureRequestContext.Provider value={{ request, isLoading, error, refetch, setRequest }}>
      {children}
    </ClosureRequestContext.Provider>
  );
}

export function useClosureRequest(): ClosureRequestState {
  const ctx = useContext(ClosureRequestContext);
  if (!ctx) throw new Error('useClosureRequest must be used within a ClosureRequestProvider');
  return ctx;
}
