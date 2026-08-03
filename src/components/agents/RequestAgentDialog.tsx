import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ContractTermsFields } from '@/components/agents/ContractTermsFields';
import {
  blankTermsForm,
  buildOfferPayload,
  feeSplitError,
  type TermsForm,
} from '@/components/agents/contractTerms';
import { useIsMobile } from '@/hooks/use-mobile';
import type { AgentDirectoryItem, NegotiableTermsPayload } from '@/types/agent.types';

/**
 * The offer attached to `POST /agency/agents/requests`.
 *
 * Requesting an agent is not an introduction, it is a proposal with numbers in
 * it: `terms` is required and must carry a `fee_split`, because a request
 * without one would land the agent on the schema default — a percentage model
 * with a null share, which pays them **zero**. The server rejects a bare
 * `{ agentId }` with a 400 rather than let that happen, so this dialog stands
 * between the Request button and the call.
 *
 * Nothing here binds either side. The agent may accept, decline, or counter with
 * their own figures, and only their acceptance makes the contract live.
 */

export interface RequestAgentDialogProps {
  agent: AgentDirectoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  /** Resolves to a truthy value when the request went through. */
  onSubmit: (terms: NegotiableTermsPayload) => Promise<unknown>;
}

export function RequestAgentDialog({
  agent,
  open,
  onOpenChange,
  busy,
  onSubmit,
}: RequestAgentDialogProps) {
  const isMobile = useIsMobile();
  // Keyed on the agent so reopening for someone else starts from a blank offer
  // rather than the last one's figures.
  const body = agent && (
    <RequestBody key={agent.id} agent={agent} busy={busy} onOpenChange={onOpenChange} onSubmit={onSubmit} />
  );

  if (isMobile) {
    return (
      <Sheet open={open && !!agent} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[92dvh] gap-0 rounded-t-2xl p-0">
          <div className="mx-auto mb-1 mt-2 h-1 w-10 flex-shrink-0 rounded-full bg-muted" />
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open && !!agent} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85vh,42rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {body}
      </DialogContent>
    </Dialog>
  );
}

function RequestBody({
  agent,
  busy,
  onOpenChange,
  onSubmit,
}: {
  agent: AgentDirectoryItem;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (terms: NegotiableTermsPayload) => Promise<unknown>;
}) {
  const { t } = useTranslation(['agents', 'common']);
  const [form, setForm] = useState<TermsForm>(blankTermsForm);
  const [error, setError] = useState<string | null>(null);

  const setTerm = <K extends keyof TermsForm>(key: K, value: TermsForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const send = async () => {
    // There is no stored split to merge over on a first offer, so the form has
    // to stand on its own — the same coherence rule the server applies.
    const splitError = feeSplitError(form, blankTermsForm());
    if (splitError) {
      setError(splitError);
      return;
    }
    const result = await onSubmit(buildOfferPayload(form));
    if (result) onOpenChange(false);
  };

  return (
    <>
      <DialogHeader className="flex-shrink-0 gap-1 border-b px-4 py-4 pr-14 text-start sm:px-6 sm:py-5">
        <DialogTitle className="text-base">{t('offerDialog.title', { name: agent.name })}</DialogTitle>
        <DialogDescription>{t('offerDialog.description')}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
        <ContractTermsFields form={form} onChange={setTerm} seed={blankTermsForm()} />
      </div>

      <DialogFooter className="flex-shrink-0 gap-2 border-t bg-muted/20 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 sm:pb-4">
        <p className={error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {error ?? t('offerDialog.feeSplitRequired')}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button size="sm" disabled={busy} onClick={send}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('offerDialog.send')}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
