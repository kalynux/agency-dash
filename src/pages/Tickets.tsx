import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, Ticket as TicketIcon, HelpCircle, ChevronLeft, ChevronRight, RefreshCw, Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/common/state-views';
import {
  FilterField, FilterOptionGroup, FilterSection, SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { cn } from '@/lib/utils';
import { ticketsService } from '@/services/tickets.service';
import { getApiErrorMessage } from '@/lib/errors';
import { CreateTicketSheet } from '@/components/tickets/CreateTicketSheet';
import { TicketDetailSheet } from '@/components/tickets/TicketDetailSheet';
import { FaqSheet } from '@/components/tickets/FaqSheet';
import {
  STATUS_LABELS, STATUS_BADGE_CLASSES, STATUS_DOT_CLASSES, STATUS_TABS,
  PRIORITY_LABELS, PRIORITY_BADGE_CLASSES, PRIORITY_DOT_CLASSES, TICKET_PRIORITIES,
  TICKET_TYPE_GROUPS, getTypeVisual, shortTicketRef, relativeTime, ENTITY_ICONS,
} from '@/components/tickets/ticket.constants';
import type {
  Ticket, TicketPagination, TicketStatus, TicketPriority, TicketType, ListTicketsParams,
} from '@/types/ticket.types';

const PAGE_LIMIT = 20;
const ALL = '__all__';

type SortKey = 'updated' | 'created' | 'priority';
const SORT_OPTIONS: { value: SortKey; label: string; sortBy: ListTicketsParams['sortBy']; sortOrder: 'asc' | 'desc' }[] = [
  { value: 'updated', label: 'Recently updated', sortBy: 'updatedAt', sortOrder: 'desc' },
  { value: 'created', label: 'Recently created', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'priority', label: 'Priority', sortBy: 'priority', sortOrder: 'desc' },
];

/** `STATUS_TABS` carries `null` for "all"; the filter pills need a string key. */
const STATUS_OPTIONS = STATUS_TABS.map((tab) => ({
  value: (tab.value ?? ALL) as TicketStatus | typeof ALL,
  label: tab.label,
}));

const PRIORITY_OPTIONS = [
  { value: ALL as TicketPriority | typeof ALL, label: 'All priorities' },
  ...TICKET_PRIORITIES.map((p) => ({ value: p as TicketPriority | typeof ALL, label: PRIORITY_LABELS[p] })),
];

export function Tickets() {
  const location = useLocation();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<TicketPagination>({ total: 0, page: 1, limit: PAGE_LIMIT, pages: 1 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | null>(null);
  const [typeFilter, setTypeFilter] = useState<TicketType | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | ''>('');
  const [sort, setSort] = useState<SortKey>('updated');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(
    () => Boolean((location.state as { create?: boolean } | null)?.create),
  );
  const [faqOpen, setFaqOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Open the create sheet or a specific ticket when arrived via router state, then clear it.
  useEffect(() => {
    const state = location.state as { create?: boolean; openTicketId?: string } | null;
    if (state?.openTicketId) {
      setSelectedId(state.openTicketId);
      navigate(location.pathname, { replace: true, state: null });
    } else if (state?.create) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const sortConfig = SORT_OPTIONS.find((s) => s.value === sort)!;
    try {
      const res = await ticketsService.list({
        status: statusFilter ?? undefined,
        type: typeFilter || undefined,
        priority: priorityFilter || undefined,
        page,
        limit: PAGE_LIMIT,
        sortBy: sortConfig.sortBy,
        sortOrder: sortConfig.sortOrder,
      });
      setTickets(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, typeFilter, priorityFilter, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  // The agency list endpoint has no text search, so search filters the loaded page.
  const filtered = tickets.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return t.subject.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });

  const hasActiveFilter = !!statusFilter || !!typeFilter || !!priorityFilter || searchQuery.trim().length > 0;

  /** Sort counts as a filter for the badge — it changes what the top of the list is. */
  const activeFilterCount =
    (statusFilter ? 1 : 0) + (typeFilter ? 1 : 0) + (priorityFilter ? 1 : 0) + (sort === 'updated' ? 0 : 1);

  const resetFilters = () => {
    setStatusFilter(null);
    setTypeFilter('');
    setPriorityFilter('');
    setSort('updated');
    setPage(1);
  };

  const clearFilters = () => {
    resetFilters();
    setSearchQuery('');
  };

  const rangeStart = tickets.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const rangeEnd = (pagination.page - 1) * pagination.limit + tickets.length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tickets</h1>
          <p className="text-muted-foreground">Get help from the Jovi Mall support team</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={load} title="Refresh" disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setFaqOpen(true)}>
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">FAQ</span>
          </Button>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New ticket
          </Button>
        </div>
      </div>

      {/* Search & filters */}
      <SearchFilterBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search tickets…"
        searchLabel="Search this page by subject or description"
        activeCount={activeFilterCount}
        onReset={resetFilters}
        filterDescription="Status, type and priority filter every ticket; search looks at the page you're on."
        resultCount={searchQuery.trim() ? filtered.length : pagination.total}
        resultNoun="ticket"
      >
        <FilterSection label="Status">
          <FilterOptionGroup
            value={statusFilter ?? ALL}
            onChange={(v) => { setStatusFilter(v === ALL ? null : (v as TicketStatus)); setPage(1); }}
            options={STATUS_OPTIONS}
          />
        </FilterSection>

        <FilterSection label="Priority">
          <FilterOptionGroup
            value={priorityFilter || ALL}
            onChange={(v) => { setPriorityFilter(v === ALL ? '' : (v as TicketPriority)); setPage(1); }}
            options={PRIORITY_OPTIONS}
          />
        </FilterSection>

        <FilterSection label="Type">
          <FilterField label="Ticket type">
            <Select
              value={typeFilter || ALL}
              onValueChange={(v) => { setTypeFilter(v === ALL ? '' : (v as TicketType)); setPage(1); }}
            >
              <SelectTrigger className="h-10 w-full"><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {TICKET_TYPE_GROUPS.map((g) => (
                  <SelectGroup key={g.groupLabel}>
                    <SelectLabel>{g.groupLabel}</SelectLabel>
                    {g.values.map((v) => (
                      <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </FilterSection>

        <FilterSection label="Sort by">
          <FilterOptionGroup
            value={sort}
            onChange={(v) => { setSort(v); setPage(1); }}
            options={SORT_OPTIONS}
          />
        </FilterSection>
      </SearchFilterBar>

      {/* Content */}
      {isLoading ? (
        <TicketListSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <TicketIcon className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>Try again</Button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title={hasActiveFilter ? 'No matching tickets' : 'No tickets yet'}
          description={
            hasActiveFilter
              ? 'Try adjusting your search or filters.'
              : 'Create your first ticket to get help from support.'
          }
          action={
            hasActiveFilter ? (
              <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
            ) : (
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> New ticket
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Desktop / tablet: table */}
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t._id}
                    onClick={() => setSelectedId(t._id)}
                    className="group cursor-pointer border-b last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3"><TicketIdentity ticket={t} /></td>
                    <td className="px-4 py-3"><StatusPill status={t.status} /></td>
                    <td className="px-4 py-3"><PriorityPill priority={t.priority} locked={t.priority_locked} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{relativeTime(t.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: full-bleed rows, separated by a line rather than framed */}
          <div className="-mx-4 divide-y border-y sm:-mx-6 md:hidden">
            {filtered.map((t) => (
              <button
                key={t._id}
                onClick={() => setSelectedId(t._id)}
                className="flex w-full flex-col gap-3 p-4 text-left active:bg-muted/50"
              >
                <TicketIdentity ticket={t} />
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={t.status} />
                  <PriorityPill priority={t.priority} locked={t.priority_locked} />
                  <span className="ml-auto text-xs text-muted-foreground">{relativeTime(t.updatedAt)}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
            <span>
              {searchQuery.trim()
                ? `${filtered.length} match${filtered.length !== 1 ? 'es' : ''} on this page`
                : `Showing ${rangeStart}–${rangeEnd} of ${pagination.total}`}
            </span>
            {pagination.pages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span>Page {pagination.page} of {pagination.pages}</span>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <CreateTicketSheet open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      <TicketDetailSheet
        ticketId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onChanged={load}
      />
      <FaqSheet open={faqOpen} onOpenChange={setFaqOpen} />
    </div>
  );
}

// ─── Row identity (icon + subject + ref + entity) ─────────────────────────────

function EntityChip({ ticket }: { ticket: Ticket }) {
  const key = (ticket.entity?.type ?? ticket.entity_type ?? '').toUpperCase();
  const Icon = ENTITY_ICONS[key] ?? Tag;
  const label = ticket.entity?.label ?? ticket.entity_type;
  if (!label) return null;
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function TicketIdentity({ ticket }: { ticket: Ticket }) {
  const { Icon, className } = getTypeVisual(ticket.type);
  return (
    <div className="flex items-start gap-3">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', className)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{ticket.subject}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-mono">{shortTicketRef(ticket._id)}</span>
          <span>·</span>
          <EntityChip ticket={ticket} />
        </div>
      </div>
    </div>
  );
}

// ─── Pills ────────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: TicketStatus }) {
  return (
    <Badge className={cn('gap-1.5 border-0 font-medium', STATUS_BADGE_CLASSES[status])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT_CLASSES[status])} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function PriorityPill({ priority, locked }: { priority: TicketPriority; locked?: boolean }) {
  return (
    <Badge className={cn('gap-1.5 border-0 font-medium', PRIORITY_BADGE_CLASSES[priority])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT_CLASSES[priority])} />
      {PRIORITY_LABELS[priority]}
      {locked && <LockGlyph />}
    </Badge>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function TicketListSkeleton() {
  return (
    <div className="-mx-4 border-y sm:-mx-6 md:mx-0 md:overflow-hidden md:rounded-lg md:border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="hidden h-3 w-12 sm:block" />
        </div>
      ))}
    </div>
  );
}
