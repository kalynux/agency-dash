import { formatDate as fmtDate } from '@/lib/format';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Loader2, Lock, Pencil, X, Check, CircleSlash, Info, XCircle, ShieldAlert,
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
import { ticketsService } from '@/services/tickets.service';
import { getApiErrorMessage } from '@/lib/errors';
import { NotesThread } from './NotesThread';
import { AttachmentsPanel } from './AttachmentsPanel';
import { ActorAvatar } from './ActorAvatar';
import {
  statusLabel, STATUS_BADGE_CLASSES, STATUS_DOT_CLASSES, TICKET_STATUSES,
  priorityLabel, PRIORITY_BADGE_CLASSES, PRIORITY_DOT_CLASSES, TICKET_PRIORITIES,
  importanceLabel, IMPORTANCE_BADGE_CLASSES, WAITING_STATUS_ROLE,
  ticketTypeLabel, ENTITY_ICONS, roleLabel, getTypeVisual, shortTicketRef, relativeTime,
  responsiveSheetProps, DESCRIPTION_MAX_LENGTH,
} from './ticket.constants';
import type {
  Ticket, TicketStatus, TicketPriority, TicketImportance,
} from '@/types/ticket.types';

export interface TicketDetailSheetProps {
  ticketId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

function formatDate(iso: string): string {
  return fmtDate(iso);
}

export function TicketDetailSheet({ ticketId, onOpenChange, onChanged }: TicketDetailSheetProps) {
  const { t } = useTranslation(['tickets', 'common']);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const { run, pendingKey } = useActionRunner();
  const isMobile = useIsMobile();
  const sheet = responsiveSheetProps(isMobile, 'sm:max-w-2xl lg:max-w-4xl');

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
      if (reqRef.current === token) setError(getApiErrorMessage(err));
    } finally {
      if (reqRef.current === token) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ticketId) load(ticketId);
  }, [ticketId, load]);

  function applyUpdate(updated: Ticket) {
    setTicket(updated);
    onChanged?.();
  }

  async function saveEdit() {
    if (!ticket) return;
    const res = await run(
      'edit',
      () => ticketsService.update(ticket.id, { subject: draftSubject, description: draftDescription }),
      { success: t('detail.toasts.updated') },
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
    });
    if (res) applyUpdate(res.data);
  }

  async function changePriority(priority: TicketPriority) {
    if (!ticket || priority === ticket.priority) return;
    const res = await run('priority', () => ticketsService.updatePriority(ticket.id, priority), {
      success: t('detail.toasts.priorityUpdated'),
    });
    if (res) applyUpdate(res.data);
  }

  async function escalate() {
    if (!ticket) return;
    const res = await run('escalate', () => ticketsService.assign(ticket.id, 'admin'), {
      success: t('detail.toasts.escalated'),
    });
    if (res) applyUpdate(res.data);
  }

  async function handleClose() {
    if (!ticket) return;
    const res = await run('close', () => ticketsService.close(ticket.id), {
      success: t('detail.toasts.closed'),
    });
    if (res) {
      applyUpdate(res.data);
      setConfirmCloseOpen(false);
    }
  }

  const isClosed = ticket?.status === 'closed';
  const assignee = ticket?.assigned_admin ?? ticket?.assigned_to ?? null;
  const TypeIcon = ticket ? getTypeVisual(ticket.type).Icon : null;
  const EntityIcon = ticket?.entity ? ENTITY_ICONS[ticket.entity.type] ?? null : null;
  const followers = ticket?.followers ?? [];

  // Roles present on the ticket — a `waiting_on_<role>` status is only allowed
  // when a participant with that role exists (admin is always allowed).
  const participantRoles = useMemo(() => {
    const roles = new Set<string>();
    if (!ticket) return roles;
    roles.add(ticket.created_by_role);
    if (ticket.assigned_to?.role) roles.add(ticket.assigned_to.role);
    if (ticket.assigned_admin?.role) roles.add(ticket.assigned_admin.role);
    (ticket.followers ?? []).forEach((f) => roles.add(f.role));
    return roles;
  }, [ticket]);

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
              <XCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
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

                <AttachmentsPanel ticketId={ticket.id} followers={followers} readOnly={isClosed} />

                <NotesThread ticketId={ticket.id} followers={followers} readOnly={isClosed} />
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
                        {TICKET_STATUSES.map((s) => {
                          const role = WAITING_STATUS_ROLE[s];
                          const blocked = !!role && role !== 'admin' && role !== 'agency' && !participantRoles.has(role);
                          return (
                            <SelectItem key={s} value={s} disabled={blocked}>
                              {statusLabel(s)}
                              {blocked && (
                                <span className="text-muted-foreground"> · {t('detail.noParticipant')}</span>
                              )}
                            </SelectItem>
                          );
                        })}
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
                  <InfoRow label={t('detail.relatedTo')}>
                    {ticket.entity ? (
                      <Badge variant="outline" className="max-w-full gap-1">
                        {EntityIcon && <EntityIcon className="h-3 w-3 shrink-0" />}
                        <span className="truncate">{ticket.entity.label}</span>
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {ticket.entity_id || t('common:values.notAvailable')}
                      </span>
                    )}
                  </InfoRow>
                  {ticket.tracking_number && (
                    <InfoRow label={t('detail.tracking')}>
                      <span className="font-mono text-xs">{ticket.tracking_number}</span>
                    </InfoRow>
                  )}
                </div>

                {/* Assigned to + escalate */}
                <SidebarSection label={t('detail.assignedTo')} className="border-t pt-4">
                  {assignee ? (
                    <div className="flex items-center gap-2.5">
                      <ActorAvatar actor={assignee} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{assignee.name}</p>
                        <p className="text-xs text-muted-foreground">{roleLabel(assignee.role)}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('detail.unassigned')}</p>
                  )}
                  {!isClosed && (
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

                {/* Followers */}
                <SidebarSection label={t('detail.followers')} className="border-t pt-4">
                  <ul className="space-y-2">
                    {followers.length === 0 ? (
                      <li className="text-sm text-muted-foreground">{t('detail.noFollowers')}</li>
                    ) : (
                      followers.map((f) => (
                        <li key={f.user_id} className="flex items-center gap-2.5">
                          <ActorAvatar actor={f} className="h-7 w-7" />
                          <div className="min-w-0">
                            <p className="truncate text-sm">{f.name}</p>
                            <p className="text-xs text-muted-foreground">{roleLabel(f.role)}</p>
                          </div>
                        </li>
                      ))
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
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmCloseOpen(true)}
              disabled={pendingKey === 'close'}
            >
              <CircleSlash className="me-2 h-4 w-4" />
              {t('detail.closeTicket')}
            </Button>
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

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-end font-medium">{children}</span>
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
