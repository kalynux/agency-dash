import { formatNumber, formatDate as fmtDate } from '@/lib/format';
import { useEffect, useState } from 'react';
import {
  Loader2,
  Phone,
  Mail,
  Star,
  Package,
  PauseCircle,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  MapPin,
  User,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MembershipStatusBadge } from '@/components/agents/MembershipStatusBadge';
import { getVehicleIcon, formatVehicleType } from '@/components/agents/vehicle.constants';
import { useAgentActions } from '@/hooks/useAgentActions';
import { agentsService } from '@/services/agents.service';
import { agentAvatarUrl, readContractTerms } from '@/types/agent.types';
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

const EMPTY_TERMS: TermsForm = {
  empType: '', empRef: '', empStart: '', empEnd: '',
  feeModel: '', sharePercent: '', flatFee: '', currency: '',
  cadence: '', dayOfWeek: '', dayOfMonth: '', graceHours: '',
  regions: '', ceiling: '',
};

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

export interface AgentMembershipDialogProps {
  entry: RosterEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function AgentMembershipDialog({ entry, open, onOpenChange, onChanged }: AgentMembershipDialogProps) {
  const actions = useAgentActions({ onRosterChanged: onChanged });

  // Inline "confirm with reason" modes
  const [mode, setMode] = useState<'suspend' | 'pause' | 'terminate' | 'reject' | null>(null);
  const [reason, setReason] = useState('');

  // COD threshold + contract terms editors
  const [threshold, setThreshold] = useState('');
  const [terms, setTerms] = useState<TermsForm>(EMPTY_TERMS);
  const [termsSeed, setTermsSeed] = useState<TermsForm>(EMPTY_TERMS);
  const [termsError, setTermsError] = useState<string | null>(null);

  // Lazy eligibility / history / settlements
  const [eligibility, setEligibility] = useState<AgentEligibility | null>(null);
  const [eligLoading, setEligLoading] = useState(false);
  const [history, setHistory] = useState<AgentHistoryEvent[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [settlements, setSettlements] = useState<ContractSettlements | null>(null);
  const [settlementsLoading, setSettlementsLoading] = useState(false);

  // This dialog stays mounted while the roster row behind it changes, so the
  // lazily-loaded panels must be dropped when it points at a different contract
  // — otherwise the previous agent's eligibility/history/settlements would be
  // shown for the next one.
  const membershipId = entry?.membership.id;
  useEffect(() => {
    setEligibility(null);
    setHistory(null);
    setSettlements(null);
    setThreshold('');
    setMode(null);
    setReason('');
  }, [membershipId]);

  if (!entry) return null;
  const { membership, agent, cashHeld } = entry;
  const mid = membership.id;
  const VehicleIcon = getVehicleIcon(agent.vehicleInfo?.vehicle_type);
  const ending = contractEnding(membership);

  const resetInline = () => {
    setMode(null);
    setReason('');
  };

  const seedTerms = () => {
    const seeded = seedTermsForm(membership);
    setTerms(seeded);
    setTermsSeed(seeded);
    setTermsError(null);
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

  const saveThreshold = async () => {
    const value = Number(threshold);
    if (Number.isNaN(value)) return;
    const result = await actions.updateCodLimit(mid, value);
    if (result) setThreshold('');
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

  const saveTerms = async () => {
    const payload = buildTermsPayload(terms, termsSeed);
    if (Object.keys(payload).length === 0) {
      setTermsError('Nothing changed yet.');
      return;
    }
    const splitError = feeSplitError(terms, termsSeed);
    if (splitError) {
      setTermsError(splitError);
      return;
    }
    const result = await actions.updateTerms(mid, payload);
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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetInline(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
              {agentAvatarUrl(agent) ? (
                <img src={agentAvatarUrl(agent)!} crossOrigin="use-credentials" alt={agent.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate">{agent.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <MembershipStatusBadge status={membership.status} />
                {membership.isPrimary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                <span className="text-xs text-muted-foreground capitalize">{membership.origin.replace(/_/g, ' ')}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-5">
          <div className="py-4 space-y-5">
            {/* How a terminal contract ended. Terminal is terminal — the row
                survives only as history, so the reason is the whole story. */}
            {ending && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">{ending.label}</p>
                {ending.at && (
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(ending.at)}</p>
                )}
                {ending.reason ? (
                  <p className="text-sm mt-1.5">“{ending.reason}”</p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1.5">No reason was given.</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Contracting with this agent again starts a new contract; this one stays as history.
                </p>
              </div>
            )}

            {/* Contact + vehicle + stats */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4" />{agent.email ?? '—'}</div>
              <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" />{agent.phone ?? '—'}</div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <VehicleIcon className="w-4 h-4" />
                {agent.vehicleInfo ? formatVehicleType(agent.vehicleInfo.vehicle_type) : '—'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />Trust {agent.trustScore}</div>
              <div className="flex items-center gap-2 text-muted-foreground"><Package className="w-4 h-4" />{agent.activeShipmentCount} active</div>
              <div className="flex items-center gap-2 text-muted-foreground capitalize">{agent.availability}</div>
            </div>

            <Separator />

            {/* Cash + COD threshold */}
            <div className="space-y-2">
              <p className="text-sm font-medium">COD cash</p>
              <p className="text-sm text-muted-foreground">
                Holds <span className="font-medium text-foreground">{formatNumber(cashHeld)}</span> · current cap{' '}
                {formatNumber(membership.codThreshold)}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder="New COD threshold (0 = none)"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="flex-1"
                />
                <Button size="sm" disabled={threshold === '' || pk === `cod-limit:${mid}`} onClick={saveThreshold}>
                  {pk === `cod-limit:${mid}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Set'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A slice of the agent's global COD pool — a raise can be refused if other agencies use the pool.
              </p>
            </div>

            <Separator />

            {/* Contract terms — employment, fee split, remittance, value ceiling */}
            <Collapsible onOpenChange={(o) => o && seedTerms()}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="px-0 text-sm font-medium">Contract terms</Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                {/* Employment */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employment</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select value={terms.empType} onValueChange={(v) => setTerm('empType', v as EmploymentType)}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {EMPLOYMENT_TYPES.map((t) => (
                            <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Employee ref</Label>
                      <Input value={terms.empRef} onChange={(e) => setTerm('empRef', e.target.value)} placeholder="EMP-042" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Started</Label>
                      <Input type="date" value={terms.empStart} onChange={(e) => setTerm('empStart', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Ends</Label>
                      <Input type="date" value={terms.empEnd} onChange={(e) => setTerm('empEnd', e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Fee split — what this agent is paid per delivery */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fee split</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Model</Label>
                      <Select value={terms.feeModel} onValueChange={(v) => setTerm('feeModel', v as FeeSplitModel)}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="flat">Flat fee</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(terms.feeModel || termsSeed.feeModel) === 'flat' ? (
                      <div className="space-y-1">
                        <Label className="text-xs">Flat fee per delivery</Label>
                        <Input
                          type="number"
                          min={0}
                          value={terms.flatFee}
                          onChange={(e) => setTerm('flatFee', e.target.value)}
                          placeholder="1500"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Label className="text-xs">Agent share (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={terms.sharePercent}
                          onChange={(e) => setTerm('sharePercent', e.target.value)}
                          placeholder="40"
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Currency</Label>
                      <Input
                        value={terms.currency}
                        maxLength={3}
                        onChange={(e) => setTerm('currency', e.target.value.toUpperCase())}
                        placeholder="XAF"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The agent's cut comes <span className="font-medium">out of</span> your delivery fee, never on
                    top — the vendor pays the same either way. The platform pays it from the agent's own
                    earnings account.
                  </p>
                </div>

                {/* Remittance cadence */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">COD remittance</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Cadence</Label>
                      <Select value={terms.cadence} onValueChange={(v) => setTerm('cadence', v as RemittanceCadence)}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {REMITTANCE_CADENCES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Grace hours</Label>
                      <Input
                        type="number"
                        min={0}
                        max={720}
                        value={terms.graceHours}
                        onChange={(e) => setTerm('graceHours', e.target.value)}
                        placeholder="24"
                      />
                    </div>
                    {['weekly', 'biweekly'].includes(terms.cadence || termsSeed.cadence) && (
                      <div className="space-y-1">
                        <Label className="text-xs">Day of week (0 = Sunday)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={6}
                          value={terms.dayOfWeek}
                          onChange={(e) => setTerm('dayOfWeek', e.target.value)}
                        />
                      </div>
                    )}
                    {(terms.cadence || termsSeed.cadence) === 'monthly' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Day of month (1–28)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={28}
                          value={terms.dayOfMonth}
                          onChange={(e) => setTerm('dayOfMonth', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Coverage regions */}
                <div className="space-y-1">
                  <Label className="text-xs">Coverage regions</Label>
                  <Input
                    value={terms.regions}
                    onChange={(e) => setTerm('regions', e.target.value)}
                    placeholder="Douala, Bonabéri"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated. Where this agent works for you — it cannot exceed the area they
                    agreed to cover. Leave empty for no restriction.
                  </p>
                </div>

                {/* Per-shipment value ceiling */}
                <div className="space-y-1">
                  <Label className="text-xs">Shipment value ceiling</Label>
                  <Input
                    type="number"
                    min={0}
                    value={terms.ceiling}
                    onChange={(e) => setTerm('ceiling', e.target.value)}
                    placeholder="No cap"
                  />
                  <p className="text-xs text-muted-foreground">
                    The most this agent may carry on one shipment. Leave empty for no cap.
                  </p>
                </div>

                {termsError && <p className="text-xs text-destructive">{termsError}</p>}

                <Button size="sm" variant="outline" disabled={pk === `terms:${mid}`} onClick={saveTerms}>
                  {pk === `terms:${mid}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save contract terms'}
                </Button>
              </CollapsibleContent>
            </Collapsible>

            {/* Settlements — this contract's cash history */}
            <Collapsible onOpenChange={(o) => o && loadSettlements()}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="px-0 text-sm font-medium">Settlements</Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                {settlementsLoading ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</p>
                ) : settlements ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Outstanding</p>
                        <p className={settlements.cod.outstandingBalance > 0 ? 'font-medium text-amber-600' : 'font-medium'}>
                          {formatNumber(settlements.cod.outstandingBalance)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Settled lifetime</p>
                        <p className="font-medium">{formatNumber(settlements.cod.lifetimeSettled)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Outstanding cash must reach zero before this contract can end. Last settled{' '}
                      {formatDate(settlements.cod.lastSettledAt)}.
                    </p>
                    {settlements.deposits.length > 0 ? (
                      <div className="space-y-1.5">
                        {settlements.deposits.map((deposit) => (
                          <div key={deposit.id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {formatDate(deposit.declaredAt)} · to {deposit.recipient}
                            </span>
                            <span className="flex items-center gap-2">
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
              </CollapsibleContent>
            </Collapsible>

            {/* Eligibility */}
            <Collapsible onOpenChange={(o) => o && loadEligibility()}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="px-0 text-sm font-medium">Assignment eligibility</Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                {eligLoading ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Checking…</p>
                ) : eligibility ? (
                  <div className="space-y-1">
                    <p className="text-sm flex items-center gap-1">
                      {eligibility.eligible ? (
                        <><CheckCircle2 className="w-4 h-4 text-green-500" /> Eligible now</>
                      ) : (
                        <><XCircle className="w-4 h-4 text-destructive" /> Not eligible</>
                      )}
                      <span className="text-muted-foreground ml-1">
                        ({eligibility.activeShipmentCount}/{eligibility.maxConcurrentShipments} capacity)
                      </span>
                    </p>
                    {eligibility.rules.map((rule) => (
                      <div key={rule.rule} className="text-xs flex items-center gap-1.5">
                        {rule.passed ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-destructive" />}
                        <span className={rule.passed ? 'text-muted-foreground' : 'text-destructive'}>
                          {rule.rule.replace(/_/g, ' ')}{rule.reason ? ` — ${rule.reason.replace(/_/g, ' ')}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Could not load eligibility.</p>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* History */}
            <Collapsible onOpenChange={(o) => o && loadHistory()}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="px-0 text-sm font-medium">History</Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                {historyLoading ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</p>
                ) : history && history.length > 0 ? (
                  <div className="space-y-2">
                    {history.map((event, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <MapPin className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <span className="font-medium capitalize">{event.type.replace(/_/g, ' ')}</span>
                          <span className="text-muted-foreground ml-1">{formatDate(event.createdAt ?? event.at)}</span>
                          {event.note && <p className="text-muted-foreground">{String(event.note)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No history.</p>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Inline reason mode */}
            {mode && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">
                  {mode === 'suspend' && 'Reason for suspension'}
                  {mode === 'pause' && 'Reason for pausing (optional)'}
                  {mode === 'reject' && 'Reason for declining (optional)'}
                  {mode === 'terminate' && 'Reason for removal (optional)'}
                </p>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Add a reason…" />
                {mode === 'pause' && (
                  <p className="text-xs text-muted-foreground">
                    A mutual break: no new assignments, shipments already in flight are untouched.
                    Reinstate whenever you both want to restart.
                  </p>
                )}
                {mode === 'terminate' && (
                  <p className="text-xs text-muted-foreground">
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
                    {pk === `${mode}:${mid}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Action footer */}
        {!mode && (
          <div className="px-5 py-4 border-t flex flex-wrap gap-2">
            {/* Whoever raised the contract cannot answer it — the server picks the
                valid pair from `initiatedBy`, and the wrong one is a 403. */}
            {membership.status === 'pending' && membership.initiatedBy === 'agent' && (
              <>
                <Button size="sm" className="flex-1" disabled={pk === `approve:${mid}`} onClick={() => actions.approve(mid, agent.id).then((r) => r && onOpenChange(false))}>
                  {pk === `approve:${mid}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve'}
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
                  {pk === `withdraw:${mid}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Withdraw request'}
                </Button>
              </>
            )}
            {membership.status === 'active' && (
              <>
                <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setMode('pause')}>
                  <PauseCircle className="w-4 h-4" /> Pause
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setMode('suspend')}>
                  <ShieldAlert className="w-4 h-4" /> Suspend
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-destructive" onClick={() => setMode('terminate')}>Remove</Button>
              </>
            )}
            {(membership.status === 'paused' || membership.status === 'suspended') && (
              <>
                <Button size="sm" className="flex-1" disabled={pk === `reinstate:${mid}`} onClick={() => actions.reinstate(mid).then((r) => r && onOpenChange(false))}>
                  {pk === `reinstate:${mid}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reinstate'}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-destructive" onClick={() => setMode('terminate')}>Remove</Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
