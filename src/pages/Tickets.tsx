import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  statusLabel, STATUS_BADGE_CLASSES, STATUS_DOT_CLASSES, STATUS_TAB_VALUES,
  priorityLabel, PRIORITY_BADGE_CLASSES, PRIORITY_DOT_CLASSES, TICKET_PRIORITIES,
  TICKET_TYPE_GROUPS, ticketTypeGroupLabel, ticketTypeLabel,
  getTypeVisual, shortTicketRef, relativeTime, ENTITY_ICONS,
} from '@/components/tickets/ticket.constants';
import type {
  Ticket, TicketPagination, TicketStatus, TicketPriority, TicketType, ListTicketsParams,
} from '@/types/ticket.types';

const PAGE_LIMIT = 20;
const ALL = '__all__';

type SortKey = 'updated' | 'created' | 'priority';

/** Sort order per key. The copy lives in `tickets:page.sort.*`. */
const SORT_CONFIG: Record<SortKey, { sortBy: ListTicketsParams['sortBy']; sortOrder: 'asc' | 'desc' }> = {
  updated: { sortBy: 'updatedAt', sortOrder: 'desc' },
  created: { sortBy: 'createdAt', sortOrder: 'desc' },
  priority: { sortBy: 'priority', sortOrder: 'desc' },
};

const SORT_KEYS: SortKey[] = ['updated', 'created', 'priority'];

export function Tickets() {
  const { t } = useTranslation(['tickets', 'common']);
  const location = useLocation();
  const navigate = useNavigate();

  /** `STATUS_TAB_VALUES` carries `null` for "all"; the filter pills need a string key. */
  const statusOptions = useMemo(
    () =>
      STATUS_TAB_VALUES.map((value) => ({
        value: (value ?? ALL) as TicketStatus | typeof ALL,
        label: value === null ? t('status.all') : statusLabel(value),
      })),
    [t],
  );

  const priorityOptions = useMemo(
    () => [
      { value: ALL as TicketPriority | typeof ALL, label: t('page.filters.allPriorities') },
      ...TICKET_PRIORITIES.map((p) => ({
        value: p as TicketPriority | typeof ALL,
        label: priorityLabel(p),
      })),
    ],
    [t],
  );

  const sortOptions = useMemo(
    () =>
      SORT_KEYS.map((value) => ({
        value,
        label: t(`page.sort.${value}` as 'page.sort.updated'),
      })),
    [t],
  );

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
    const sortConfig = SORT_CONFIG[sort];
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
  const filtered = tickets.filter((ticket) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return ticket.subject.toLowerCase().includes(q) || ticket.description.toLowerCase().includes(q);
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
          <h1 className="text-2xl font-bold">{t('page.title')}</h1>
          <p className="text-muted-foreground">{t('page.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={load} title={t('page.refresh')} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setFaqOpen(true)}>
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">{t('page.faq')}</span>
          </Button>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('page.newTicket')}
          </Button>
        </div>
      </div>

      {/* Search & filters */}
      <SearchFilterBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t('page.searchPlaceholder')}
        searchLabel={t('page.searchLabel')}
        activeCount={activeFilterCount}
        onReset={resetFilters}
        filterDescription={t('page.filterDescription')}
        resultCount={searchQuery.trim() ? filtered.length : pagination.total}
        resultNounKey="common:nouns.ticket"
      >
        <FilterSection label={t('page.filters.status')}>
          <FilterOptionGroup
            value={statusFilter ?? ALL}
            onChange={(v) => { setStatusFilter(v === ALL ? null : (v as TicketStatus)); setPage(1); }}
            options={statusOptions}
          />
        </FilterSection>

        <FilterSection label={t('page.filters.priority')}>
          <FilterOptionGroup
            value={priorityFilter || ALL}
            onChange={(v) => { setPriorityFilter(v === ALL ? '' : (v as TicketPriority)); setPage(1); }}
            options={priorityOptions}
          />
        </FilterSection>

        <FilterSection label={t('page.filters.type')}>
          <FilterField label={t('page.filters.ticketType')}>
            <Select
              value={typeFilter || ALL}
              onValueChange={(v) => { setTypeFilter(v === ALL ? '' : (v as TicketType)); setPage(1); }}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder={t('page.filters.allTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('page.filters.allTypes')}</SelectItem>
                {TICKET_TYPE_GROUPS.map((g) => (
                  <SelectGroup key={g.key}>
                    <SelectLabel>{ticketTypeGroupLabel(g.key)}</SelectLabel>
                    {g.values.map((v) => (
                      <SelectItem key={v} value={v}>{ticketTypeLabel(v)}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </FilterSection>

        <FilterSection label={t('page.filters.sortBy')}>
          <FilterOptionGroup
            value={sort}
            onChange={(v) => { setSort(v); setPage(1); }}
            options={sortOptions}
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
          <Button variant="outline" size="sm" onClick={load}>{t('common:actions.retry')}</Button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title={hasActiveFilter ? t('page.empty.titleFiltered') : t('page.empty.title')}
          description={
            hasActiveFilter ? t('page.empty.descriptionFiltered') : t('page.empty.description')
          }
          action={
            hasActiveFilter ? (
              <Button variant="outline" onClick={clearFilters}>{t('page.empty.clearFilters')}</Button>
            ) : (
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> {t('page.newTicket')}
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Desktop / tablet: table */}
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t('page.table.ticket')}</th>
                  <th className="px-4 py-3">{t('page.table.status')}</th>
                  <th className="px-4 py-3">{t('page.table.priority')}</th>
                  <th className="px-4 py-3">{t('page.table.updated')}</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((ticket) => (
                  <tr
                    key={ticket._id}
                    onClick={() => setSelectedId(ticket._id)}
                    className="group cursor-pointer border-b last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3"><TicketIdentity ticket={ticket} /></td>
                    <td className="px-4 py-3"><StatusPill status={ticket.status} /></td>
                    <td className="px-4 py-3"><PriorityPill priority={ticket.priority} locked={ticket.priority_locked} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{relativeTime(ticket.updatedAt)}</td>
                    <td className="px-4 py-3 text-end">
                      <ChevronRight className="ms-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: full-bleed rows, separated by a line rather than framed */}
          <div className="-mx-4 divide-y border-y sm:-mx-6 md:hidden">
            {filtered.map((ticket) => (
              <button
                key={ticket._id}
                onClick={() => setSelectedId(ticket._id)}
                className="flex w-full flex-col gap-3 p-4 text-start active:bg-muted/50"
              >
                <TicketIdentity ticket={ticket} />
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={ticket.status} />
                  <PriorityPill priority={ticket.priority} locked={ticket.priority_locked} />
                  <span className="ms-auto text-xs text-muted-foreground">{relativeTime(ticket.updatedAt)}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
            <span>
              {searchQuery.trim()
                ? t('page.matchesOnPage', { count: filtered.length })
                : t('common:pagination.showingRange', {
                    from: rangeStart,
                    to: rangeEnd,
                    total: pagination.total,
                  })}
            </span>
            {pagination.pages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t('common:pagination.previous')}
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
                </Button>
                <span>
                  {t('common:pagination.pageOf', { page: pagination.page, total: pagination.pages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t('common:pagination.next')}
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
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
      {statusLabel(status)}
    </Badge>
  );
}

function PriorityPill({ priority, locked }: { priority: TicketPriority; locked?: boolean }) {
  return (
    <Badge className={cn('gap-1.5 border-0 font-medium', PRIORITY_BADGE_CLASSES[priority])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT_CLASSES[priority])} />
      {priorityLabel(priority)}
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
