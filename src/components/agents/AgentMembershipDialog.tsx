import { useState } from 'react';
import {
  Loader2,
  Phone,
  Mail,
  Star,
  Package,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  MapPin,
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
import type {
  RosterEntry,
  EmploymentType,
  AgentEligibility,
  AgentHistoryEvent,
} from '@/types/agent.types';

const EMPLOYMENT_TYPES: EmploymentType[] = ['employee', 'contractor', 'freelancer'];

function formatDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
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
  const [mode, setMode] = useState<'suspend' | 'remove' | 'decline' | null>(null);
  const [reason, setReason] = useState('');

  // COD threshold + employment editors
  const [threshold, setThreshold] = useState('');
  const [empType, setEmpType] = useState<EmploymentType | ''>('');
  const [empRef, setEmpRef] = useState('');
  const [empStart, setEmpStart] = useState('');
  const [empEnd, setEmpEnd] = useState('');

  // Lazy eligibility / history
  const [eligibility, setEligibility] = useState<AgentEligibility | null>(null);
  const [eligLoading, setEligLoading] = useState(false);
  const [history, setHistory] = useState<AgentHistoryEvent[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  if (!entry) return null;
  const { membership, agent, cashHeld } = entry;
  const mid = membership.id;
  const VehicleIcon = getVehicleIcon(agent.vehicleInfo?.vehicle_type);

  const resetInline = () => {
    setMode(null);
    setReason('');
  };

  const seedEmployment = () => {
    setEmpType(membership.employment?.employmentType ?? '');
    setEmpRef(membership.employment?.employeeRef ?? '');
    setEmpStart(membership.employment?.startedAt?.slice(0, 10) ?? '');
    setEmpEnd(membership.employment?.endsAt?.slice(0, 10) ?? '');
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

  const saveEmployment = async () => {
    const result = await actions.updateEmployment(mid, {
      employment_type: empType || undefined,
      employee_ref: empRef || null,
      started_at: empStart || null,
      ends_at: empEnd || null,
    });
    if (result) seedEmployment();
  };

  const confirmInline = async () => {
    if (mode === 'suspend') {
      if (!reason.trim()) return;
      const r = await actions.suspend(mid, reason.trim());
      if (r) { resetInline(); onOpenChange(false); }
    } else if (mode === 'decline') {
      const r = await actions.decline(mid, reason.trim() || undefined);
      if (r) { resetInline(); onOpenChange(false); }
    } else if (mode === 'remove') {
      const r = await actions.remove(mid, reason.trim() || undefined);
      if (r) { resetInline(); onOpenChange(false); }
    }
  };

  const pk = actions.pendingKey;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetInline(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-5">
          <div className="flex items-center gap-3">
            <img
              src={agent.avatarUrl || `https://i.pravatar.cc/150?u=${agent.id}`}
              alt={agent.name}
              className="w-10 h-10 rounded-full"
            />
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
            {/* Contact + vehicle + stats */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4" />{agent.email}</div>
              <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" />{agent.phone}</div>
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
                Holds <span className="font-medium text-foreground">{cashHeld.toLocaleString()}</span> · current cap{' '}
                {membership.codMaxExposureOverride?.toLocaleString() ?? '0'}
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

            {/* Employment */}
            <Collapsible onOpenChange={(o) => o && seedEmployment()}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="px-0 text-sm font-medium">Employment terms</Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={empType} onValueChange={(v) => setEmpType(v as EmploymentType)}>
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
                    <Input value={empRef} onChange={(e) => setEmpRef(e.target.value)} placeholder="EMP-042" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Started</Label>
                    <Input type="date" value={empStart} onChange={(e) => setEmpStart(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ends</Label>
                    <Input type="date" value={empEnd} onChange={(e) => setEmpEnd(e.target.value)} />
                  </div>
                </div>
                <Button size="sm" variant="outline" disabled={pk === `employment:${mid}`} onClick={saveEmployment}>
                  {pk === `employment:${mid}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save employment'}
                </Button>
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
                  {mode === 'decline' && 'Reason for declining (optional)'}
                  {mode === 'remove' && 'Reason for removal (optional)'}
                </p>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Add a reason…" />
                {mode === 'remove' && (
                  <p className="text-xs text-muted-foreground">
                    This proposes termination — the contract ends once the agent agrees and any outstanding cash
                    and unpaid earnings are settled.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={resetInline}>Cancel</Button>
                  <Button
                    size="sm"
                    variant={mode === 'suspend' || mode === 'remove' ? 'destructive' : 'default'}
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
            {membership.status === 'pending' && (
              <>
                <Button size="sm" className="flex-1" disabled={pk === `approve:${mid}`} onClick={() => actions.approve(mid).then((r) => r && onOpenChange(false))}>
                  {pk === `approve:${mid}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve'}
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setMode('decline')}>Decline</Button>
              </>
            )}
            {membership.status === 'approved' && (
              <>
                <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setMode('suspend')}>
                  <ShieldAlert className="w-4 h-4" /> Suspend
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-destructive" onClick={() => setMode('remove')}>Remove</Button>
              </>
            )}
            {membership.status === 'suspended' && (
              <>
                <Button size="sm" className="flex-1" disabled={pk === `reinstate:${mid}`} onClick={() => actions.reinstate(mid).then((r) => r && onOpenChange(false))}>
                  {pk === `reinstate:${mid}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reinstate'}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-destructive" onClick={() => setMode('remove')}>Remove</Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
