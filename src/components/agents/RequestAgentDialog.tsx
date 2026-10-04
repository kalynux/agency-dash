import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CalendarClock, Loader2, MapPinned, Send, ShieldCheck, User, Wallet } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { ContractTermsFields } from '@/components/agents/ContractTermsFields';
import {
  blankTermsForm,
  buildOfferPayload,
  cadenceLabel,
  feeSplitError,
  type TermsForm,
} from '@/components/agents/contractTerms';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAgencyCountry } from '@/hooks/useAgencyCountry';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMagazin } from '@/store/magazin.store';
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
 *
 * Three shapes, one body: a bottom sheet on a phone, a single-column popup on a
 * tablet, and on desktop a popup with a side panel that keeps the offer's
 * recap and what happens next in view while the form scrolls.
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
  // An in-flight request must not be abandoned by a stray tap on the scrim.
  const handleOpenChange = (next: boolean) => {
    if (!next && busy) return;
    onOpenChange(next);
  };
  // Keyed on the agent so reopening for someone else starts from a blank offer
  // rather than the last one's figures.
  const body = agent && (
    <RequestBody
      key={agent.id}
      agent={agent}
      busy={busy}
      isMobile={isMobile}
      onOpenChange={handleOpenChange}
      onSubmit={onSubmit}
    />
  );

  if (isMobile) {
    return (
      <Sheet open={open && !!agent} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-auto max-h-[94dvh] flex-col gap-0 rounded-t-3xl p-0 shadow-[0_-12px_48px_-12px_rgb(0_0_0/0.35)]"
        >
          <div aria-hidden className="flex shrink-0 justify-center pb-1 pt-2.5">
            <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open && !!agent} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[min(88dvh,48rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl lg:max-w-5xl lg:flex-row">
        {body}
      </DialogContent>
    </Dialog>
  );
}

/** The offer as the few figures the agent will look at first. */
function useOfferRecap(form: TermsForm) {
  const { t, i18n } = useTranslation('agents');
  return useMemo(() => {
    const currency = form.currency.trim().toUpperCase() || 'XAF';
    const money = (raw: string) => formatCurrency(Number(raw), currency);
    const notSet = t('terms.values.notSet');

    const pay =
      form.feeModel === 'monthly_salary'
        ? form.monthlySalary ? t('offerDialog.perMonth', { amount: money(form.monthlySalary) }) : notSet
        : form.feeModel === 'flat'
          ? form.flatFee ? money(form.flatFee) : notSet
          : form.sharePercent ? `${form.sharePercent} %` : notSet;

    let remittance = form.cadence ? cadenceLabel(form.cadence) : notSet;
    if (['weekly', 'biweekly'].includes(form.cadence) && form.dayOfWeek !== '') {
      const day = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' })
        .format(new Date(2024, 0, 7 + Number(form.dayOfWeek)));
      remittance = `${remittance} · ${day}`;
    } else if (form.cadence === 'monthly' && form.dayOfMonth !== '') {
      remittance = `${remittance} · ${form.dayOfMonth}`;
    }

    const coverage = form.regions.length === 0
      ? t('offerDialog.allRegions')
      : t('offerDialog.regionCount', { count: form.regions.length });
    const ceiling = form.ceiling.trim() === '' ? t('terms.values.noCap') : money(form.ceiling);

    return { pay, payMissing: pay === notSet, remittance, coverage, ceiling };
  }, [form, t, i18n.language]);
}

function RequestBody({
  agent,
  busy,
  isMobile,
  onOpenChange,
  onSubmit,
}: {
  agent: AgentDirectoryItem;
  busy: boolean;
  isMobile: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (terms: NegotiableTermsPayload) => Promise<unknown>;
}) {
  const { t } = useTranslation(['agents', 'common']);
  const [form, setForm] = useState<TermsForm>(blankTermsForm);
  const [error, setError] = useState<string | null>(null);
  // Both zero-fetch — the country rides on the session (with the magazin's own
  // pins as backstop), the magazin is loaded once per dashboard session. A blank
  // offer never holds legacy free text, so this dialog needs no repair path:
  // there is nothing stored to be rejected.
  const country = useAgencyCountry();
  const { data: magazin } = useMagazin();
  const recap = useOfferRecap(form);

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
      {/* Desktop only: the recap and the next steps stay put while the form scrolls. */}
      <aside className="hidden w-80 shrink-0 flex-col gap-6 overflow-y-auto border-e bg-muted/40 p-6 lg:flex">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('offerDialog.recapTitle')}
          </p>
          <dl className="divide-y rounded-2xl border bg-card shadow-xs">
            <RecapRow icon={Wallet} label={t('terms.fields.feeSplit')} value={recap.pay} muted={recap.payMissing} emphasis />
            <RecapRow icon={CalendarClock} label={t('terms.fields.remittance')} value={recap.remittance} />
            <RecapRow icon={MapPinned} label={t('terms.fields.regions')} value={recap.coverage} />
            <RecapRow icon={ShieldCheck} label={t('terms.fields.ceiling')} value={recap.ceiling} />
          </dl>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('offerDialog.nextTitle')}
          </p>
          <ol className="space-y-4">
            {[
              t('offerDialog.next.send'),
              t('offerDialog.next.review', { name: agent.name }),
              t('offerDialog.next.live'),
            ].map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-sm leading-snug text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b px-4 pb-4 pe-12 pt-2 md:px-6 md:pb-5 md:pt-6">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-background">
            {agent.avatar?.url ? (
              <img src={agent.avatar.url} alt="" className="size-full object-cover" />
            ) : (
              <User className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              {t('offerDialog.kicker')}
            </p>
            <DialogTitle className="flex items-center gap-1 text-base font-semibold leading-tight md:text-lg">
              <span className="truncate">{agent.name}</span>
              <VerifiedBadge verified={agent.kycVerified} className="text-sm" />
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs leading-snug text-muted-foreground lg:sr-only">
              {t('offerDialog.description')}
            </DialogDescription>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/30 px-4 py-4 md:px-6 md:py-5">
          <ContractTermsFields
            form={form}
            onChange={setTerm}
            seed={blankTermsForm()}
            country={country}
            coverageAreas={magazin?.coverageAreas}
          />
        </div>

        <footer className="shrink-0 space-y-3 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:flex md:items-center md:justify-between md:gap-4 md:space-y-0 md:px-6 md:py-4">
          <div className="min-w-0 md:flex-1">
            {error ? (
              <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-destructive">
                <AlertCircle className="mt-px size-3.5 shrink-0" />
                {error}
              </p>
            ) : (
              <>
                {/* Below desktop the side panel is gone, so the deal rides on the footer. */}
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground lg:hidden">
                  <span className={cn('font-semibold', recap.payMissing ? 'text-muted-foreground' : 'text-foreground')}>
                    {recap.pay}
                  </span>
                  <Dot />
                  <span>{recap.remittance}</span>
                  <Dot />
                  <span>{recap.coverage}</span>
                </p>
                <p className="hidden text-xs text-muted-foreground lg:block">
                  {t('offerDialog.feeSplitRequired')}
                </p>
              </>
            )}
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2 md:flex md:shrink-0">
            <Button
              variant="outline"
              size={isMobile ? 'lg' : 'default'}
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button size={isMobile ? 'lg' : 'default'} disabled={busy} onClick={send} className="gap-2 md:min-w-36">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {t('offerDialog.send')}
            </Button>
          </div>
        </footer>
      </div>
    </>
  );
}

function Dot() {
  return <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />;
}

function RecapRow({
  icon: Icon,
  label,
  value,
  muted,
  emphasis,
}: {
  icon: typeof Wallet;
  label: string;
  value: ReactNode;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd
          className={cn(
            'mt-0.5 break-words text-sm font-medium',
            emphasis && 'text-lg font-semibold tabular-nums',
            muted && 'text-base font-normal text-muted-foreground',
          )}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}
