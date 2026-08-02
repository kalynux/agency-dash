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
import {
  toAgentSummary,
  LIVE_MEMBERSHIP_STATUSES,
  type ContractStatusRequest,
  type RosterEntry,
  type AgentSummary,
} from '@/types/agent.types';

// ─── The agency's agent contracts, in one place: the roster itself plus the
// contract changes agents have proposed. Both feed the Agents → Connections tab
// and the sidebar's pending-action badge, so they are fetched together and can
// never disagree about how much is waiting on you.
//
// Also read by the Shipments assign dropdown and the COD deposit form, via the
// flattened `agents` summaries.

const POLL_INTERVAL_MS = 60_000;

/** Rows per roster request. The endpoint's own ceiling. */
const ROSTER_PAGE_SIZE = 100;

/**
 * Stop after this many pages. `GET /agency/agents` returns terminal contracts
 * too, so a long-lived agency's roster grows without bound; at 100 a page this
 * covers a thousand contracts, and the cap only exists so a runaway response
 * can never spin the client.
 */
const MAX_ROSTER_PAGES = 10;

export interface AgentsRosterState {
  /** Every contract, live and terminal — the terminal rows ARE the history. */
  roster: RosterEntry[];
  /**
   * Flattened summaries for assign/deposit dropdowns. **Live contracts only** —
   * a deactivated agent must never be offered a shipment or a cash deposit.
   */
  agents: AgentSummary[];
  /**
   * Every pending contract change on the roster — pauses, resumes and
   * departures — in **both** directions: the ones the agent raised for you to
   * answer, and the ones you raised waiting on them. Read each row's
   * `awaitingMyDecision` / `availableActions`; the list itself is not an inbox.
   */
  statusRequests: ContractStatusRequest[];
  /** Pending contracts the AGENT raised — the ones you can approve or decline. */
  pendingRequestsCount: number;
  /** Everything waiting on you: agent-raised join requests + agent-raised contract changes. */
  pendingActionCount: number;
  isLoading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

const AgentsRosterContext = createContext<AgentsRosterState | null>(null);

/**
 * Every contract, across however many pages the roster spans.
 *
 * `GET /agency/agents` pages at 20 by default and returns terminal rows
 * alongside live ones, so a single unpaginated call quietly truncates the
 * roster — and the rows it drops are as likely to be working agents as dead
 * contracts. The first page tells us how many there are; the rest go out in
 * parallel.
 */
async function fetchWholeRoster(): Promise<RosterEntry[]> {
  const first = await agentsService.listRoster({ page: 1, limit: ROSTER_PAGE_SIZE });
  const totalPages = Math.min(first.meta?.totalPages ?? 1, MAX_ROSTER_PAGES);
  if (totalPages <= 1) return first.data;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      agentsService.listRoster({ page: i + 2, limit: ROSTER_PAGE_SIZE }),
    ),
  );
  return [first, ...rest].flatMap((page) => page.data);
}

export function AgentsRosterProvider({ children }: { children: ReactNode }) {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [statusRequests, setStatusRequests] = useState<ContractStatusRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef(false);

  const refetch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const [rosterEntries, requestsRes] = await Promise.all([
        fetchWholeRoster(),
        agentsService.listStatusRequests(),
      ]);
      setRoster(rosterEntries);
      // The endpoint only returns pending rows; the state check is belt and
      // braces (and case-insensitive, since it is a free-form string here).
      // Rows we raised ourselves are KEPT — they are what `cancel` acts on, and
      // `awaitingMyDecision` is what keeps them out of the badge.
      setStatusRequests(
        requestsRes.data.filter((r) => (r.state ?? 'pending').toLowerCase() === 'pending'),
      );
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

  // Terminal contracts stay in `roster` as history but must never reach a
  // dropdown — a deactivated agent cannot take a shipment or hand over cash.
  const agents = useMemo(
    () =>
      roster
        .filter((e) => LIVE_MEMBERSHIP_STATUSES.includes(e.membership.status))
        .map(toAgentSummary),
    [roster],
  );
  // Only contracts the AGENT raised are ours to answer — one we raised is
  // pending on *them*, and approving it would be a 403.
  const pendingRequestsCount = useMemo(
    () =>
      roster.filter((e) => e.membership.status === 'pending' && e.membership.initiatedBy === 'agent')
        .length,
    [roster],
  );
  // `awaitingMyDecision`, never `statusRequests.length`: the list carries our own
  // proposals too, and badging those would tell the agency to go answer itself.
  const pendingActionCount =
    pendingRequestsCount + statusRequests.filter((r) => r.awaitingMyDecision).length;

  return (
    <AgentsRosterContext.Provider
      value={{
        roster,
        agents,
        statusRequests,
        pendingRequestsCount,
        pendingActionCount,
        isLoading,
        error,
        refetch,
      }}
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
