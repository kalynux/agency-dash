import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRightLeft,
  CheckCircle2,
  CircleDot,
  PauseCircle,
  PlayCircle,
  Send,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';

import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { tokenLabel } from '@/components/agents/tokenLabel';
import { membershipEventAt } from '@/types/agent.types';
import type { AgentHistoryEvent } from '@/types/agent.types';

/**
 * One row of the membership log, rendered as a sentence about a person rather
 * than a dump of the event document: *who*, *what changed*, *when*.
 *
 * Used by both history views — the per-agent log inside the membership sheet and
 * the agency-wide roster history tab — because they are the same event shape
 * from the same append-only collection (`GET /agency/agents/:agentId/history`
 * and `GET /agency/agents/history` return identical rows). The only difference
 * is whether the surrounding view already names the agent: inside the sheet it
 * does, so `who` is omitted and the event type carries the line.
 */

/** A string field off the open-ended event document, or null. */
function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/**
 * Icon per event type, grouped by what the event did to the contract rather than
 * by its name — so a list of twenty scans as "started / ended / paused" before
 * a single label is read. An unknown token (the log is append-only and the enum
 * grows) falls through to the neutral dot.
 */
const EVENT_ICON: Record<string, ComponentType<{ className?: string }>> = {
  invited: Send,
  join_requested: Send,
  invite_accepted: CheckCircle2,
  approved: CheckCircle2,
  reinstated: PlayCircle,
  transferred_in: ArrowRightLeft,
  transferred_out: ArrowRightLeft,
  invite_declined: XCircle,
  invite_revoked: XCircle,
  request_declined: XCircle,
  withdrawn: XCircle,
  removed: XCircle,
  suspended: XCircle,
  paused: PauseCircle,
  primary_changed: SlidersHorizontal,
  employment_updated: SlidersHorizontal,
  terms_updated: SlidersHorizontal,
  cod_limit_changed: SlidersHorizontal,
};

/** Tone per event type. Only the two outcomes that matter get colour. */
const EVENT_TONE: Record<string, string> = {
  invite_accepted: 'text-emerald-600 dark:text-emerald-400',
  approved: 'text-emerald-600 dark:text-emerald-400',
  reinstated: 'text-emerald-600 dark:text-emerald-400',
  transferred_in: 'text-emerald-600 dark:text-emerald-400',
  invite_declined: 'text-destructive',
  invite_revoked: 'text-destructive',
  request_declined: 'text-destructive',
  withdrawn: 'text-destructive',
  removed: 'text-destructive',
  suspended: 'text-destructive',
  paused: 'text-amber-600 dark:text-amber-400',
};

export interface MembershipEventItemProps {
  event: AgentHistoryEvent;
  /**
   * The agent this event is about. Omitted inside the membership sheet, where
   * the whole panel is already one agent and repeating the name on every row
   * would say nothing.
   */
  who?: string | null;
  /** Hides the timestamp's date half — for a list already grouped under a day. */
  timeOnly?: boolean;
  className?: string;
}

export function MembershipEventItem({ event, who, timeOnly, className }: MembershipEventItemProps) {
  const { t } = useTranslation(['agents', 'common']);

  const at = membershipEventAt(event);
  const from = str(event.fromStatus);
  const to = str(event.toStatus);
  const actor = str(event.actorRole);
  // `reason` is the field the server writes; `note` predates it and is still
  // read so an older row is not rendered blank.
  const reason = str(event.reason) ?? str(event.note);
  const Icon = EVENT_ICON[event.type] ?? CircleDot;

  const when = at
    ? timeOnly
      ? formatDateTime(at, { hour: 'numeric', minute: '2-digit' })
      : formatDateTime(at)
    : null;

  // A transition is only worth printing when it actually moved the state
  // machine. `cod_limit_changed` and friends carry null on both ends, and a
  // no-op `active → active` says less than nothing.
  const moved = !!(from && to && from !== to);

  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <Icon
        aria-hidden
        className={cn('mt-0.5 h-4 w-4 flex-shrink-0', EVENT_TONE[event.type] ?? 'text-muted-foreground')}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          {who && <span className="font-medium">{who}</span>}
          {who && <span aria-hidden className="mx-1 text-muted-foreground">·</span>}
          <span className={cn(!who && 'font-medium')}>
            {tokenLabel('agents:historyEvents', event.type)}
          </span>
        </p>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {when && <span>{when}</span>}
          {moved && (
            <>
              {when && <span aria-hidden className="opacity-40">·</span>}
              <span className="whitespace-nowrap">
                {tokenLabel('agents:membershipStatus', from)}
                <span aria-hidden className="mx-1 inline-block rtl:-scale-x-100">→</span>
                {tokenLabel('agents:membershipStatus', to)}
              </span>
            </>
          )}
          {actor && (
            <>
              {(when || moved) && <span aria-hidden className="opacity-40">·</span>}
              <span>{t('rosterHistory.byActor', { actor: tokenLabel('agents:historyActors', actor) })}</span>
            </>
          )}
        </p>

        {reason && <p className="mt-1 break-words text-xs text-muted-foreground">{reason}</p>}
      </div>
    </div>
  );
}
