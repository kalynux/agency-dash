import { formatNumber, formatDate as fmtDate } from '@/lib/format';
import { useState, type ComponentType, type ReactNode } from 'react';
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  History,
  Loader2,
  Mail,
  MapPin,
  Package,
  PauseCircle,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Signal,
  Star,
  User,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MembershipStatusBadge } from '@/components/agents/MembershipStatusBadge';
import { StatusRequestPanel } from '@/components/agents/StatusRequestPanel';
import { getVehicleIcon, formatVehicleType } from '@/components/agents/vehicle.constants';
import { useAgentActions } from '@/hooks/useAgentActions';
import { useAgentsRoster } from '@/store/agents.store';
import { agentsService } from '@/services/agents.service';
import {
  agentAvatarUrl,
  readContractTerms,
  HISTORY_MEMBERSHIP_STATUSES,
} from '@/types/agent.types';
import type {
  RosterEntry,
  AgentMembership,
  EmploymentType,
  FeeSplitModel,
  RemittanceCadence,
  AgentEligibility,
  AgentHistoryEvent,
  ContractSettlements,
  UpdateEmploymentPayload,
  UpdateTermsPayload,
} from '@/types/agent.types';

const EMPLOYMENT_TYPES: EmploymentType[] = ['employee', 'contractor', 'freelancer'];

const REMITTANCE_CADENCES: { value: RemittanceCadence; label: string }[] = [
  { value: 'per_delivery', label: 'Per delivery' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every two weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'on_demand', label: 'On demand' },
];

const CADENCE_LABEL: Record<string, string> = Object.fromEntries(
  REMITTANCE_CADENCES.map((c) => [c.value, c.label]),
);

// ─── Contract terms form ──────────────────────────────────────────────────────
// One editor for everything negotiated on the contract, saved through
// `PATCH .../terms` (the `/employment` endpoint is a thin alias for one group of
// it). Every field is a string so an untouched input stays untouched: the payload
// is diffed against the seeded values and only changed groups are sent, matching
// the endpoint's field-by-field merge.

interface TermsForm {
  empType: EmploymentType | '';
  empRef: string;
  empStart: string;
  empEnd: string;
  feeModel: FeeSplitModel | '';
  sharePercent: string;
  flatFee: string;
  currency: string;
  cadence: RemittanceCadence | '';
  dayOfWeek: string;
  dayOfMonth: string;
  graceHours: string;
  /** `coverage.regions`, comma-separated. The polygon `area` is not editable here. */
  regions: string;
  ceiling: string;
}

function num(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

/** Split a comma-separated region list into trimmed, non-empty names. */
function parseRegions(value: string): string[] {
  return value.split(',').map((r) => r.trim()).filter(Boolean);
}

function seedTermsForm(membership: AgentMembership): TermsForm {
  const { feeSplit, remittanceTerms, coverage, shipmentValueCeiling } = readContractTerms(membership);
  return {
    empType: membership.employment.employmentType ?? '',
    empRef: membership.employment.employeeRef ?? '',
    empStart: membership.employment.startedAt?.slice(0, 10) ?? '',
    empEnd: membership.employment.endsAt?.slice(0, 10) ?? '',
    feeModel: feeSplit.model,
    sharePercent: num(feeSplit.agentSharePercent),
    flatFee: num(feeSplit.agentFlatFee),
    currency: feeSplit.currency,
    cadence: remittanceTerms.cadence,
    dayOfWeek: num(remittanceTerms.dayOfWeek),
    dayOfMonth: num(remittanceTerms.dayOfMonth),
    graceHours: num(remittanceTerms.graceHours),
    regions: coverage.regions.join(', '),
    ceiling: num(shipmentValueCeiling),
  };
}

/** Only what the agency actually changed, grouped as the endpoint expects. */
function buildTermsPayload(form: TermsForm, seed: TermsForm): UpdateTermsPayload {
  const payload: UpdateTermsPayload = {};

  const employment: UpdateEmploymentPayload = {};
  if (form.empType && form.empType !== seed.empType) employment.employment_type = form.empType;
  // `employee_ref` is clearable: an emptied input is an explicit null.
  if (form.empRef.trim() !== seed.empRef) employment.employee_ref = form.empRef.trim() || null;
  if (form.empStart !== seed.empStart) employment.started_at = form.empStart || null;
  if (form.empEnd !== seed.empEnd) employment.ends_at = form.empEnd || null;
  if (Object.keys(employment).length > 0) payload.employment = employment;

  const feeSplit: NonNullable<UpdateTermsPayload['fee_split']> = {};
  if (form.feeModel && form.feeModel !== seed.feeModel) feeSplit.model = form.feeModel;
  if (form.sharePercent !== seed.sharePercent && form.sharePercent !== '') {
    feeSplit.agent_share_percent = Number(form.sharePercent);
  }
  if (form.flatFee !== seed.flatFee && form.flatFee !== '') {
    feeSplit.agent_flat_fee = Number(form.flatFee);
  }
  const currency = form.currency.trim().toUpperCase();
  if (currency && currency !== seed.currency.toUpperCase()) feeSplit.currency = currency;
  if (Object.keys(feeSplit).length > 0) payload.fee_split = feeSplit;

  const remittance: NonNullable<UpdateTermsPayload['remittance_terms']> = {};
  if (form.cadence && form.cadence !== seed.cadence) remittance.cadence = form.cadence;
  if (form.dayOfWeek !== seed.dayOfWeek && form.dayOfWeek !== '') {
    remittance.day_of_week = Number(form.dayOfWeek);
  }
  if (form.dayOfMonth !== seed.dayOfMonth && form.dayOfMonth !== '') {
    remittance.day_of_month = Number(form.dayOfMonth);
  }
  if (form.graceHours !== seed.graceHours && form.graceHours !== '') {
    remittance.grace_hours = Number(form.graceHours);
  }
  if (Object.keys(remittance).length > 0) payload.remittance_terms = remittance;

  // `area` is deliberately left alone — a polygon is not something this text
  // editor can express, and omitting the key keeps whatever is stored.
  if (form.regions !== seed.regions) {
    payload.coverage = { regions: parseRegions(form.regions) };
  }

  // Nullable on purpose — an emptied ceiling means "no per-shipment cap".
  if (form.ceiling !== seed.ceiling) {
    payload.shipment_value_ceiling = form.ceiling.trim() === '' ? null : Number(form.ceiling);
  }

  return payload;
}

/**
 * The one rule the server enforces up front: the split that RESULTS from the
 * patch must carry a value for its model. Checked here too so a mistyped split is
 * caught before it can mispay anyone.
 */
function feeSplitError(form: TermsForm, seed: TermsForm): string | null {
  const model = form.feeModel || seed.feeModel;
  if (model === 'percentage' && !(form.sharePercent || seed.sharePercent)) {
    return 'A percentage split needs an agent share.';
  }
  if (model === 'flat' && !(form.flatFee || seed.flatFee)) {
    return 'A flat split needs a flat fee.';
  }
  if (form.sharePercent !== '' && (Number(form.sharePercent) < 0 || Number(form.sharePercent) > 100)) {
    return 'The agent share must be between 0 and 100.';
  }
  return null;
}

function formatDate(iso: string | null | undefined) {
  return fmtDate(iso);
}

/**
 * How a terminal contract ended, or null while it is still live.
 *
 * Each terminal status has its own stamp and reason field — `rejected` and
 * `withdrawn` are the two halves of a refused handshake, `deactivated` an agreed
 * departure — and the field names for the last one predate the status rename.
 */
function contractEnding(
  membership: AgentMembership,
): { label: string; at: string | null; reason: string | null } | null {
  switch (membership.status) {
    case 'rejected':
      return {
        label: 'The agent turned down your request',
        at: membership.rejectedAt,
        reason: membership.rejectionReason,
      };
    case 'withdrawn':
      return {
        label: 'The request was withdrawn before it was answered',
        at: membership.withdrawnAt,
        reason: membership.withdrawalReason,
      };
    case 'deactivated':
      return {
        label: membership.transferredToAgencyId
          ? 'Ended — an admin transferred this agent to another agency'
          : 'Contract ended',
        at: membership.removedAt,
        reason: membership.removalReason,
      };
    default:
      return null;
  }
}

// ─── Layout primitives ────────────────────────────────────────────────────────

/** One labelled cell of the at-a-glance grid. Hairlines come from the parent's `gap-px`. */
function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="bg-card px-3 py-2.5">
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
  onOpen,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  onOpen?: () => void;
  children: ReactNode;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      onOpenChange={(open) => { if (open) onOpen?.(); }}
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

function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
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
  return (
    <Dialog open={open && !!entry} onOpenChange={onOpenChange}>
      {/* `flex`/`p-0` override the base grid+padding; `overflow-hidden` keeps the
          rounded corners clipping the scroller. */}
      <DialogContent className="flex max-h-[min(92vh,48rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {entry && (
          // Keyed on the contract so switching rows resets every editor and drops
          // the lazily-loaded panels — otherwise the previous agent's eligibility,
          // history and settlements would be shown for the next one.
          <MembershipBody
            key={entry.membership.id}
            entry={entry}
            onOpenChange={onOpenChange}
            onChanged={onChanged}
          />
        )}
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
  const actions = useAgentActions({ onRosterChanged: onChanged });
  const { statusRequests } = useAgentsRoster();
  const { membership, agent, cashHeld } = entry;
  const mid = membership.id;

  // The pending two-party change on this contract, either direction — a break or
  // a departure the agent proposed, or a removal we did. It is read here as well
  // as on the row because this sheet is where "manage this agent" leads, and a
  // decision waiting on you must not be reachable only from the list behind it.
  const statusRequest = statusRequests.find((r) => r.contractId === mid) ?? null;

  // Inline "confirm with reason" modes
  const [mode, setMode] = useState<'suspend' | 'pause' | 'terminate' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [requestNoteOpen, setRequestNoteOpen] = useState(false);
  const [requestNote, setRequestNote] = useState('');

  // COD threshold + contract terms editors
  const [threshold, setThreshold] = useState('');
  const [termsSeed, setTermsSeed] = useState<TermsForm>(() => seedTermsForm(membership));
  const [terms, setTerms] = useState<TermsForm>(termsSeed);
  const [termsError, setTermsError] = useState<string | null>(null);

  // Lazy eligibility / history / settlements
  const [eligibility, setEligibility] = useState<AgentEligibility | null>(null);
  const [eligLoading, setEligLoading] = useState(false);
  const [history, setHistory] = useState<AgentHistoryEvent[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [settlements, setSettlements] = useState<ContractSettlements | null>(null);
  const [settlementsLoading, setSettlementsLoading] = useState(false);

  const VehicleIcon = getVehicleIcon(agent.vehicleInfo?.vehicle_type);
  const ending = contractEnding(membership);
  /** Terminal contracts are history — nothing on them can still be negotiated. */
  const editable = !HISTORY_MEMBERSHIP_STATUSES.includes(membership.status);

  const termsPayload = buildTermsPayload(terms, termsSeed);
  const dirty = Object.keys(termsPayload).length > 0;

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

  const saveThreshold = async () => {
    const value = Number(threshold);
    if (Number.isNaN(value)) return;
    const result = await actions.updateCodLimit(mid, value);
    if (result) setThreshold('');
  };

  const saveTerms = async () => {
    if (!dirty) {
      setTermsError('Nothing changed yet.');
      return;
    }
    const splitError = feeSplitError(terms, termsSeed);
    if (splitError) {
      setTermsError(splitError);
      return;
    }
    const result = await actions.updateTerms(mid, termsPayload);
    if (result) setTermsSeed(terms);
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

  const pk = actions.pendingKey;
  const avatar = agentAvatarUrl(agent);
  const cadence = terms.cadence || termsSeed.cadence;
  const feeModel = terms.feeModel || termsSeed.feeModel;

  const termsSummary = [
    membership.employment.employmentType,
    membership.feeSplit.model === 'flat'
      ? `${formatNumber(membership.feeSplit.agentFlatFee ?? 0)} flat`
      : `${membership.feeSplit.agentSharePercent ?? 0}% share`,
    CADENCE_LABEL[membership.remittanceTerms.cadence],
  ]
    .filter(Boolean)
    .join(' · ');

  // A departure is already on the table — from either side. Offering "Remove"
  // again would 409 (`CONTRACT_STATUS_REQUEST_ALREADY_PENDING`); the panel at the
  // top of the sheet is where that request gets answered or pulled back.
  const departurePending = statusRequest?.transition === 'deactivate';

  const showActions =
    membership.status === 'pending' ||
    membership.status === 'active' ||
    membership.status === 'paused' ||
    membership.status === 'suspended';

  return (
    <>
      <DialogHeader className="flex-shrink-0 gap-0 border-b px-6 py-5 pr-14">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-border bg-muted">
            {avatar ? (
              <img src={avatar} crossOrigin="use-credentials" alt={agent.name} className="h-full w-full object-cover" />
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
              {membership.isPrimary && <Badge variant="secondary" className="text-[10px]">Primary</Badge>}
              <Badge variant="outline" className="text-[10px] capitalize text-muted-foreground">
                {membership.origin.replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>
        </div>
        <DialogDescription className="sr-only">
          Contract details for {agent.name} — COD limit, negotiated terms, settlements and history.
        </DialogDescription>
      </DialogHeader>

      {/* `min-h-0` is what makes this scroll: a flex child defaults to
          `min-height: auto`, so without it the viewport grows past the dialog
          instead of overflowing inside it. */}
      <ScrollArea className="min-h-0 flex-1 [&>[data-radix-scroll-area-viewport]>div]:!block">
        <div className="space-y-4 px-6 py-5">
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

          {/* How a terminal contract ended. Terminal is terminal — the row
              survives only as history, so the reason is the whole story. */}
          {ending && (
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-sm font-medium">{ending.label}</p>
              {ending.at && <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(ending.at)}</p>}
              {ending.reason ? (
                <p className="mt-2 text-sm">“{ending.reason}”</p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No reason was given.</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Contracting with this agent again starts a new contract; this one stays as history.
              </p>
            </div>
          )}

          {/* At a glance — contact, vehicle, standing */}
          <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
            <InfoTile icon={Mail} label="Email" value={agent.email ?? '—'} />
            <InfoTile icon={Phone} label="Phone" value={agent.phone ?? '—'} />
            <InfoTile
              icon={VehicleIcon}
              label="Vehicle"
              value={agent.vehicleInfo ? formatVehicleType(agent.vehicleInfo.vehicle_type) : '—'}
            />
            <InfoTile
              icon={Star}
              label="Trust score"
              value={<span className="flex items-center gap-1">{agent.trustScore}<span className="font-normal text-muted-foreground">/ 100</span></span>}
            />
            <InfoTile icon={Package} label="Active jobs" value={agent.activeShipmentCount} />
            <InfoTile icon={Signal} label="Availability" value={<span className="capitalize">{String(agent.availability).replace(/_/g, ' ')}</span>} />
          </div>

          {/* Cash + COD threshold */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Banknote className="h-3 w-3" /> COD cash held
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(cashHeld)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current cap</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {membership.codThreshold > 0 ? formatNumber(membership.codThreshold) : <span className="text-base font-normal text-muted-foreground">No cap</span>}
                </p>
              </div>
            </div>

            {editable && (
              <>
                <div className="mt-4 flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="New COD threshold (0 = none)"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="flex-1"
                  />
                  <Button size="sm" disabled={threshold === '' || pk === `cod-limit:${mid}`} onClick={saveThreshold}>
                    {pk === `cod-limit:${mid}` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set'}
                  </Button>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  A slice of the agent's global COD pool — a raise can be refused if other agencies use the pool.
                </p>
              </>
            )}
          </div>

          {/* Contract terms — employment, fee split, remittance, value ceiling */}
          <Section
            icon={ClipboardList}
            title="Contract terms"
            summary={termsSummary || 'Employment, fee split, remittance and limits'}
            defaultOpen={editable}
          >
            <div className="space-y-5">
              <FieldGroup title="Employment">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Type">
                    <Select
                      value={terms.empType}
                      disabled={!editable}
                      onValueChange={(v) => setTerm('empType', v as EmploymentType)}
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Employee ref">
                    <Input
                      value={terms.empRef}
                      disabled={!editable}
                      onChange={(e) => setTerm('empRef', e.target.value)}
                      placeholder="EMP-042"
                    />
                  </FormField>
                  <FormField label="Started">
                    <Input type="date" value={terms.empStart} disabled={!editable} onChange={(e) => setTerm('empStart', e.target.value)} />
                  </FormField>
                  <FormField label="Ends">
                    <Input type="date" value={terms.empEnd} disabled={!editable} onChange={(e) => setTerm('empEnd', e.target.value)} />
                  </FormField>
                </div>
              </FieldGroup>

              {/* Fee split — what this agent is paid per delivery */}
              <FieldGroup title="Fee split">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Model">
                    <Select
                      value={terms.feeModel}
                      disabled={!editable}
                      onValueChange={(v) => setTerm('feeModel', v as FeeSplitModel)}
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="flat">Flat fee</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  {feeModel === 'flat' ? (
                    <FormField label="Flat fee per delivery">
                      <Input
                        type="number"
                        min={0}
                        value={terms.flatFee}
                        disabled={!editable}
                        onChange={(e) => setTerm('flatFee', e.target.value)}
                        placeholder="1500"
                      />
                    </FormField>
                  ) : (
                    <FormField label="Agent share (%)">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={terms.sharePercent}
                        disabled={!editable}
                        onChange={(e) => setTerm('sharePercent', e.target.value)}
                        placeholder="40"
                      />
                    </FormField>
                  )}
                  <FormField label="Currency">
                    <Input
                      value={terms.currency}
                      maxLength={3}
                      disabled={!editable}
                      onChange={(e) => setTerm('currency', e.target.value.toUpperCase())}
                      placeholder="XAF"
                    />
                  </FormField>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  The agent's cut comes <span className="font-medium">out of</span> your delivery fee, never on
                  top — the vendor pays the same either way. The platform pays it from the agent's own
                  earnings account.
                </p>
              </FieldGroup>

              {/* Remittance cadence */}
              <FieldGroup title="COD remittance">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Cadence">
                    <Select
                      value={terms.cadence}
                      disabled={!editable}
                      onValueChange={(v) => setTerm('cadence', v as RemittanceCadence)}
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {REMITTANCE_CADENCES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Grace hours">
                    <Input
                      type="number"
                      min={0}
                      max={720}
                      value={terms.graceHours}
                      disabled={!editable}
                      onChange={(e) => setTerm('graceHours', e.target.value)}
                      placeholder="24"
                    />
                  </FormField>
                  {['weekly', 'biweekly'].includes(cadence) && (
                    <FormField label="Day of week" hint="0 = Sunday">
                      <Input
                        type="number"
                        min={0}
                        max={6}
                        value={terms.dayOfWeek}
                        disabled={!editable}
                        onChange={(e) => setTerm('dayOfWeek', e.target.value)}
                      />
                    </FormField>
                  )}
                  {cadence === 'monthly' && (
                    <FormField label="Day of month" hint="1–28">
                      <Input
                        type="number"
                        min={1}
                        max={28}
                        value={terms.dayOfMonth}
                        disabled={!editable}
                        onChange={(e) => setTerm('dayOfMonth', e.target.value)}
                      />
                    </FormField>
                  )}
                </div>
              </FieldGroup>

              <FieldGroup title="Coverage & limits">
                <FormField
                  label="Coverage regions"
                  hint="Comma-separated. Where this agent works for you — it cannot exceed the area they agreed to cover. Leave empty for no restriction."
                >
                  <Input
                    value={terms.regions}
                    disabled={!editable}
                    onChange={(e) => setTerm('regions', e.target.value)}
                    placeholder="Douala, Bonabéri"
                  />
                </FormField>
                <FormField
                  label="Shipment value ceiling"
                  hint="The most this agent may carry on one shipment. Leave empty for no cap."
                >
                  <Input
                    type="number"
                    min={0}
                    value={terms.ceiling}
                    disabled={!editable}
                    onChange={(e) => setTerm('ceiling', e.target.value)}
                    placeholder="No cap"
                  />
                </FormField>
              </FieldGroup>

              {editable && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <p className={termsError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                    {termsError ?? (dirty ? 'Unsaved changes' : 'Only changed fields are sent.')}
                  </p>
                  <div className="flex gap-2">
                    {dirty && (
                      <Button size="sm" variant="ghost" onClick={() => { setTerms(termsSeed); setTermsError(null); }}>
                        Discard
                      </Button>
                    )}
                    <Button size="sm" disabled={!dirty || pk === `terms:${mid}`} onClick={saveTerms}>
                      {pk === `terms:${mid}` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save terms'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Settlements — this contract's cash history */}
          <Section icon={Banknote} title="Settlements" summary="Outstanding cash and deposits on this contract" onOpen={loadSettlements}>
            {settlementsLoading ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </p>
            ) : settlements ? (
              <div className="space-y-3">
                <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
                  <div className="bg-card px-3 py-2.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Outstanding</p>
                    <p className={`mt-1 text-lg font-semibold tabular-nums ${settlements.cod.outstandingBalance > 0 ? 'text-amber-600' : ''}`}>
                      {formatNumber(settlements.cod.outstandingBalance)}
                    </p>
                  </div>
                  <div className="bg-card px-3 py-2.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Settled lifetime</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">{formatNumber(settlements.cod.lifetimeSettled)}</p>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Outstanding cash must reach zero before this contract can end. Last settled{' '}
                  {formatDate(settlements.cod.lastSettledAt)}.
                </p>
                {settlements.deposits.length > 0 ? (
                  <div className="divide-y rounded-lg border">
                    {settlements.deposits.map((deposit) => (
                      <div key={deposit.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                        <span className="min-w-0 truncate text-muted-foreground">
                          {formatDate(deposit.declaredAt)} · to {deposit.recipient}
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-2 tabular-nums">
                          {formatNumber(deposit.amount)}
                          <Badge variant="outline" className="capitalize">{deposit.status}</Badge>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No deposits recorded under this contract.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Could not load settlements.</p>
            )}
          </Section>

          {/* Eligibility */}
          <Section icon={ShieldCheck} title="Assignment eligibility" summary="Whether this agent can take a shipment right now" onOpen={loadEligibility}>
            {eligLoading ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
              </p>
            ) : eligibility ? (
              <div className="space-y-2">
                <p className="flex flex-wrap items-center gap-1.5 text-sm">
                  {eligibility.eligible ? (
                    <><CheckCircle2 className="h-4 w-4 text-green-500" /> Eligible now</>
                  ) : (
                    <><XCircle className="h-4 w-4 text-destructive" /> Not eligible</>
                  )}
                  <span className="text-muted-foreground">
                    ({eligibility.activeShipmentCount}/{eligibility.maxConcurrentShipments} capacity)
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
                        {rule.rule.replace(/_/g, ' ')}{rule.reason ? ` — ${rule.reason.replace(/_/g, ' ')}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Could not load eligibility.</p>
            )}
          </Section>

          {/* History */}
          <Section icon={History} title="History" summary="Everything that has happened with this agent" onOpen={loadHistory}>
            {historyLoading ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </p>
            ) : history && history.length > 0 ? (
              <div className="space-y-2.5">
                {history.map((event, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <span className="font-medium capitalize">{event.type.replace(/_/g, ' ')}</span>
                      <span className="ml-1 text-muted-foreground">{formatDate(event.createdAt ?? event.at)}</span>
                      {event.note && <p className="break-words text-muted-foreground">{String(event.note)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No history.</p>
            )}
          </Section>
        </div>
      </ScrollArea>

      {/* Action footer. The reason box lives here too, so confirming never
          depends on finding a panel buried at the bottom of the scroller. */}
      {(mode || showActions) && (
        <div className="flex-shrink-0 border-t bg-muted/20 px-6 py-4">
          {mode ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {mode === 'suspend' && 'Reason for suspension'}
                {mode === 'pause' && 'Reason for pausing (optional)'}
                {mode === 'reject' && 'Reason for declining (optional)'}
                {mode === 'terminate' && 'Reason for removal (optional)'}
              </p>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Add a reason…" />
              {mode === 'pause' && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  A mutual break: no new assignments, shipments already in flight are untouched.
                  Reinstate whenever you both want to restart.
                </p>
              )}
              {mode === 'terminate' && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  This proposes termination — the contract ends once the agent agrees and any outstanding cash
                  and unpaid earnings are settled.
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={resetInline}>Cancel</Button>
                <Button
                  size="sm"
                  variant={mode === 'suspend' || mode === 'terminate' ? 'destructive' : 'default'}
                  className="flex-1"
                  disabled={(mode === 'suspend' && !reason.trim()) || pk === `${mode}:${mid}`}
                  onClick={confirmInline}
                >
                  {pk === `${mode}:${mid}` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* Whoever raised the contract cannot answer it — the server picks the
                  valid pair from `initiatedBy`, and the wrong one is a 403. */}
              {membership.status === 'pending' && membership.initiatedBy === 'agent' && (
                <>
                  <Button size="sm" className="flex-1" disabled={pk === `approve:${mid}`} onClick={() => actions.approve(mid, agent.id).then((r) => r && onOpenChange(false))}>
                    {pk === `approve:${mid}` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setMode('reject')}>Decline</Button>
                </>
              )}
              {membership.status === 'pending' && membership.initiatedBy === 'agency' && (
                <>
                  <p className="w-full text-xs text-muted-foreground">
                    Waiting on the agent to accept your request.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={pk === `withdraw:${mid}`}
                    onClick={() => actions.withdraw(agent.id, mid).then((r) => r && onOpenChange(false))}
                  >
                    {pk === `withdraw:${mid}` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Withdraw request'}
                  </Button>
                </>
              )}
              {membership.status === 'active' && (
                <>
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setMode('pause')}>
                    <PauseCircle className="h-4 w-4" /> Pause
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setMode('suspend')}>
                    <ShieldAlert className="h-4 w-4" /> Suspend
                  </Button>
                  {!departurePending && (
                    <Button size="sm" variant="outline" className="flex-1 text-destructive" onClick={() => setMode('terminate')}>Remove</Button>
                  )}
                </>
              )}
              {(membership.status === 'paused' || membership.status === 'suspended') && (
                <>
                  <Button size="sm" className="flex-1" disabled={pk === `reinstate:${mid}`} onClick={() => actions.reinstate(mid).then((r) => r && onOpenChange(false))}>
                    {pk === `reinstate:${mid}` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reinstate'}
                  </Button>
                  {!departurePending && (
                    <Button size="sm" variant="outline" className="flex-1 text-destructive" onClick={() => setMode('terminate')}>Remove</Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
