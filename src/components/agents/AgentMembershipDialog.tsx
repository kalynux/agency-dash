import { formatNumber, formatDate as fmtDate } from '@/lib/format';
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  History,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Package,
  PauseCircle,
  Phone,
  Save,
  ShieldAlert,
  ShieldCheck,
  Signal,
  Star,
  User,
  UserMinus,
  XCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MembershipStatusBadge } from '@/components/agents/MembershipStatusBadge';
import { StatusRequestPanel } from '@/components/agents/StatusRequestPanel';
import { TermsProposalPanel } from '@/components/agents/TermsProposalPanel';
import { ContractTermsFields } from '@/components/agents/ContractTermsFields';
import {
  buildEmploymentPayload,
  buildNegotiablePayload,
  coverageRegionRepair,
  feeSplitError,
  regionLabel,
  seedTermsForm,
  summarizeTerms,
  termPathLabel,
  termValueText,
  type CoverageRegionRepair,
  type TermsForm,
} from '@/components/agents/contractTerms';
import {
  getVehicleIcon,
  formatVehicleType,
  formatVehicleColor,
  vehicleColorSwatch,
} from '@/components/agents/vehicle.constants';
import { useAgentActions } from '@/hooks/useAgentActions';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAgentsRoster } from '@/store/agents.store';
import { useMagazin } from '@/store/magazin.store';
import { useAgencyCountry } from '@/hooks/useAgencyCountry';
import { agentsService } from '@/services/agents.service';
import { cn } from '@/lib/utils';
import { txStatic } from '@/i18n/tx';
import {
  agentAvatarUrl,
  contractOffer,
  mergeAgentDetail,
  needsTermsProposal,
  HISTORY_MEMBERSHIP_STATUSES,
} from '@/types/agent.types';
import type {
  RosterEntry,
  AgentMembership,
  AgentEligibility,
  AgentHistoryEvent,
  AgentProfileDetail,
  ContractSettlements,
  ContractTermsProposal,
} from '@/types/agent.types';

function formatDate(iso: string | null | undefined) {
  return fmtDate(iso);
}

/** The `membership.ending.*` keys, so the switch below stays exhaustive. */
type EndingKey =
  | 'membership.ending.rejected'
  | 'membership.ending.withdrawn'
  | 'membership.ending.deactivated'
  | 'membership.ending.transferred';

/**
 * How a terminal contract ended, or null while it is still live.
 *
 * Each terminal status has its own stamp and reason field — `rejected` and
 * `withdrawn` are the two halves of a refused handshake, `deactivated` an agreed
 * departure — and the field names for the last one predate the status rename.
 */
function contractEnding(
  membership: AgentMembership,
): { labelKey: EndingKey; at: string | null; reason: string | null } | null {
  switch (membership.status) {
    case 'rejected':
      return {
        labelKey: 'membership.ending.rejected',
        at: membership.rejectedAt,
        reason: membership.rejectionReason,
      };
    case 'withdrawn':
      return {
        labelKey: 'membership.ending.withdrawn',
        at: membership.withdrawnAt,
        reason: membership.withdrawalReason,
      };
    case 'deactivated':
      return {
        labelKey: membership.transferredToAgencyId
          ? 'membership.ending.transferred'
          : 'membership.ending.deactivated',
        at: membership.removedAt,
        reason: membership.removalReason,
      };
    default:
      return null;
  }
}

/**
 * Copy for a backend token, falling back to its humanized form.
 *
 * Contract origins, history event types, eligibility rules and deposit statuses
 * are all open unions on the wire (`(string & {})`) and the membership log is
 * append-only, so a value we have no copy for still has to read as something.
 */
function tokenLabel(group: string, token: string): string {
  const key = `${group}.${token}`;
  const translated = txStatic(key);
  // i18next answers a missing key with the key MINUS its namespace, so both
  // forms have to count as "no copy for this". Comparing only against the
  // prefixed one painted `availability.<token>` onto the screen instead of
  // falling back.
  const bare = key.slice(key.indexOf(':') + 1);
  return translated === key || translated === bare ? token.replace(/_/g, ' ') : translated;
}

// ─── Layout primitives ────────────────────────────────────────────────────────

/** One labelled cell of the at-a-glance grid. Hairlines come from the parent's `gap-px`. */
function InfoTile({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-card px-3 py-2.5', className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" />
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

/**
 * A disclosure card. The trigger is a full-width row with a rotating chevron —
 * the old bare ghost button read as a heading, so nobody knew the terms editor
 * was in there at all.
 */
function Section({
  icon: Icon,
  title,
  summary,
  defaultOpen = false,
  open,
  onOpenChange,
  onOpen,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  /**
   * Controlled, for a section another control opens (Counter / Propose terms).
   * Pass it together with `onOpenChange`, or neither — Radix will not survive a
   * section flipping between the two modes mid-life.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpen?: () => void;
  children: ReactNode;
}) {
  return (
    <Collapsible
      {...(open === undefined ? { defaultOpen } : { open })}
      onOpenChange={(next) => {
        onOpenChange?.(next);
        if (next) onOpen?.();
      }}
      className="group/section rounded-xl border bg-card"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted/50">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          {summary && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{summary}</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/section:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t px-4 py-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

export interface AgentMembershipDialogProps {
  entry: RosterEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function AgentMembershipDialog({ entry, open, onOpenChange, onChanged }: AgentMembershipDialogProps) {
  const isMobile = useIsMobile();

  // Keyed on the contract so switching rows resets every editor and drops the
  // lazily-loaded panels — otherwise the previous agent's eligibility, history
  // and settlements would be shown for the next one.
  const body = entry && (
    <MembershipBody
      key={entry.membership.id}
      entry={entry}
      onOpenChange={onOpenChange}
      onChanged={onChanged}
    />
  );

  // A phone gets the bottom sheet the rest of the app uses for detail panels
  // (see AgentDetailSheet) — a centred dialog on a 375px screen leaves the
  // action footer somewhere in the middle of the viewport. `Sheet` and `Dialog`
  // are both `@radix-ui/react-dialog` over the same unscoped context, so the
  // body's `DialogTitle`/`DialogDescription` label either shell unchanged.
  //
  // Both shells set an EXPLICIT height rather than `max-h`. A flex column whose
  // height is only clamped by `max-height` has an indefinite main size, so
  // `flex-1` on the scroller resolves against content instead of the panel and
  // the footer gets pushed out past `overflow-hidden`. A definite height makes
  // `flex-1 min-h-0` unambiguous.
  if (isMobile) {
    return (
      <Sheet open={open && !!entry} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[92dvh] gap-0 rounded-t-2xl p-0">
          <div className="mx-auto mb-1 mt-2 h-1 w-10 flex-shrink-0 rounded-full bg-muted" />
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open && !!entry} onOpenChange={onOpenChange}>
      {/* `flex`/`p-0` override the base grid+padding; `overflow-hidden` keeps the
          rounded corners clipping the scroller. */}
      <DialogContent className="flex h-[min(88vh,46rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {body}
      </DialogContent>
    </Dialog>
  );
}

function MembershipBody({
  entry,
  onOpenChange,
  onChanged,
}: {
  entry: RosterEntry;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation(['agents', 'common']);
  // `CONTRACT_COVERAGE_REGION_INVALID` carries the server's full catalogue in
  // `details.allowedRegions`, so a rejected save repairs the picker instead of
  // leaving the agency to guess which entry was the bad one. The toast the runner
  // shows is unaffected.
  const [coverageRepair, setCoverageRepair] = useState<CoverageRegionRepair | null>(null);
  const actions = useAgentActions({
    onRosterChanged: onChanged,
    onError: (err) => setCoverageRepair(coverageRegionRepair(err)),
  });
  const { statusRequests, termsProposals } = useAgentsRoster();
  // Both zero-fetch: the country is on the session every route already has (with
  // the magazin's own pins as backstop), and the magazin is loaded once per
  // dashboard session.
  const country = useAgencyCountry();
  const { data: magazin } = useMagazin();
  const { membership, agent: rosterAgent, cashHeld } = entry;
  const mid = membership.id;

  /**
   * The full agent profile, which only the DETAIL endpoint resolves.
   *
   * The roster list returns the vehicle SUMMARY — `{ vehicle_type, plate_number,
   * color }` with no `photo` key at all, because it will not look up a file for
   * every row. So this fetches once on open and is merged OVER the roster copy
   * rather than replacing it: the dialog renders instantly from data we already
   * have, and only the photo pops in.
   *
   * Kept raw in state and merged at render time, so a roster refetch behind an
   * open sheet still reaches the screen instead of being pinned to whatever the
   * row said when the fetch resolved.
   */
  const [detail, setDetail] = useState<AgentProfileDetail | null>(null);
  useEffect(() => {
    let cancelled = false;
    agentsService
      .getMembership(mid)
      .then((res) => {
        if (!cancelled && res.data.agent) setDetail(res.data.agent);
      })
      // Non-fatal: everything on screen already came from the roster, and the
      // only thing lost is the photo.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mid]);

  const agent = useMemo(
    () => (detail ? mergeAgentDetail(rosterAgent, detail) : rosterAgent),
    [rosterAgent, detail],
  );

  // The pending two-party change on this contract, either direction — a break or
  // a departure the agent proposed, or a removal we did. It is read here as well
  // as on the row because this sheet is where "manage this agent" leads, and a
  // decision waiting on you must not be reachable only from the list behind it.
  const statusRequest = statusRequests.find((r) => r.contractId === mid) ?? null;
  // Likewise the open terms proposal — at most one per contract. Note this comes
  // from the roster's `/terms-proposals` fetch, not from `membership.openTermsProposalId`,
  // which most endpoints return as null regardless of whether one exists.
  const termsProposal = termsProposals.find((p) => p.contractId === mid) ?? null;

  // Inline "confirm with reason" modes
  const [mode, setMode] = useState<'suspend' | 'pause' | 'terminate' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [requestNoteOpen, setRequestNoteOpen] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [proposalNoteOpen, setProposalNoteOpen] = useState(false);
  const [proposalNote, setProposalNote] = useState('');

  // COD threshold + contract terms editors. Both are seeded from the contract
  // and diffed against that seed, which is what lets one footer button save the
  // sheet: an untouched group sends nothing at all.
  const [codSeed, setCodSeed] = useState(() =>
    membership.codThreshold > 0 ? String(membership.codThreshold) : '',
  );
  const [threshold, setThreshold] = useState(codSeed);
  const [termsSeed, setTermsSeed] = useState<TermsForm>(() => seedTermsForm(membership));
  const [terms, setTerms] = useState<TermsForm>(termsSeed);
  const [termsError, setTermsError] = useState<string | null>(null);
  /** Note sent with a proposal or counter-proposal, explaining the change. */
  const [termsNote, setTermsNote] = useState('');
  /**
   * Controlled, not `defaultOpen`: Counter / Propose in the footer and on the
   * proposal panel open this section, so its state has to be reachable from
   * outside it. Terminal contracts start closed — there is nothing to edit.
   */
  const [termsOpen, setTermsOpen] = useState(
    () => !HISTORY_MEMBERSHIP_STATUSES.includes(membership.status),
  );

  // Lazy eligibility / history / settlements
  const [eligibility, setEligibility] = useState<AgentEligibility | null>(null);
  const [eligLoading, setEligLoading] = useState(false);
  const [history, setHistory] = useState<AgentHistoryEvent[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [settlements, setSettlements] = useState<ContractSettlements | null>(null);
  const [settlementsLoading, setSettlementsLoading] = useState(false);
  const [trail, setTrail] = useState<ContractTermsProposal[] | null>(null);
  const [trailLoading, setTrailLoading] = useState(false);

  const VehicleIcon = getVehicleIcon(agent.vehicleInfo?.vehicle_type);
  const ending = contractEnding(membership);
  /** Terminal contracts are history — nothing on them can still be negotiated. */
  const editable = !HISTORY_MEMBERSHIP_STATUSES.includes(membership.status);
  const offer = contractOffer(membership);

  // Where a terms change goes depends entirely on the contract's status, and the
  // two routes are not interchangeable. A `pending` contract IS the offer, so
  // figures are written onto it and the ball moves to the agent. A live one is
  // pricing deliveries by an agreed split right now, so the same edit becomes a
  // proposal staged behind the agent's answer — `PATCH .../terms` there is a 409.
  const staged = needsTermsProposal(membership);
  // One open proposal per contract, by unique index, so a change can only be
  // superseded — never doubled up. Their proposal we may counter (which keeps
  // the negotiation chain); our own has to be withdrawn from the panel above,
  // and raising a second would be 409 CONTRACT_TERMS_PROPOSAL_ALREADY_PENDING.
  // `availableActions` decides, rather than `proposedByRole`, so this agrees
  // with whatever the server will actually accept on that row.
  const canCounterProposal = termsProposal?.availableActions?.includes('counter') ?? false;
  const proposalBlocked = staged && termsProposal != null && !canCounterProposal;

  const employmentPayload = buildEmploymentPayload(terms, termsSeed);
  const negotiablePayload = buildNegotiablePayload(terms, termsSeed);
  const employmentDirty = Object.keys(employmentPayload).length > 0;
  const negotiableDirty = Object.keys(negotiablePayload).length > 0;
  // `0` and an empty box are the same instruction — no cap — so the comparison
  // is on the number, not on the text. A half-typed `-` is neither dirty nor
  // sendable.
  const codValue = threshold.trim() === '' ? 0 : Number(threshold);
  const codDirty =
    Number.isFinite(codValue) &&
    codValue >= 0 &&
    codValue !== (codSeed === '' ? 0 : Number(codSeed));
  const dirty = employmentDirty || negotiableDirty || codDirty;

  const resetInline = () => {
    setMode(null);
    setReason('');
  };

  const clearRequestNote = <T,>(result: T): T => {
    if (result) {
      setRequestNoteOpen(false);
      setRequestNote('');
    }
    return result;
  };

  const clearProposalNote = <T,>(result: T): T => {
    if (result) {
      setProposalNoteOpen(false);
      setProposalNote('');
    }
    return result;
  };

  const setTerm = <K extends keyof TermsForm>(key: K, value: TermsForm[K]) => {
    setTerms((prev) => ({ ...prev, [key]: value }));
    setTermsError(null);
  };

  const loadEligibility = async () => {
    if (eligibility) return;
    setEligLoading(true);
    try {
      const res = await agentsService.getEligibility(agent.id);
      setEligibility(res.data);
    } catch {
      /* surfaced inline */
    } finally {
      setEligLoading(false);
    }
  };

  const loadHistory = async () => {
    if (history) return;
    setHistoryLoading(true);
    try {
      const res = await agentsService.agentHistory(agent.id);
      setHistory(res.data);
    } catch {
      /* surfaced inline */
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadSettlements = async () => {
    if (settlements) return;
    setSettlementsLoading(true);
    try {
      const res = await agentsService.getSettlements(mid);
      setSettlements(res.data);
    } catch {
      /* surfaced inline */
    } finally {
      setSettlementsLoading(false);
    }
  };

  const loadTrail = async () => {
    if (trail) return;
    setTrailLoading(true);
    try {
      const res = await agentsService.listContractTermsProposals(mid);
      setTrail(res.data);
    } catch {
      /* surfaced inline */
    } finally {
      setTrailLoading(false);
    }
  };

  /**
   * The one save for this sheet — but three writes behind it, because the API
   * draws the line there and not where a single button would.
   *
   * The COD ceiling and employment are the agency's own record, unilateral at
   * any status (`PUT .../cod-limit`, `PATCH .../employment`). The four
   * negotiated groups are the agent's business: countered onto a `pending`
   * contract, or staged as a proposal on a live one. Sending either unilateral
   * group through a negotiation route is `403 CONTRACT_TERMS_NOT_NEGOTIABLE`, so
   * they are split out rather than filtered.
   *
   * They run in that order and stop at the first failure: a later write going
   * out after an earlier one was refused would leave the form claiming
   * everything landed.
   */
  const saveAll = async () => {
    if (!dirty) {
      setTermsError(t('membership.terms.nothingChanged'));
      return;
    }
    if (negotiableDirty) {
      const splitError = feeSplitError(terms, termsSeed);
      if (splitError) {
        setTermsError(splitError);
        return;
      }
      if (proposalBlocked) {
        setTermsError(t('membership.terms.proposalBlocked'));
        return;
      }
    }

    if (codDirty) {
      const saved = await actions.updateCodLimit(mid, codValue);
      if (!saved) return;
      setCodSeed(threshold.trim());
    }

    if (employmentDirty) {
      const saved = await actions.updateEmployment(mid, employmentPayload);
      if (!saved) return;
      if (!negotiableDirty) {
        setTermsSeed(terms);
        return;
      }
    }

    if (!negotiableDirty) return;

    const note = termsNote.trim() || undefined;
    const result = staged
      ? termsProposal && canCounterProposal
        ? // Their proposal is open: counter it rather than raising a second one.
          // The old row becomes `superseded` and the new one points back at it.
          await actions.counterTermsProposal(termsProposal.id, negotiablePayload, note)
        : await actions.proposeTerms(mid, negotiablePayload, note)
      : await actions.counterTerms(mid, negotiablePayload, agent.id);

    if (result) {
      setTermsNote('');
      // A staged change has NOT been applied — reseeding from the form would
      // show the proposed figures as if they were the agreed ones. The contract
      // refetch behind us is what will move them, if and when the agent agrees.
      if (!staged) setTermsSeed(terms);
      else setTerms(termsSeed);
    }
  };

  const confirmInline = async () => {
    if (mode === 'suspend') {
      if (!reason.trim()) return;
      const r = await actions.suspend(mid, reason.trim());
      if (r) { resetInline(); onOpenChange(false); }
    } else if (mode === 'pause') {
      const r = await actions.pause(mid, reason.trim() || undefined);
      if (r) { resetInline(); onOpenChange(false); }
    } else if (mode === 'reject') {
      const r = await actions.reject(mid, reason.trim() || undefined);
      if (r) { resetInline(); onOpenChange(false); }
    } else if (mode === 'terminate') {
      const r = await actions.terminate(mid, reason.trim() || undefined);
      if (r) { resetInline(); onOpenChange(false); }
    }
  };

  /** Put every editor back to what the server holds. */
  const discardEdits = () => {
    setTerms(termsSeed);
    setThreshold(codSeed);
    setTermsError(null);
  };

  const pk = actions.pendingKey;
  const avatar = agentAvatarUrl(agent);
  const termsSummary = summarizeTerms(membership);
  // One save, so one busy flag — whichever of the three writes is in flight.
  const saveBusy =
    pk === `cod-limit:${mid}` ||
    pk === `employment:${mid}` ||
    pk === `counter:${mid}` ||
    pk === `propose:${mid}` ||
    (termsProposal != null && pk === `proposal-counter:${termsProposal.id}`);

  // A departure is already on the table — from either side. Offering "Remove"
  // again would 409 (`CONTRACT_STATUS_REQUEST_ALREADY_PENDING`); the panel at the
  // top of the sheet is where that request gets answered or pulled back.
  const departurePending = statusRequest?.transition === 'deactivate';

  const showActions =
    membership.status === 'pending' ||
    membership.status === 'active' ||
    membership.status === 'paused' ||
    membership.status === 'suspended';

  /**
   * Everything this contract's status allows that is NOT its headline action.
   *
   * They share one menu because the footer's button slot belongs to the save:
   * with pause / suspend / remove sitting in it, saving the terms meant hunting
   * for a button inside a collapsible section halfway up the scroller.
   */
  const menuActions: {
    key: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
    destructive?: boolean;
    onSelect: () => void;
  }[] = [];

  if (offer === 'ours-to-answer') {
    // Countering IS the terms editor with their figures answered, so it opens
    // the section rather than being its own form.
    menuActions.push({
      key: 'counter',
      label: t('membership.footer.counter'),
      icon: ClipboardList,
      onSelect: () => setTermsOpen(true),
    });
  }
  if (offer === 'ours-to-answer' || offer === 'needs-terms') {
    menuActions.push({
      key: 'decline',
      label: t('membership.footer.decline'),
      icon: XCircle,
      destructive: true,
      onSelect: () => setMode('reject'),
    });
  }
  if (membership.status === 'active') {
    menuActions.push({
      key: 'pause',
      label: t('membership.footer.pause'),
      icon: PauseCircle,
      onSelect: () => setMode('pause'),
    });
    menuActions.push({
      key: 'suspend',
      label: t('membership.footer.suspend'),
      icon: ShieldAlert,
      onSelect: () => setMode('suspend'),
    });
  }
  // A departure is already on the table, so offering it again would 409.
  if (
    !departurePending &&
    (membership.status === 'active' ||
      membership.status === 'paused' ||
      membership.status === 'suspended')
  ) {
    menuActions.push({
      key: 'remove',
      label: t('membership.footer.remove'),
      icon: UserMinus,
      destructive: true,
      onSelect: () => setMode('terminate'),
    });
  }

  /** What the footer says while nothing is being saved. */
  const footerHint =
    offer === 'ours-to-answer'
      ? t('membership.footer.waitingOnYou', { name: agent.name })
      : offer === 'theirs-to-answer'
        ? t('membership.footer.waitingOnThem', { name: agent.name })
        : offer === 'needs-terms'
          ? t('membership.footer.needsTerms', { name: agent.name })
          : null;

  const saveLabel = negotiableDirty
    ? staged
      ? canCounterProposal
        ? t('membership.terms.sendCounterProposal')
        : t('membership.terms.proposeToAgent')
      : offer === 'ours-to-answer'
        ? t('membership.terms.sendCounterOffer')
        : t('membership.terms.sendTerms')
    : employmentDirty && !codDirty
      ? t('membership.terms.saveEmployment')
      : t('common:actions.saveChanges');

  return (
    <>
      <DialogHeader className="flex-shrink-0 gap-0 border-b px-4 py-4 pr-14 sm:px-6 sm:py-5 sm:pr-14">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-border bg-muted">
            {avatar ? (
              <img src={avatar} alt={agent.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base">{agent.name}</DialogTitle>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <MembershipStatusBadge status={membership.status} className="text-[10px]" />
              {membership.isPrimary && (
                <Badge variant="secondary" className="text-[10px]">{t('membership.primary')}</Badge>
              )}
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {tokenLabel('agents:origin', membership.origin)}
              </Badge>
            </div>
          </div>
        </div>
        <DialogDescription className="sr-only">
          {t('membership.srDescription', { name: agent.name })}
        </DialogDescription>
      </DialogHeader>

      {/* Native scrolling, deliberately not Radix's ScrollArea: that one keeps
          the viewport at `overflow-y: hidden` until a scrollbar mounts, and with
          the default `type="hover"` a scrollbar only mounts on pointer-enter —
          so it can never scroll on a touch screen. `min-h-0` lets this flex
          child shrink below its content; `overscroll-contain` stops a phone
          flick from scrolling the roster behind the sheet. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-4 px-4 py-5 sm:px-6">
          {/* A pending two-party change comes first: it is the one thing here
              that is waiting on somebody, and burying it under the terms would
              make an agent's request to leave look like nothing had arrived. */}
          {statusRequest && (
            <StatusRequestPanel
              request={statusRequest}
              busy={
                pk === `resolve:${statusRequest.id}` || pk === `cancel:${statusRequest.id}`
              }
              note={requestNote}
              noteOpen={requestNoteOpen}
              onNoteChange={setRequestNote}
              onOpenNote={() => { setRequestNoteOpen(true); setRequestNote(''); }}
              onResolve={(decision) =>
                actions
                  .resolveStatusRequest(statusRequest.id, decision, requestNote.trim() || undefined)
                  .then(clearRequestNote)
              }
              onCancel={() =>
                actions
                  .cancelStatusRequest(statusRequest.id, requestNote.trim() || undefined)
                  .then(clearRequestNote)
              }
            />
          )}

          {/* An open change to the agreed terms. Same reasoning as above, and
              the copy has to be explicit that nothing has moved: the contract
              goes on paying the old split until this is accepted. */}
          {termsProposal && (
            <TermsProposalPanel
              proposal={termsProposal}
              busy={
                pk === `proposal-resolve:${termsProposal.id}` ||
                pk === `proposal-cancel:${termsProposal.id}`
              }
              note={proposalNote}
              noteOpen={proposalNoteOpen}
              onNoteChange={setProposalNote}
              onOpenNote={() => { setProposalNoteOpen(true); setProposalNote(''); }}
              onResolve={(decision) =>
                actions
                  .resolveTermsProposal(termsProposal.id, decision, proposalNote.trim() || undefined)
                  .then(clearProposalNote)
              }
              onCancel={() =>
                actions
                  .cancelTermsProposal(termsProposal.id, proposalNote.trim() || undefined)
                  .then(clearProposalNote)
              }
              // Countering is the terms editor with their figures answered, so
              // it opens the section below rather than being its own form.
              onCounter={() => setTermsOpen(true)}
            />
          )}

          {/* How a terminal contract ended. Terminal is terminal — the row
              survives only as history, so the reason is the whole story. */}
          {ending && (
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-sm font-medium">{t(ending.labelKey)}</p>
              {ending.at && <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(ending.at)}</p>}
              {ending.reason ? (
                <p className="mt-2 text-sm">
                  {t('membership.ending.quotedReason', { reason: ending.reason })}
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{t('membership.ending.noReason')}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {t('membership.ending.newContractHint')}
              </p>
            </div>
          )}

          {/* At a glance — contact, vehicle, standing. Email takes the full row
              on a phone; an address does not survive a 160px column. */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
            <InfoTile
              className="col-span-2 sm:col-span-1"
              icon={Mail}
              label={t('membership.tiles.email')}
              value={agent.email ?? t('common:values.notAvailable')}
            />
            <InfoTile
              icon={Phone}
              label={t('membership.tiles.phone')}
              value={agent.phone ?? t('common:values.notAvailable')}
            />
            <InfoTile
              icon={VehicleIcon}
              label={t('membership.tiles.vehicle')}
              value={
                agent.vehicleInfo ? (
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                      {formatVehicleType(agent.vehicleInfo.vehicle_type)}
                      {agent.vehicleInfo.color && (
                        <>
                          {/* A swatch only when the token is one we can actually
                              draw — never a guessed hex. */}
                          {vehicleColorSwatch(agent.vehicleInfo.color) && (
                            <span
                              aria-hidden
                              className="h-3 w-3 flex-shrink-0 rounded-full border"
                              style={{ backgroundColor: vehicleColorSwatch(agent.vehicleInfo.color)! }}
                            />
                          )}
                          <span className="font-normal text-muted-foreground">
                            {formatVehicleColor(agent.vehicleInfo.color)}
                          </span>
                        </>
                      )}
                    </span>
                    {/* The field an agency actually reads off a vehicle in a car
                        park — typed since forever, never rendered until now. */}
                    {agent.vehicleInfo.plate_number && (
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {agent.vehicleInfo.plate_number}
                      </span>
                    )}
                  </span>
                ) : (
                  t('common:values.notAvailable')
                )
              }
            />
            {/* Only the DETAIL endpoint resolves this; the roster list omits the
                key entirely, so its absence is normal rather than an error. */}
            {/* `photo.url` is nullable — a file in an authorized storage tree
                has no public URL. A vehicle photo is a general-intake upload
                and so always public, but there is nothing to render without a
                URL, so the tile is dropped rather than shown broken. */}
            {agent.vehicleInfo?.photo?.url && (
              <div className="col-span-2 rounded-xl border bg-card p-3 sm:col-span-1">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <VehicleIcon className="h-3 w-3" /> {t('membership.tiles.vehiclePhoto')}
                </p>
                <img
                  src={agent.vehicleInfo.photo.url}
                  alt={t('membership.tiles.vehiclePhotoAlt')}
                  className="h-24 w-full rounded-lg border object-cover"
                />
              </div>
            )}
            <InfoTile
              icon={Star}
              label={t('membership.tiles.trustScore')}
              value={
                <span className="flex items-center gap-1">
                  {agent.trustScore}
                  <span className="font-normal text-muted-foreground">
                    {t('membership.tiles.trustOutOf')}
                  </span>
                </span>
              }
            />
            <InfoTile
              icon={Package}
              label={t('membership.tiles.activeJobs')}
              value={agent.activeShipmentCount}
            />
            <InfoTile
              icon={Signal}
              label={t('membership.tiles.availability')}
              value={tokenLabel('agents:availability', String(agent.availability))}
            />
          </div>

          {/* Cash + COD threshold */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Banknote className="h-3 w-3" /> {t('membership.cod.held')}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(cashHeld)}</p>
              </div>
              <div className="text-end">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t('membership.cod.cap')}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {membership.codThreshold > 0 ? (
                    formatNumber(membership.codThreshold)
                  ) : (
                    <span className="text-base font-normal text-muted-foreground">
                      {t('membership.cod.noCap')}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {editable && (
              <div className="mt-4 space-y-1.5">
                <Label htmlFor={`cod-${mid}`} className="text-xs text-muted-foreground">
                  {t('membership.cod.editLabel')}
                </Label>
                {/* Seeded with the stored cap and empty means "no cap", the same
                    bargain the shipment ceiling above strikes — this is an edit
                    of the figure on screen, not a box for a delta. */}
                <Input
                  id={`cod-${mid}`}
                  type="number"
                  min={0}
                  placeholder={t('membership.cod.noCap')}
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {t('membership.cod.hint')}
                </p>
              </div>
            )}
          </div>

          {/* Contract terms — employment, fee split, remittance, value ceiling */}
          <Section
            icon={ClipboardList}
            title={offer === 'settled' ? t('membership.terms.title') : t('membership.terms.titleOnTable')}
            summary={termsSummary || t('membership.terms.summaryFallback')}
            open={termsOpen}
            onOpenChange={setTermsOpen}
          >
            <div className="space-y-5">
              {/* Which mechanism applies is the one thing a reader must not have
                  to guess, so it is stated before the fields rather than
                  discovered when Save behaves unexpectedly. */}
              {editable && (
                <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                  {staged ? (
                    <Trans
                      ns="agents"
                      i18nKey="membership.terms.modeStaged"
                      values={{ name: agent.name }}
                      components={{ strong: <span className="font-medium text-foreground" /> }}
                    />
                  ) : offer === 'ours-to-answer' ? (
                    t('membership.terms.modeOursToAnswer', { name: agent.name })
                  ) : offer === 'needs-terms' ? (
                    t('membership.terms.modeNeedsTerms', { name: agent.name })
                  ) : (
                    t('membership.terms.modeTheirsToAnswer', { name: agent.name })
                  )}
                </div>
              )}

              {coverageRepair && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  <p className="font-medium">{t('terms.coverage.invalidTitle')}</p>
                  <p className="mt-0.5">{t('terms.coverage.invalidBody')}</p>
                </div>
              )}

              <ContractTermsFields
                form={terms}
                seed={termsSeed}
                onChange={setTerm}
                disabled={!editable}
                includeEmployment
                country={country}
                coverageAreas={magazin?.coverageAreas}
                allowedRegions={
                  coverageRepair
                    ? coverageRepair.allowedRegions.map((key) => ({
                        key,
                        label: regionLabel(key, country),
                        cities: [],
                      }))
                    : undefined
                }
              />

              {/* A note only travels with a staged change — the counter endpoint
                  on a pending contract takes terms and nothing else. */}
              {editable && staged && negotiableDirty && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('membership.terms.noteLabel')}
                  </p>
                  <Textarea
                    value={termsNote}
                    onChange={(e) => setTermsNote(e.target.value)}
                    rows={2}
                    maxLength={300}
                    placeholder={t('membership.terms.notePlaceholder')}
                  />
                </div>
              )}

              {/* No buttons here on purpose: this sheet saves from its footer,
                  the way the settings tabs save from their bar. All this line
                  owes the reader is what saving would send. */}
              {editable && (
                <p className="border-t pt-4 text-xs text-muted-foreground">
                  {proposalBlocked && negotiableDirty
                    ? t('membership.terms.proposalBlockedHint')
                    : t('membership.terms.onlyChanged')}
                </p>
              )}
            </div>
          </Section>

          {/* The negotiation trail — every proposal ever raised on this
              contract, not only the open one. Resolved rows carry the terms
              that were actually on the table when they were raised, which is
              why they are worth keeping: `termsBefore` is a snapshot, so an old
              row stays honest after the contract has moved on.

              Hidden only while `pending`: that contract negotiates on its own
              document and produces no proposal rows at all, so the section
              could only ever say "none". A terminal one may well have a trail
              worth reading — it was live once. */}
          {membership.status !== 'pending' && (
            <Section
              icon={ClipboardList}
              title={t('membership.trail.title')}
              summary={t('membership.trail.summary')}
              onOpen={loadTrail}
            >
              {trailLoading ? (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('common:states.loading')}
                </p>
              ) : trail && trail.length > 0 ? (
                <div className="space-y-3">
                  {trail.map((proposal) => (
                    <div key={proposal.id} className="rounded-lg border px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {tokenLabel('agents:termsProposal.states', proposal.state)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {t('membership.trail.byline', {
                            who:
                              proposal.proposedByRole === 'agency'
                                ? t('membership.trail.you')
                                : agent.name,
                            date: formatDate(proposal.createdAt),
                          })}
                        </span>
                      </div>
                      {proposal.diff.length > 0 ? (
                        <ul className="mt-1.5 space-y-0.5">
                          {proposal.diff.map((entry) => (
                            <li key={entry.path} className="text-xs">
                              <span className="text-muted-foreground">
                                {t('membership.trail.diffEntry', { label: termPathLabel(entry.path) })}
                              </span>
                              <span className="line-through opacity-60">
                                {termValueText(entry.path, entry.before, country)}
                              </span>{' '}
                              <span className="inline-block rtl:-scale-x-100">→</span>{' '}
                              <span className="font-medium">
                                {termValueText(entry.path, entry.after, country)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {t('membership.trail.noChange')}
                        </p>
                      )}
                      {proposal.resolutionNote && (
                        <p className="mt-1.5 text-xs">
                          {t('membership.trail.quotedNote', { note: proposal.resolutionNote })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('membership.trail.empty')}</p>
              )}
            </Section>
          )}

          {/* Settlements — this contract's cash history */}
          <Section
            icon={Banknote}
            title={t('membership.settlements.title')}
            summary={t('membership.settlements.summary')}
            onOpen={loadSettlements}
          >
            {settlementsLoading ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('common:states.loading')}
              </p>
            ) : settlements ? (
              <div className="space-y-3">
                <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
                  <div className="bg-card px-3 py-2.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t('membership.settlements.outstanding')}
                    </p>
                    <p className={`mt-1 text-lg font-semibold tabular-nums ${settlements.cod.outstandingBalance > 0 ? 'text-amber-600' : ''}`}>
                      {formatNumber(settlements.cod.outstandingBalance)}
                    </p>
                  </div>
                  <div className="bg-card px-3 py-2.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t('membership.settlements.lifetimeSettled')}
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">{formatNumber(settlements.cod.lifetimeSettled)}</p>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {t('membership.settlements.hint', {
                    date: formatDate(settlements.cod.lastSettledAt),
                  })}
                </p>
                {settlements.deposits.length > 0 ? (
                  <div className="divide-y rounded-lg border">
                    {settlements.deposits.map((deposit) => (
                      <div key={deposit.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                        <span className="min-w-0 truncate text-muted-foreground">
                          {t('membership.settlements.depositLine', {
                            date: formatDate(deposit.declaredAt),
                            recipient: tokenLabel('cash:recipient', deposit.recipient),
                          })}
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-2 tabular-nums">
                          {formatNumber(deposit.amount)}
                          <Badge variant="outline">
                            {tokenLabel('cash:depositStatus', deposit.status)}
                          </Badge>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t('membership.settlements.noDeposits')}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('membership.settlements.loadFailed')}</p>
            )}
          </Section>

          {/* Eligibility */}
          <Section
            icon={ShieldCheck}
            title={t('membership.eligibility.title')}
            summary={t('membership.eligibility.summary')}
            onOpen={loadEligibility}
          >
            {eligLoading ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('membership.eligibility.checking')}
              </p>
            ) : eligibility ? (
              <div className="space-y-2">
                <p className="flex flex-wrap items-center gap-1.5 text-sm">
                  {eligibility.eligible ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />{' '}
                      {t('membership.eligibility.eligible')}
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-destructive" />{' '}
                      {t('membership.eligibility.notEligible')}
                    </>
                  )}
                  <span className="text-muted-foreground">
                    {t('membership.eligibility.capacity', {
                      active: eligibility.activeShipmentCount,
                      max: eligibility.maxConcurrentShipments,
                    })}
                  </span>
                </p>
                <div className="space-y-1">
                  {eligibility.rules.map((rule) => (
                    <div key={rule.rule} className="flex items-center gap-1.5 text-xs">
                      {rule.passed ? (
                        <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 flex-shrink-0 text-destructive" />
                      )}
                      <span className={rule.passed ? 'text-muted-foreground' : 'text-destructive'}>
                        {rule.reason
                          ? t('membership.eligibility.ruleWithReason', {
                              rule: tokenLabel('agents:membership.eligibility.rules', rule.rule),
                              reason: tokenLabel('agents:membership.eligibility.reasons', rule.reason),
                            })
                          : tokenLabel('agents:membership.eligibility.rules', rule.rule)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('membership.eligibility.loadFailed')}</p>
            )}
          </Section>

          {/* History */}
          <Section
            icon={History}
            title={t('membership.history.title')}
            summary={t('membership.history.summary')}
            onOpen={loadHistory}
          >
            {historyLoading ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('common:states.loading')}
              </p>
            ) : history && history.length > 0 ? (
              <div className="space-y-2.5">
                {history.map((event, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <span className="font-medium">{tokenLabel('agents:historyEvents', event.type)}</span>
                      <span className="ms-1 text-muted-foreground">{formatDate(event.createdAt ?? event.at)}</span>
                      {event.note && <p className="break-words text-muted-foreground">{String(event.note)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('membership.history.empty')}</p>
            )}
          </Section>
        </div>
      </div>

      {/* Action footer. The reason box lives here too, so confirming never
          depends on finding a panel buried at the bottom of the scroller. */}
      {(mode || showActions) && (
        <div className="flex-shrink-0 border-t bg-muted/20 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4 sm:pb-4">
          {mode ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t(`membership.reason.${mode}` as 'membership.reason.suspend')}
              </p>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder={t('membership.reason.placeholder')}
              />
              {mode === 'pause' && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {t('membership.reason.pauseHint')}
                </p>
              )}
              {mode === 'terminate' && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {t('membership.reason.terminateHint')}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={resetInline}>
                  {t('common:actions.cancel')}
                </Button>
                <Button
                  size="sm"
                  variant={mode === 'suspend' || mode === 'terminate' ? 'destructive' : 'default'}
                  className="flex-1"
                  disabled={(mode === 'suspend' && !reason.trim()) || pk === `${mode}:${mid}`}
                  onClick={confirmInline}
                >
                  {pk === `${mode}:${mid}` ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common:actions.confirm')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* One line of context, then one row of controls. While the sheet
                  has unsaved edits that line becomes the unsaved-changes notice
                  and the row becomes Discard / Save — the same bargain the
                  settings tabs strike with their floating bar. */}
              {dirty || saveBusy ? (
                <p
                  className={cn(
                    'flex items-center gap-2 text-xs',
                    termsError ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span
                      className={cn(
                        'absolute inline-flex h-full w-full rounded-full opacity-60',
                        termsError ? 'bg-destructive' : 'animate-ping bg-amber-500',
                      )}
                    />
                    <span
                      className={cn(
                        'relative inline-flex h-2 w-2 rounded-full',
                        termsError ? 'bg-destructive' : 'bg-amber-500',
                      )}
                    />
                  </span>
                  <span className="min-w-0">{termsError ?? t('membership.terms.unsaved')}</span>
                </p>
              ) : (
                footerHint && <p className="text-xs text-muted-foreground">{footerHint}</p>
              )}

              <div className="flex items-center gap-2">
                {menuActions.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="flex-shrink-0 gap-1.5">
                        <MoreHorizontal className="h-4 w-4" />
                        {t('membership.footer.manage')}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="w-52">
                      {menuActions.map((action) => (
                        <DropdownMenuItem
                          key={action.key}
                          variant={action.destructive ? 'destructive' : 'default'}
                          onSelect={action.onSelect}
                        >
                          <action.icon className="h-4 w-4" />
                          {action.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <div className="flex flex-1 items-center justify-end gap-2">
                  {dirty || saveBusy ? (
                    <>
                      <Button size="sm" variant="ghost" disabled={saveBusy} onClick={discardEdits}>
                        {t('common:actions.discard')}
                      </Button>
                      <Button
                        size="sm"
                        className="min-w-0 gap-1.5"
                        disabled={!dirty || saveBusy || (proposalBlocked && negotiableDirty)}
                        onClick={saveAll}
                      >
                        {saveBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        {/* "Send counter-proposal" beside Manage and Discard is
                            wider than a 360px footer. */}
                        <span className="truncate">{saveLabel}</span>
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* The party whose terms are standing may only withdraw
                          them; the other may accept, decline or counter. That is
                          `awaitingDecisionFrom`, not who opened the contract — an
                          agency that raised a request becomes the answering party
                          the moment the agent counters, and calling the wrong
                          verb is a 403. */}
                      {offer === 'ours-to-answer' && (
                        <Button
                          size="sm"
                          disabled={pk === `approve:${mid}`}
                          onClick={() => actions.approve(mid, agent.id).then((r) => r && onOpenChange(false))}
                        >
                          {pk === `approve:${mid}` ? <Loader2 className="h-4 w-4 animate-spin" /> : t('membership.footer.acceptTerms')}
                        </Button>
                      )}
                      {offer === 'theirs-to-answer' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pk === `withdraw:${mid}`}
                          onClick={() => actions.withdraw(agent.id, mid).then((r) => r && onOpenChange(false))}
                        >
                          {pk === `withdraw:${mid}` ? <Loader2 className="h-4 w-4 animate-spin" /> : t('membership.footer.withdrawOffer')}
                        </Button>
                      )}
                      {/* Nobody has stated terms, so there is nothing to approve —
                          approving here is 422 CONTRACT_TERMS_NOT_PROPOSED. Not a
                          fault with the agent: the first offer is ours to make. */}
                      {offer === 'needs-terms' && (
                        <Button size="sm" onClick={() => setTermsOpen(true)}>
                          {t('membership.footer.proposeTerms')}
                        </Button>
                      )}
                      {(membership.status === 'paused' || membership.status === 'suspended') && (
                        <Button
                          size="sm"
                          disabled={pk === `reinstate:${mid}`}
                          onClick={() => actions.reinstate(mid).then((r) => r && onOpenChange(false))}
                        >
                          {pk === `reinstate:${mid}` ? <Loader2 className="h-4 w-4 animate-spin" /> : t('membership.footer.reinstate')}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
