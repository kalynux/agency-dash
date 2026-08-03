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
  contractOffer,
  LIVE_MEMBERSHIP_STATUSES,
  type ContractStatusRequest,
  type ContractTermsProposal,
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
  /**
   * Every **open** terms proposal across the roster, both directions — changes
   * an agent proposed to a live contract awaiting our answer, and ours awaiting
   * theirs. Ours are kept for the same reason as status requests: this endpoint
   * is the only place a `proposalId` is exposed, and `cancel` needs it.
   */
  termsProposals: ContractTermsProposal[];
  /** Pending contracts whose standing offer is ours to answer. */
  pendingRequestsCount: number;
  /**
   * Everything waiting on us: contracts whose terms we must answer, plus
   * agent-raised status requests and terms proposals. Never a row count — the
   * lists carry our own proposals too, and badging those would tell the agency
   * to go answer itself.
   */
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
  const [termsProposals, setTermsProposals] = useState<ContractTermsProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef(false);

  const refetch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const [rosterEntries, requestsRes, proposalsRes] = await Promise.all([
        fetchWholeRoster(),
        agentsService.listStatusRequests(),
        agentsService.listOpenTermsProposals(),
      ]);
      setRoster(rosterEntries);
      // Both endpoints only return open rows; the state checks are belt and
      // braces (and case-insensitive, since these are free-form strings here).
      // Rows we raised ourselves are KEPT — they are what `cancel` acts on, and
      // `awaitingMyDecision` is what keeps them out of the badge.
      setStatusRequests(
        requestsRes.data.filter((r) => (r.state ?? 'pending').toLowerCase() === 'pending'),
      );
      setTermsProposals(
        proposalsRes.data.filter((p) => (p.state ?? 'pending').toLowerCase() === 'pending'),
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
  // Whose move it is comes from `awaitingDecisionFrom`, NOT from who opened the
  // contract: terms are negotiable, so an agency that raised a request ends up
  // as the answering party the moment the agent counters — and a bare agent
  // join request with no terms on it is nobody's to approve until we make an
  // offer, which is why `contractOffer` distinguishes the two.
  const pendingRequestsCount = useMemo(
    () => roster.filter((e) => contractOffer(e.membership) === 'ours-to-answer').length,
    [roster],
  );
  // `awaitingMyDecision`, never a row count: both lists carry the things we
  // raised ourselves, and badging those would tell the agency to go answer
  // itself.
  const pendingActionCount =
    pendingRequestsCount +
    statusRequests.filter((r) => r.awaitingMyDecision).length +
    termsProposals.filter((p) => p.awaitingMyDecision).length;

  return (
    <AgentsRosterContext.Provider
      value={{
        roster,
        agents,
        statusRequests,
        termsProposals,
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
