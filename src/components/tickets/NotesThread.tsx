import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Loader2, Lock, Globe, Send, Info, UserPlus, UserMinus, ArrowRightLeft, Flag, UserCheck,
  CircleSlash, RotateCcw, type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ticketsService } from '@/services/tickets.service';
import { getApiErrorMessage } from '@/lib/errors';
import { ActorAvatar } from './ActorAvatar';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { FollowerSelect } from './FollowerSelect';
import {
  roleLabel, statusLabel, priorityLabel, relativeTime, NOTE_MAX_LENGTH,
} from './ticket.constants';
import { actorName, parseSystemNote } from './ticket.rules';
import type { TicketNote, TicketActor } from '@/types/ticket.types';

type NoteVisibility = 'public' | 'private';

export interface NotesThreadProps {
  ticketId: string;
  /** The ticket's followers — the only people a private note can be addressed to. */
  followers: TicketActor[];
  /** The signed-in user, left out of the recipient picker (an author always sees their own note). */
  currentUserId?: string | null;
  /**
   * Bump to re-read the thread without a loading flash. A status, priority or
   * assignment change appends a system note, and that event belongs on screen.
   */
  refreshKey?: number;
  readOnly?: boolean;
}

export function NotesThread({
  ticketId, followers, currentUserId, refreshKey = 0, readOnly = false,
}: NotesThreadProps) {
  const { t } = useTranslation('tickets');
  const [notes, setNotes] = useState<TicketNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [visibility, setVisibility] = useState<NoteVisibility>('public');
  const [viewerIds, setViewerIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);
  /** The ticket whose notes are on screen, so a refresh of the same one stays quiet. */
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const silent = loadedFor.current === ticketId;
    if (!silent) setLoading(true);
    ticketsService
      .listNotes(ticketId)
      .then((res) => {
        if (!active) return;
        setNotes(res.data);
        loadedFor.current = ticketId;
      })
      .catch((err) => {
        if (active && !silent) toast.error(getApiErrorMessage(err));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [ticketId, refreshKey]);

  // A recipient who stopped following the ticket would get the whole note
  // refused (403), so drop anyone no longer in the list.
  useEffect(() => {
    setViewerIds((prev) => {
      const still = prev.filter((id) => followers.some((f) => f.user_id === id));
      return still.length === prev.length ? prev : still;
    });
  }, [followers]);

  const messageCount = notes.reduce((n, note) => n + (note.is_system_note ? 0 : 1), 0);

  async function handleSend() {
    const trimmed = message.trim();
    if (!trimmed) return;
    if (trimmed.length > NOTE_MAX_LENGTH) {
      toast.error(t('notes.tooLong', { max: NOTE_MAX_LENGTH }));
      return;
    }
    setSubmitting(true);
    try {
      const res = await ticketsService.addNote(
        ticketId,
        trimmed,
        visibility,
        visibility === 'private' && viewerIds.length ? viewerIds : undefined,
      );
      setNotes((prev) => [...prev, res.data]);
      setMessage('');
      requestAnimationFrame(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{t('notes.title')}</h3>
        {/* Messages only: a "joined the ticket" event is not something anyone wrote. */}
        {!loading && messageCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {t('notes.count', { count: messageCount })}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-3/4" />
        </div>
      ) : notes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t('notes.empty')}
        </p>
      ) : (
        <ul className="space-y-4">
          {notes.map((note) => (note.is_system_note ? (
            <TimelineEvent key={note.id} note={note} />
          ) : (
            <li key={note.id} className="flex gap-3">
              <ActorAvatar actor={note.author} role={note.author_role} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 text-sm font-medium">
                    {actorName(note.author) ?? roleLabel(note.author_role)}
                    <VerifiedBadge verified={note.author?.verified} />
                  </span>
                  <Badge
                    variant="secondary"
                    className="px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide"
                  >
                    {roleLabel(note.author_role)}
                  </Badge>
                  {note.visibility === 'private' && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-amber-300 px-1.5 py-0 text-[10px] text-amber-700 dark:text-amber-400"
                    >
                      <Lock className="h-2.5 w-2.5" /> {t('notes.private')}
                    </Badge>
                  )}
                </div>
                <div className="rounded-lg rounded-ss-sm bg-muted/60 px-3 py-2 text-sm">
                  <p className="whitespace-pre-wrap">{note.content}</p>
                </div>
                <span className="text-xs text-muted-foreground">{relativeTime(note.created_at)}</span>
              </div>
            </li>
          )))}
          <div ref={listEndRef} />
        </ul>
      )}

      {/* Composer */}
      {readOnly ? (
        <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm text-muted-foreground/70">
          <Lock className="h-3.5 w-3.5" />
          {t('notes.closed')}
        </p>
      ) : (
        <div className="space-y-2 rounded-lg border p-3">
          <Textarea
            rows={3}
            placeholder={t('notes.placeholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={NOTE_MAX_LENGTH}
            className="resize-none border-0 px-0 shadow-none focus-visible:ring-0"
          />
          <div className="space-y-2 border-t pt-2">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex rounded-md border p-0.5">
                <VisibilityToggle
                  active={visibility === 'public'}
                  onClick={() => { setVisibility('public'); setViewerIds([]); }}
                  icon={<Globe className="h-3.5 w-3.5" />}
                  label={t('notes.public')}
                />
                <VisibilityToggle
                  active={visibility === 'private'}
                  onClick={() => setVisibility('private')}
                  icon={<Lock className="h-3.5 w-3.5" />}
                  label={t('notes.private')}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {t('notes.charCount', { current: message.length, max: NOTE_MAX_LENGTH })}
                </span>
                <Button size="sm" onClick={handleSend} disabled={submitting || !message.trim()}>
                  {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4 rtl:-scale-x-100" />}
                  {t('notes.send')}
                </Button>
              </div>
            </div>
            {visibility === 'private' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{t('notes.visibleTo')}</span>
                <FollowerSelect
                  followers={followers}
                  excludeUserId={currentUserId}
                  value={viewerIds}
                  onChange={setViewerIds}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * A system note, drawn as a point on the ticket's timeline rather than as a
 * message: nobody wrote it, so it gets no avatar, no author and no bubble.
 *
 * The wording is ours. The stored text is a fixed English sentence, so the
 * sentences we recognise are re-said in the reader's language; one we do not is
 * shown as stored.
 */
function TimelineEvent({ note }: { note: TicketNote }) {
  const { t } = useTranslation('tickets');
  const event = parseSystemNote(note.content);

  let Icon: LucideIcon = Info;
  let text = note.content;
  switch (event?.kind) {
    case 'follower_added':
      Icon = UserPlus;
      text = t('timeline.followerAdded', { role: roleLabel(event.role) });
      break;
    case 'follower_removed':
      Icon = UserMinus;
      text = t('timeline.followerRemoved');
      break;
    case 'status_changed':
      Icon = ArrowRightLeft;
      text = t('timeline.statusChanged', { from: statusLabel(event.from), to: statusLabel(event.to) });
      break;
    case 'priority_changed':
      Icon = Flag;
      text = t(event.locked ? 'timeline.priorityLocked' : 'timeline.priorityChanged', {
        from: priorityLabel(event.from),
        to: priorityLabel(event.to),
      });
      break;
    case 'assigned':
      Icon = UserCheck;
      text = t('timeline.assigned', { role: roleLabel(event.role) });
      break;
    case 'assigned_admin':
      Icon = UserCheck;
      text = t('timeline.assignedAdmin', { name: event.name });
      break;
    case 'closed':
      Icon = CircleSlash;
      text = t('timeline.closed');
      break;
    case 'reopened':
      Icon = RotateCcw;
      text = t('timeline.reopened');
      break;
  }

  return (
    <li className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px min-w-4 flex-1 bg-border" aria-hidden />
      <span className="inline-flex max-w-[80%] items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="text-center">{text}</span>
        <span aria-hidden>·</span>
        <time dateTime={note.created_at} className="shrink-0">{relativeTime(note.created_at)}</time>
      </span>
      <span className="h-px min-w-4 flex-1 bg-border" aria-hidden />
    </li>
  );
}

function VisibilityToggle({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
        active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
