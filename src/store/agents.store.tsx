import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { agentsService } from '@/services/agents.service';
import { toApiError } from '@/hooks/useResource';
import { ApiError } from '@/types/api';
import { toAgentSummary, type RosterEntry, type AgentSummary } from '@/types/agent.types';

// ─── Roster (membership model) + pending-invite count. Shared across the Agents
// page (roster + membership actions), the Shipments assign dropdown, and the COD
// deposit form (via the flattened `agents` summaries).

const POLL_INTERVAL_MS = 60_000;

export interface AgentsRosterState {
  /** Full membership + agent entries. */
  roster: RosterEntry[];
  /** Flattened summaries for assign/deposit dropdowns. */
  agents: AgentSummary[];
  /** Count of pending join requests (approved-pending memberships awaiting your action). */
  pendingRequestsCount: number;
  /** Count of pending outbound invites. */
  pendingInvitesCount: number;
  isLoading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

const AgentsRosterContext = createContext<AgentsRosterState | null>(null);

export function AgentsRosterProvider({ children }: { children: ReactNode }) {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef(false);

  const refetch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const [rosterRes, invites] = await Promise.all([
        agentsService.listRoster(),
        agentsService.listInvites('pending'),
      ]);
      setRoster(rosterRes.data);
      setPendingInvitesCount(invites.data.length);
    } catch (err) {
      setError(toApiError(err, 'AGENTS_FETCH_FAILED', 'Failed to load agents'));
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

  const agents = useMemo(() => roster.map(toAgentSummary), [roster]);
  const pendingRequestsCount = useMemo(
    () => roster.filter((e) => e.membership.status === 'pending').length,
    [roster],
  );

  return (
    <AgentsRosterContext.Provider
      value={{ roster, agents, pendingRequestsCount, pendingInvitesCount, isLoading, error, refetch }}
    >
      {children}
    </AgentsRosterContext.Provider>
  );
}

export function useAgentsRoster(): AgentsRosterState {
  const ctx = useContext(AgentsRosterContext);
  if (!ctx) throw new Error('useAgentsRoster must be used within an AgentsRosterProvider');
  return ctx;
}
