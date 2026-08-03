import { formatNumber, formatDate } from '@/lib/format';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Loader2, Undo2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { tx, type AnyTFunction } from '@/i18n/tx';
import type {
  ContractStatusRequest,
  ContractStatusRequestAction,
  ContractStatusRequestDecision,
} from '@/types/agent.types';

/**
 * One pending two-party contract change, in whichever direction it runs.
 *
 * `GET /agency/agents/status-requests` returns both — the pauses and departures
 * an agent proposed **and** the removals we did — because it is the only place a
 * `requestId` is exposed and `cancel` needs ours. So the same row renders as a
 * decision ("Wants to leave — Approve / Reject") or as a proposal in flight
 * ("Removal proposed — Cancel"), and which one is never guessed from the shape
 * of the data: `availableActions` names the verbs the server will accept.
 *
 * Lives in its own module rather than in ConnectionsTab because the Manage sheet
 * renders it too, and importing it back from there would close a cycle.
 */

/**
 * The transitions we have copy for. `transition` is a plain string on the wire,
 * so anything else falls back to its humanized token rather than painting a key.
 */
const KNOWN_TRANSITIONS = ['pause', 'reactivate', 'deactivate'];

function transitionCopy(t: AnyTFunction, transition: string, mine: boolean) {
  // `outgoing` is what WE proposed — ours to cancel; `incoming` is theirs.
  const direction = mine ? 'outgoing' : 'incoming';
  if (KNOWN_TRANSITIONS.includes(transition)) {
    return {
      label: tx(t, `agents:statusRequest.${direction}.${transition}.label`),
      description: tx(t, `agents:statusRequest.${direction}.${transition}.description`),
    };
  }
  return {
    label: transition.replace(/_/g, ' '),
    description: tx(t, `agents:statusRequest.${direction}.fallbackDescription`),
  };
}

export interface StatusRequestPanelProps {
  request: ContractStatusRequest;
  busy: boolean;
  note: string;
  noteOpen: boolean;
  onNoteChange: (value: string) => void;
  onOpenNote: () => void;
  onResolve: (decision: ContractStatusRequestDecision) => void;
  onCancel: () => void;
}

export function StatusRequestPanel({
  request,
  busy,
  note,
  noteOpen,
  onNoteChange,
  onOpenNote,
  onResolve,
  onCancel,
}: StatusRequestPanelProps) {
  const { t } = useTranslation('agents');
  const can = (action: ContractStatusRequestAction) => request.availableActions?.includes(action);
  const mine = !request.awaitingMyDecision;
  const copy = transitionCopy(t, request.transition, mine);
  const blocking = request.blockingConditions;
  const isBlocked = blocking != null && !blocking.clear;

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{copy.label}</Badge>
          <span className="text-xs text-muted-foreground">
            {t('statusRequest.raised', { date: formatDate(request.createdAt) })}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{copy.description}</p>
        {request.reason && (
          <p className="text-sm mt-1">{t('statusRequest.quoted', { text: request.reason })}</p>
        )}
      </div>

      {isBlocked && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-500">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium">{t('statusRequest.blocked.title')}</p>
            {blocking.outstandingCod > 0 && (
              <p>
                {t('statusRequest.blocked.outstandingCod', {
                  amount: formatNumber(blocking.outstandingCod),
                })}
              </p>
            )}
            {blocking.outstandingPayment > 0 && (
              <p>
                {t('statusRequest.blocked.outstandingPayment', {
                  amount: formatNumber(blocking.outstandingPayment),
                })}
              </p>
            )}
            <p className="opacity-80">
              {mine
                ? t('statusRequest.blocked.recheckMine')
                : t('statusRequest.blocked.recheckTheirs')}
            </p>
          </div>
        </div>
      )}

      {noteOpen && (
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder={t('statusRequest.notePlaceholder')}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {can('approve') && (
          <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => onResolve('approve')}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {t('statusRequest.approve')}
          </Button>
        )}
        {can('reject') && (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => onResolve('reject')}>
            <X className="w-3.5 h-3.5" /> {t('statusRequest.reject')}
          </Button>
        )}
        {can('cancel') && (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={onCancel}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
            {t('statusRequest.cancel')}
          </Button>
        )}
        {!noteOpen && request.availableActions?.length > 0 && (
          <Button size="sm" variant="ghost" onClick={onOpenNote}>
            {t('statusRequest.addNote')}
          </Button>
        )}
      </div>
    </div>
  );
}
