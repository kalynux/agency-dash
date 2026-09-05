import { formatDate } from '@/lib/format';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, FileDiff, Loader2, Undo2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { termPathLabel, termValueText } from '@/components/agents/contractTerms';
import type {
  ContractStatusRequestDecision,
  ContractTermsProposal,
  TermsProposalAction,
} from '@/types/agent.types';

/**
 * One open change to a **live** contract's terms, in whichever direction it runs.
 *
 * The distinction this panel exists to make: a proposal has changed nothing. The
 * contract goes on pricing deliveries by its agreed fee split until it is
 * accepted, so the copy says so outright — a reader who assumes the new rate is
 * already in effect will quote the wrong number to their agent.
 *
 * `GET /agency/agents/terms-proposals` returns both directions, because it is
 * the only place a `proposalId` is exposed and `cancel` needs ours. Which verbs
 * belong on a row is never inferred from that: `availableActions` is computed
 * from the same guards the service enforces, so a button it offers is one the
 * server will accept.
 */

export interface TermsProposalPanelProps {
  proposal: ContractTermsProposal;
  busy: boolean;
  note: string;
  noteOpen: boolean;
  onNoteChange: (value: string) => void;
  onOpenNote: () => void;
  onResolve: (decision: ContractStatusRequestDecision) => void;
  onCancel: () => void;
  /** Opens the terms editor seeded with the proposal, to answer with our own figures. */
  onCounter?: () => void;
}

export function TermsProposalPanel({
  proposal,
  busy,
  note,
  noteOpen,
  onNoteChange,
  onOpenNote,
  onResolve,
  onCancel,
  onCounter,
}: TermsProposalPanelProps) {
  const { t } = useTranslation('agents');
  const can = (action: TermsProposalAction) => proposal.availableActions?.includes(action);
  const mine = proposal.proposedByRole === 'agency';

  return (
    <div className="space-y-2.5 rounded-lg border bg-muted/30 p-2.5 md:space-y-3 md:p-3">
      <div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge variant="outline" className="gap-1">
            <FileDiff className="h-3 w-3" />
            {mine ? t('termsProposal.mineBadge') : t('termsProposal.theirsBadge')}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {t('termsProposal.raised', { date: formatDate(proposal.createdAt) })}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground md:text-sm">
          {mine ? t('termsProposal.mineDescription') : t('termsProposal.theirsDescription')}
        </p>
        {proposal.note && (
          <p className="mt-1 text-xs md:text-sm">{t('termsProposal.quoted', { text: proposal.note })}</p>
        )}
      </div>

      {/* The diff is server-computed against a snapshot taken when the proposal
          was raised, so it stays honest even if the contract has moved on since. */}
      {proposal.diff.length > 0 ? (
        <div className="divide-y rounded-lg border bg-card">
          {proposal.diff.map((entry) => (
            <div key={entry.path} className="px-2.5 py-2 md:px-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground md:text-[11px]">
                {termPathLabel(entry.path)}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] md:text-sm">
                <span className="text-muted-foreground line-through">
                  {termValueText(entry.path, entry.before)}
                </span>
                <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground rtl:-scale-x-100" />
                <span className="font-medium">{termValueText(entry.path, entry.after)}</span>
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('termsProposal.noChange')}</p>
      )}

      {noteOpen && (
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder={t('termsProposal.notePlaceholder')}
        />
      )}

      {/* Two to a row on a phone, natural widths from `md` up: three buttons
          wrapping one-per-line is what turned this panel into a wall. */}
      <div className="flex flex-wrap gap-2 max-md:[&>*]:flex-1 max-md:[&>*]:basis-[calc(50%-0.25rem)]">
        {can('approve') && (
          <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => onResolve('approve')}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {t('termsProposal.accept')}
          </Button>
        )}
        {can('reject') && (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => onResolve('reject')}>
            <X className="h-3.5 w-3.5" /> {t('termsProposal.decline')}
          </Button>
        )}
        {/* Countering supersedes rather than rejects: the old row is recorded as
            `superseded` and the new one points back at it, so a multi-round
            negotiation stays reconstructible. */}
        {can('counter') && onCounter && (
          <Button size="sm" variant="outline" disabled={busy} onClick={onCounter}>
            {t('termsProposal.counter')}
          </Button>
        )}
        {can('cancel') && (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={onCancel}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
            {t('termsProposal.withdraw')}
          </Button>
        )}
        {!noteOpen && proposal.availableActions?.length > 0 && (
          <Button size="sm" variant="ghost" onClick={onOpenNote}>
            {t('termsProposal.addNote')}
          </Button>
        )}
      </div>
    </div>
  );
}
