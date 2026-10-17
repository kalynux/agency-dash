import { formatDate as fmtDate } from '@/lib/format';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Loader2, Lock, Pencil, X, Check, CircleSlash, Info, XCircle, ShieldAlert, EyeOff,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useActionRunner } from '@/hooks/useActionRunner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { ticketsService } from '@/services/tickets.service';
import { getApiErrorMessage, getErrorCode } from '@/lib/errors';
import { ApiError } from '@/types/api';
import { NotesThread } from './NotesThread';
import { AttachmentsPanel } from './AttachmentsPanel';
import { ActorAvatar } from './ActorAvatar';
import { TicketEntityLink } from './TicketEntityLink';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import {
  statusLabel, STATUS_BADGE_CLASSES, STATUS_DOT_CLASSES, TICKET_STATUSES,
  priorityLabel, PRIORITY_BADGE_CLASSES, PRIORITY_DOT_CLASSES, TICKET_PRIORITIES,
  importanceLabel, IMPORTANCE_BADGE_CLASSES,
  ticketTypeLabel, roleLabel, openerLabel, getTypeVisual, shortTicketRef, relativeTime,
  responsiveSheetProps, DESCRIPTION_MAX_LENGTH,
} from './ticket.constants';
import {
  actorName, followerName, isTicketCreator, mergeTicketWrite, offerableStatuses, ticketOpener,
} from './ticket.rules';
import type {
  Ticket, TicketActor, TicketStatus, TicketPriority, TicketImportance,
} from '@/types/ticket.types';

export interface TicketDetailSheetProps {
  ticketId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

/**
 * Why the ticket could not be shown. `lostAccess` is its own state, not an
 * error: an administrator can remove this agency from a ticket's followers, and
 * a link opened afterwards answers `403 TICKET_ACCESS_DENIED`.
 */
interface LoadFailure {
  message: string;
  lostAccess: boolean;
}

const NO_FOLLOWERS: TicketActor[] = [];

function formatDate(iso: string): string {
  return fmtDate(iso);
}

function isAccessDenied(err: unknown): boolean {
  return getErrorCode(err) === 'TICKET_ACCESS_DENIED' || (err instanceof ApiError && err.status === 403);
}

export function TicketDetailSheet({ ticketId, onOpenChange, onChanged }: TicketDetailSheetProps) {
  const { t } = useTranslation(['tickets', 'common']);
  const currentUserId = useCurrentUserId();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoadFailure | null>(null);
  /** Bumped after every write, each of which appends a system note to the thread. */
  const [notesKey, setNotesKey] = useState(0);

  const [editing, setEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const { run, pendingKey } = useActionRunner();
  const isMobile = useIsMobile();
  const sheet = responsiveSheetProps(isMobile, 'sm:max-w-2xl lg:max-w-4xl');

  // Read through a ref so `load` keeps one identity whatever the parent passes.
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  });

  // Monotonic token so a slow fetch for a previously-selected ticket can't
  // overwrite the state of the one now open.
  const reqRef = useRef(0);
  const load = useCallback(async (id: string) => {
    const token = ++reqRef.current;
    setLoading(true);
    setError(null);
    setEditing(false);
    setTicket(null);
    try {
      const res = await ticketsService.getById(id);
      if (reqRef.current !== token) return;
      setTicket(res.data);
      setDraftSubject(res.data.subject);
      setDraftDescription(res.data.description);
    } catch (err) {
      if (reqRef.current !== token) return;
      const lostAccess = isAccessDenied(err);
      setError({ message: getApiErrorMessage(err), lostAccess });
      // The ticket has left our list too; drop the stale row behind the sheet.
      if (lostAccess) onChangedRef.current?.();
    } finally {
      if (reqRef.current === token) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ticketId) load(ticketId);
  }, [ticketId, load]);

  function applyUpdate(written: Ticket) {
    // A write answers with the bare document — keep the resolved blocks.
    setTicket((current) => (current ? mergeTicketWrite(current, written) : written));
    setNotesKey((k) => k + 1);
    onChanged?.();
  }

  /**
   * A write refused with 403 means the ticket on screen is out of date — most
   * likely we were removed from it while it was open. Re-read it, which lands on
   * the lost-access state if so.
   */
  function onWriteError(err: unknown) {
    if (ticket && isAccessDenied(err)) load(ticket.id);
  }

  async function saveEdit() {
    if (!ticket) return;
    const res = await run(
      'edit',
      () => ticketsService.update(ticket.id, { subject: draftSubject, description: draftDescription }),
      { success: t('detail.toasts.updated'), onError: onWriteError },
    );
    if (res) {
      applyUpdate(res.data);
      setEditing(false);
    }
  }

  async function changeStatus(status: TicketStatus) {
    if (!ticket || status === ticket.status) return;
    const res = await run('status', () => ticketsService.updateStatus(ticket.id, status), {
      success: t('detail.toasts.statusUpdated'),
      onError: onWriteError,
    });
    if (res) applyUpdate(res.data);
  }

  async function changePriority(priority: TicketPriority) {
    if (!ticket || priority === ticket.priority) return;
    const res = await run('priority', () => ticketsService.updatePriority(ticket.id, priority), {
      success: t('detail.toasts.priorityUpdated'),
      onError: onWriteError,
    });
    if (res) applyUpdate(res.data);
  }

  async function escalate() {
    if (!ticket) return;
    const res = await run('escalate', () => ticketsService.assign(ticket.id, 'admin'), {
      success: t('detail.toasts.escalated'),
      onError: onWriteError,
    });
    if (res) applyUpdate(res.data);
  }

  async function handleClose() {
    if (!ticket) return;
    const res = await run('close', () => ticketsService.close(ticket.id), {
      success: t('detail.toasts.closed'),
      onError: (err) => {
        setConfirmCloseOpen(false);
        onWriteError(err);
      },
    });
    if (res) {
      applyUpdate(res.data);
      setConfirmCloseOpen(false);
    }
  }

  const isClosed = ticket?.status === 'closed';
  const TypeIcon = ticket ? getTypeVisual(ticket.type).Icon : null;
  const followers = ticket?.followers ?? NO_FOLLOWERS;
  const opener = ticket ? ticketOpener(ticket) : null;

  // Closing is the creator's alone; every other write only needs followership.
  // Anyone else pressing Close gets `403 TICKET_ACCESS_DENIED`, so it is not offered.
  const isCreator = ticket ? isTicketCreator(ticket, currentUserId) : false;

  // A `waiting_on_<role>` status is offered only when a follower holds that role.
  const statusOptions = useMemo(
    () => (ticket ? offerableStatuses(TICKET_STATUSES, ticket.status, followers, isCreator) : []),
    [ticket, followers, isCreator],
  );

  const withSupport = ticket?.assigned_to_role === 'admin' || !!ticket?.assigned_admin;

  return (
    <Sheet open={!!ticketId} onOpenChange={onOpenChange}>
      <SheetContent side={sheet.side} className={cn('flex flex-col p-0', sheet.className)}>
        {/* Header */}
        <SheetHeader className="gap-3 border-b pe-20">
          {ticket ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={ticket.status} />
                <PriorityPill priority={ticket.priority} locked={ticket.priority_locked} />
                <span className="font-mono text-xs text-muted-foreground">{shortTicketRef(ticket.id)}</span>
              </div>
              <SheetTitle className="text-lg leading-snug">{ticket.subject}</SheetTitle>
              {/* Up here because on a phone the sidebar is a long scroll away, and
                  "whose ticket is this" is now the first question. */}
              {opener && (
                <p className="text-xs text-muted-foreground">
                  {isCreator
                    ? t('people.openedByYou')
                    : t('people.openedBy', { name: openerLabel(opener) })}
                </p>
              )}
            </>
          ) : (
            <SheetTitle>{loading ? t('detail.loading') : t('detail.fallbackTitle')}</SheetTitle>
          )}

          {ticket && !isClosed && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="absolute end-12 top-4 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-70 transition hover:bg-accent hover:opacity-100"
              aria-label={t('detail.edit')}
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <DetailSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              {error.lostAccess ? (
                <>
                  <EyeOff className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">{t('detail.lostAccess.title')}</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {t('detail.lostAccess.description')}
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-8 w-8 text-destructive" />
                  <p className="text-sm text-muted-foreground">{error.message}</p>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                {t('common:actions.close')}
              </Button>
            </div>
          ) : ticket ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Main column */}
              <div className="space-y-6 lg:col-span-2">
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">{t('detail.description')}</h3>
                  {editing ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-subject">{t('detail.subject')}</Label>
                        <Input
                          id="edit-subject"
                          value={draftSubject}
                          onChange={(e) => setDraftSubject(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-description">{t('detail.description')}</Label>
                        <Textarea
                          id="edit-description"
                          rows={6}
                          maxLength={DESCRIPTION_MAX_LENGTH}
                          value={draftDescription}
                          onChange={(e) => setDraftDescription(e.target.value)}
                        />
                        <p className="text-end text-xs tabular-nums text-muted-foreground">
                          {t('detail.charCount', {
                            current: draftDescription.length,
                            max: DESCRIPTION_MAX_LENGTH,
                          })}
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingKey === 'edit'}
                          onClick={() => {
                            setEditing(false);
                            setDraftSubject(ticket.subject);
                            setDraftDescription(ticket.description);
                          }}
                        >
                          <X className="me-2 h-3.5 w-3.5" /> {t('common:actions.cancel')}
                        </Button>
                        <Button size="sm" onClick={saveEdit} disabled={pendingKey === 'edit'}>
                          {pendingKey === 'edit' ? <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" /> : <Check className="me-2 h-3.5 w-3.5" />}
                          {t('common:actions.save')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {ticket.description}
                    </p>
                  )}
                </section>

                <AttachmentsPanel
                  ticketId={ticket.id}
                  followers={followers}
                  currentUserId={currentUserId}
                  readOnly={isClosed}
                />

                <NotesThread
                  ticketId={ticket.id}
                  followers={followers}
                  currentUserId={currentUserId}
                  refreshKey={notesKey}
                  readOnly={isClosed}
                />
              </div>

              {/* Sidebar */}
              <aside className="space-y-6 lg:col-span-1">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-1 lg:gap-6">
                  {/* Status control */}
                  <SidebarSection label={t('detail.status')}>
                    <Select
                      value={ticket.status}
                      onValueChange={(v) => {
                        if (v === 'closed') setConfirmCloseOpen(true);
                        else changeStatus(v as TicketStatus);
                      }}
                      disabled={pendingKey === 'status' || isClosed}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => (
                          <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SidebarSection>

                  {/* Priority control */}
                  <SidebarSection label={t('detail.priority')}>
                    {ticket.priority_locked ? (
                      <div className="space-y-1.5">
                        <PriorityPill
                          priority={ticket.priority}
                          locked
                          lockedLabel={t('detail.priorityLocked')}
                        />
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Info className="mt-0.5 h-3 w-3 shrink-0" />
                          {t('detail.priorityLockedHint')}
                        </p>
                      </div>
                    ) : (
                      <Select
                        value={TICKET_PRIORITIES.includes(ticket.priority) ? ticket.priority : undefined}
                        onValueChange={(v) => changePriority(v as TicketPriority)}
                        disabled={pendingKey === 'priority' || isClosed}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={priorityLabel(ticket.priority)} />
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_PRIORITIES.map((p) => (
                            <SelectItem key={p} value={p}>{priorityLabel(p)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </SidebarSection>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <InfoRow label={t('detail.type')}>
                    <span className="inline-flex items-center gap-1.5">
                      {TypeIcon && <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                      {ticketTypeLabel(ticket.type)}
                    </span>
                  </InfoRow>
                  <InfoRow label={t('detail.importance')}>
                    <Badge className={cn('border-0', IMPORTANCE_BADGE_CLASSES[ticket.importance as TicketImportance])}>
                      {importanceLabel(ticket.importance)}
                    </Badge>
                  </InfoRow>
                  {/* Keyed so a different ticket never inherits the last one's link. */}
                  <InfoRow label={t('detail.relatedTo')} align="start">
                    <TicketEntityLink key={ticket.id} ticket={ticket} />
                  </InfoRow>
                  {ticket.tracking_number && (
                    <InfoRow label={t('detail.tracking')}>
                      <span className="font-mono text-xs">{ticket.tracking_number}</span>
                    </InfoRow>
                  )}
                </div>

                {/* Opened by — often not us: the customer, the vendor, one of our
                    agents, or the platform itself. */}
                {opener && (
                  <SidebarSection label={t('detail.openedBy')} className="border-t pt-4">
                    <PersonRow
                      avatar={<ActorAvatar actor={opener.actor} role={opener.role} name={opener.name} />}
                      name={opener.name ?? roleLabel(opener.role)}
                      caption={opener.admin?.job_title || roleLabel(opener.role)}
                      verified={opener.actor?.verified}
                      isYou={isCreator}
                      strong
                    />
                  </SidebarSection>
                )}

                {/* Assigned to + escalate. A support administrator is a snapshot
                    (name and job title), not an actor with a role. */}
                <SidebarSection label={t('detail.assignedTo')} className="border-t pt-4">
                  {ticket.assigned_admin ? (
                    <PersonRow
                      avatar={<ActorAvatar actor={null} role="admin" name={ticket.assigned_admin.name} />}
                      name={ticket.assigned_admin.name}
                      caption={ticket.assigned_admin.job_title || roleLabel('admin')}
                      strong
                    />
                  ) : ticket.assigned_to ? (
                    <PersonRow
                      avatar={<ActorAvatar actor={ticket.assigned_to} />}
                      name={actorName(ticket.assigned_to) ?? roleLabel(ticket.assigned_to.role)}
                      caption={roleLabel(ticket.assigned_to.role)}
                      verified={ticket.assigned_to.verified}
                      isYou={ticket.assigned_to.user_id === currentUserId}
                      strong
                    />
                  ) : ticket.assigned_to_role === 'admin' ? (
                    <p className="text-sm text-muted-foreground">{t('detail.assignedToSupport')}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('detail.unassigned')}</p>
                  )}
                  {!isClosed && !withSupport && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full gap-1.5"
                      disabled={pendingKey === 'escalate'}
                      onClick={escalate}
                    >
                      {pendingKey === 'escalate' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                      {t('detail.escalate')}
                    </Button>
                  )}
                </SidebarSection>

                {/* Followers — everyone who reads this ticket's public notes. On an
                    order ticket that is the vendor, each agency and each agent,
                    plus whoever opened it. */}
                <SidebarSection
                  label={
                    followers.length > 0
                      ? t('detail.followersCount', { total: followers.length })
                      : t('detail.followers')
                  }
                  className="border-t pt-4"
                >
                  <ul className="space-y-2.5">
                    {followers.length === 0 ? (
                      <li className="text-sm text-muted-foreground">{t('detail.noFollowers')}</li>
                    ) : (
                      followers.map((f) => {
                        const name = followerName(f, ticket);
                        return (
                          <li key={`${f.role}:${f.user_id}`}>
                            <PersonRow
                              avatar={<ActorAvatar actor={f} name={name} className="h-7 w-7" />}
                              name={name ?? roleLabel(f.role)}
                              caption={roleLabel(f.role)}
                              verified={f.verified}
                              isYou={f.user_id === currentUserId}
                            />
                          </li>
                        );
                      })
                    )}
                  </ul>
                </SidebarSection>

                {/* Timeline meta */}
                <dl className="space-y-2 border-t pt-4 text-sm">
                  <MetaLine label={t('detail.created')} value={formatDate(ticket.createdAt)} />
                  <MetaLine label={t('detail.lastUpdated')} value={relativeTime(ticket.updatedAt)} />
                  <MetaLine label={t('detail.ticketId')} value={shortTicketRef(ticket.id)} mono />
                </dl>
              </aside>
            </div>
          ) : null}
        </div>

        {ticket && !isClosed && (
          <SheetFooter className="border-t">
            {isCreator ? (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmCloseOpen(true)}
                disabled={pendingKey === 'close'}
              >
                <CircleSlash className="me-2 h-4 w-4" />
                {t('detail.closeTicket')}
              </Button>
            ) : (
              // No Close button on a ticket we follow but did not open — say why,
              // rather than leave the footer the user expects simply missing.
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t('detail.closeOnlyCreator')}
              </p>
            )}
          </SheetFooter>
        )}
      </SheetContent>

      <AlertDialog open={confirmCloseOpen} onOpenChange={(o) => pendingKey !== 'close' && setConfirmCloseOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('detail.confirmCloseTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('detail.confirmCloseDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingKey === 'close'}>{t('detail.keepOpen')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleClose(); }}
              disabled={pendingKey === 'close'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pendingKey === 'close' ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <CircleSlash className="me-2 h-4 w-4" />}
              {t('detail.closeTicket')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

// ─── Presentational helpers ───────────────────────────────────────────────────

function StatusPill({ status }: { status: TicketStatus }) {
  return (
    <Badge className={cn('gap-1.5 border-0 font-medium', STATUS_BADGE_CLASSES[status])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT_CLASSES[status])} />
      {statusLabel(status)}
    </Badge>
  );
}

function PriorityPill({
  priority, locked, lockedLabel,
}: { priority: TicketPriority; locked?: boolean; lockedLabel?: string }) {
  return (
    <Badge className={cn('gap-1.5 border-0 font-medium', PRIORITY_BADGE_CLASSES[priority])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT_CLASSES[priority])} />
      {priorityLabel(priority)}
      {locked && <Lock className="h-3 w-3" />}
      {locked && lockedLabel && <span className="text-[10px] font-normal opacity-80">{lockedLabel}</span>}
    </Badge>
  );
}

function SidebarSection({
  label, children, className,
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function InfoRow({
  label, children, align = 'center',
}: { label: string; children: React.ReactNode; align?: 'center' | 'start' }) {
  return (
    <div
      className={cn(
        'flex justify-between gap-3 text-sm',
        align === 'start' ? 'items-start' : 'items-center',
      )}
    >
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-end font-medium">{children}</span>
    </div>
  );
}

/** One person: avatar, name (+ verified seal, + "You"), and what they are. */
function PersonRow({
  avatar, name, caption, verified, isYou, strong,
}: {
  avatar: React.ReactNode;
  name: string;
  caption: string;
  verified?: boolean;
  isYou?: boolean;
  strong?: boolean;
}) {
  const { t } = useTranslation('tickets');
  return (
    <div className="flex items-center gap-2.5">
      {avatar}
      <div className="min-w-0">
        <p className={cn('flex items-center gap-1 text-sm', strong && 'font-medium')}>
          <span className="truncate">{name}</span>
          <VerifiedBadge verified={verified} />
          {isYou && (
            <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px] font-medium">
              {t('people.you')}
            </Badge>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">{caption}</p>
      </div>
    </div>
  );
}

function MetaLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-end', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
