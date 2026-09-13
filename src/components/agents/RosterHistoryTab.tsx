import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, History, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { listSurfaceClass } from '@/components/layout/PageContainer';
import { MembershipEventItem } from '@/components/agents/MembershipEventItem';
import { tokenLabel } from '@/components/agents/tokenLabel';
import { agentsService } from '@/services/agents.service';
import { useAgentsRoster } from '@/store/agents.store';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { membershipEventAt } from '@/types/agent.types';
import type { AgentHistoryEvent } from '@/types/agent.types';

/**
 * Agents → History: every membership event across the whole roster, newest
 * first — what changed across our contracts recently.
 *
 * The per-agent log answers "what happened with *this* agent"; you can only ask
 * it once you already know which agent to open. This view is the other
 * direction, and it is the only place the question "did anything move this
 * week?" can be asked at all.
 *
 * **Not paginated, by the server's choice.** `GET /agency/agents/history`
 * answers with a bare `data` array — no `meta`, no `page`/`limit` query — capped
 * at the hundred most recent events. So there is nothing to page: client-side
 * paging over a list that is already complete-as-delivered would only hide rows
 * the user can scroll to, and would imply a page 2 that cannot be fetched. The
 * cap is stated in the footer instead, so a full list never silently reads as
 * "that is everything that ever happened".
 *
 * **No badge on the tab**, deliberately — see `src/pages/Inventory.tsx` for the
 * same call on the statements tab. Nothing chases an unread history entry: the
 * log is a record, not an inbox, and a count beside it would imply an obligation
 * the platform does not track and cannot clear.
 */

/** Coarse groupings over the event enum, so the filter has a handful of options. */
const OUTCOME_FILTERS = {
  started: ['invited', 'join_requested', 'invite_accepted', 'approved', 'transferred_in'],
  ended: [
    'invite_declined',
    'invite_revoked',
    'request_declined',
    'withdrawn',
    'removed',
    'transferred_out',
  ],
  paused: ['paused', 'suspended', 'reinstated'],
  terms: ['primary_changed', 'employment_updated', 'terms_updated', 'cod_limit_changed'],
} as const;

type Outcome = keyof typeof OUTCOME_FILTERS;
const OUTCOMES = Object.keys(OUTCOME_FILTERS) as Outcome[];

/** Calendar-day key in the viewer's own timezone — the day they'd call it. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

interface EventDay {
  key: string;
  at: string;
  events: AgentHistoryEvent[];
}

export function RosterHistoryTab() {
  const { t } = useTranslation(['agents', 'common']);
  const navigate = useNavigate();
  const { roster, isLoading: rosterLoading } = useAgentsRoster();

  const [events, setEvents] = useState<AgentHistoryEvent[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState<Outcome | 'all'>('all');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await agentsService.rosterHistory();
      setEvents(res.data);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The event carries `agentId`, never a name — identity is resolved against the
  // roster, which the provider has already fetched for the other two tabs. The
  // roster returns every status including terminal ones, so an agent whose
  // contract ended years ago still resolves; only a row whose agent left the
  // platform entirely falls back to the unnamed label.
  const nameByAgentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of roster) {
      if (entry.agent?.id && entry.agent.name) map.set(entry.agent.id, entry.agent.name);
    }
    return map;
  }, [roster]);

  /**
   * The agent's name, or null while we cannot honestly say.
   *
   * "Former agent" is a claim, not a placeholder, and the two fetches race: this
   * tab's history call and the provider's roster call are issued together, so on
   * a cold deep-link the log can render before a single name is known. Labelling
   * every row "Former agent" for that moment states something false about people
   * who are on the roster right now. Until the roster has answered, the row
   * simply reads as the event — exactly as it does inside the membership sheet.
   */
  const nameFor = (event: AgentHistoryEvent): string | null => {
    const known = event.agentId ? nameByAgentId.get(event.agentId) : undefined;
    if (known) return known;
    if (rosterLoading && roster.length === 0) return null;
    return t('rosterHistory.unknownAgent');
  };

  const query = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!events) return [];
    const allowed = outcome === 'all' ? null : new Set<string>(OUTCOME_FILTERS[outcome]);
    return events.filter((event) => {
      if (allowed && !allowed.has(event.type)) return false;
      if (!query) return true;
      const who = event.agentId ? nameByAgentId.get(event.agentId) : undefined;
      return [who, tokenLabel('agents:historyEvents', event.type), event.reason].some((field) =>
        typeof field === 'string' ? field.toLowerCase().includes(query) : false,
      );
    });
  }, [events, outcome, query, nameByAgentId]);

  /**
   * Grouped by day. A hundred rows of "Nov 4, 3:12 PM" repeat the date ninety
   * times and still make the reader work out where one day ends; the heading
   * says it once and every row below it needs only a clock time.
   *
   * Events with no timestamp at all keep their place in the server's ordering
   * under an "undated" heading rather than being dropped — this is a log.
   */
  const days = useMemo<EventDay[]>(() => {
    const out: EventDay[] = [];
    for (const event of filtered) {
      const at = membershipEventAt(event);
      const key = at ? dayKey(at) : 'undated';
      const last = out[out.length - 1];
      if (last && last.key === key) last.events.push(event);
      else out.push({ key, at: at ?? '', events: [event] });
    }
    return out;
  }, [filtered]);

  const outcomeOptions = useMemo(
    () => [
      { value: 'all' as const, label: t('rosterHistory.outcomes.all') },
      ...OUTCOMES.map((value) => ({
        value,
        label: t(`rosterHistory.outcomes.${value}` as 'rosterHistory.outcomes.started'),
      })),
    ],
    [t],
  );

  /** "Today" / "Yesterday" / an absolute date — the heading for one day's run. */
  const dayHeading = (day: EventDay): string => {
    if (!day.at) return t('rosterHistory.undated');
    const today = dayKey(new Date().toISOString());
    if (day.key === today) return t('common:time.today');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (day.key === dayKey(yesterday.toISOString())) return t('common:time.yesterday');
    return formatDate(day.at);
  };

  /**
   * Into the contract, not a dead end. `/dashboard/agents/{contractId}` is the
   * deep link `agent_contract.*` notifications already use — the Agents page
   * reads an id in the tab slot as "open that membership" — so a history row
   * lands on exactly the same sheet, and there is no second dialog here to drift
   * from it.
   *
   * `membershipId` is nullable: an `invited` event can predate the contract it
   * eventually created. Those rows stay inert rather than routing nowhere.
   */
  const openMembership = (event: AgentHistoryEvent) => {
    if (typeof event.membershipId === 'string' && event.membershipId) {
      navigate(`/dashboard/agents/${event.membershipId}`);
    }
  };

  const showingAll = !query && outcome === 'all';

  return (
    <div className="space-y-3">
      <SearchFilterBar
        value={search}
        onChange={setSearch}
        placeholder={t('rosterHistory.searchPlaceholder')}
        searchLabel={t('rosterHistory.searchLabel')}
        activeCount={outcome === 'all' ? 0 : 1}
        onReset={() => setOutcome('all')}
        filterDescription={t('rosterHistory.filterDescription')}
        resultCount={filtered.length}
        resultNounKey="common:nouns.event"
      >
        <FilterSection label={t('rosterHistory.outcomeFilter')}>
          <FilterOptionGroup value={outcome} onChange={setOutcome} options={outcomeOptions} />
        </FilterSection>
      </SearchFilterBar>

      <Card className={listSurfaceClass}>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('rosterHistory.loading')}
            </div>
          ) : loadError ? (
            <div className="p-8 text-center">
              <p className="mb-4 text-sm text-muted-foreground">{loadError}</p>
              <Button variant="outline" onClick={() => void load()}>
                {t('common:actions.retry')}
              </Button>
            </div>
          ) : days.length === 0 ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <History className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {showingAll ? t('rosterHistory.empty') : t('rosterHistory.emptyFiltered')}
                </p>
                {showingAll && (
                  <p className="max-w-md text-sm text-muted-foreground">
                    {t('rosterHistory.emptyHint')}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* The first day heading sits flush against the card's own top edge
               (or, on a phone, the full-bleed list's), so its border would read
               as a doubled hairline. Only the first — every later one is what
               separates two days. */
            <div className="[&>section:first-child>h3]:border-t-0">
              {days.map((day) => (
                <section key={day.key}>
                  {/* Deliberately not sticky. The page scrolls the document
                      under a `sticky top-0` Header (App.tsx), so a heading
                      pinned to the scrollport top would park itself behind that
                      header and be invisible exactly when it was wanted — and
                      the offset that would clear it differs between the desktop
                      header and the mobile app bar. */}
                  <h3 className="border-y bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
                    {dayHeading(day)}
                  </h3>
                  <ul className="divide-y">
                    {day.events.map((event, i) => {
                      const routes =
                        typeof event.membershipId === 'string' && !!event.membershipId;
                      return (
                        <li key={event.id ?? `${day.key}-${i}`}>
                          {/* One tap target per row at every width — a card list
                              and a table would be two renderers of one sentence,
                              so the row itself is the layout and only its
                              padding changes below `md`. */}
                          <button
                            type="button"
                            disabled={!routes}
                            onClick={() => openMembership(event)}
                            className={cn(
                              'flex w-full items-center gap-2 px-4 py-3 text-start transition-colors',
                              routes &&
                                'hover:bg-accent/40 active:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                            )}
                          >
                            <MembershipEventItem
                              event={event}
                              who={nameFor(event)}
                              timeOnly={!!day.at}
                              className="min-w-0 flex-1"
                            />
                            {routes && (
                              <ChevronRight
                                aria-hidden
                                className="h-4 w-4 flex-shrink-0 text-muted-foreground rtl:-scale-x-100"
                              />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              {/* The server's cap, said out loud. Without it a full list reads as
                  the complete history of the agency, which it is not. */}
              {events && events.length >= 100 && (
                <p className="border-t px-4 py-3 text-xs text-muted-foreground">
                  {t('rosterHistory.capped', { count: events.length })}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
