import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Sparkles, ListOrdered, UserCheck, XCircle, Repeat, Clock, Navigation, Radar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useShipmentActions } from '@/hooks/useShipmentActions';
import { shipmentsService } from '@/services/shipments.service';
import { getApiErrorMessage } from '@/lib/errors';
import { ReassignDialog } from '@/components/shipments/ReassignDialog';
import type { AgentSummary } from '@/types/agent.types';
import { describeAddress } from '@/types/shipment.types';
import type { ShipmentDetail, ShipmentOffer, AssignmentCandidate } from '@/types/shipment.types';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export interface AssignmentPanelProps {
  detail: ShipmentDetail;
  agents: AgentSummary[];
  /** Reload the shipment detail + parent list after a change. */
  onChanged: () => void;
}

export function AssignmentPanel({ detail, agents, onChanged }: AssignmentPanelProps) {
  const { t } = useTranslation(['shipments', 'common']);
  const { assignAgent, autoAssign, cancelOffer, pendingKey } = useShipmentActions();
  const [agentDraft, setAgentDraft] = useState('');
  const [reassignOpen, setReassignOpen] = useState(false);
  // Best-effort local view of a just-created offer. The detail endpoint carries
  // no live offer, so this lets us show "offer pending / cancel" right after
  // offering, until the shipment reloads with an accepted agent.
  const [pendingOffer, setPendingOffer] = useState<{ offer: ShipmentOffer; agentId: string | null } | null>(null);
  // An auto-assign is a BROADCAST, not one offer: the nearest agent is offered
  // now, the next-nearest every timeout window after that, while earlier offers
  // still stand — first to accept wins. So it reads as "searching", not
  // "offer pending to X", and there is no single agent to name.
  const isBroadcasting = !!pendingOffer && pendingOffer.agentId === null;

  const [candidates, setCandidates] = useState<AssignmentCandidate[] | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);

  const activeAgents = agents.filter((a) => a.membershipStatus === 'active');
  const hasBoundAgent = !!detail.agentId;
  const canOffer = detail.status === 'assigned' && !hasBoundAgent && !pendingOffer;
  const nameFor = (id: string | null) =>
    id ? agents.find((a) => a.id === id)?.name ?? t('assignment.unnamedAgent') : null;

  const afterOffer = (result: { offer: ShipmentOffer; autoAccepted: boolean } | null, agentId: string | null) => {
    if (!result) return;
    if (result.autoAccepted) {
      setPendingOffer(null);
    } else {
      setPendingOffer({ offer: result.offer, agentId });
    }
    onChanged();
  };

  const handleAssign = async () => {
    if (!agentDraft) return;
    const result = await assignAgent(detail.id, agentDraft);
    afterOffer(result, agentDraft);
    setAgentDraft('');
  };

  const handleAutoAssign = async () => {
    const result = await autoAssign(detail.id);
    afterOffer(result, null);
  };

  const handleCancelOffer = async () => {
    const result = await cancelOffer(detail.id);
    if (result) {
      setPendingOffer(null);
      onChanged();
    }
  };

  const loadCandidates = async () => {
    setCandidatesLoading(true);
    setCandidatesError(null);
    try {
      const { data } = await shipmentsService.getAssignmentCandidates(detail.id);
      setCandidates(data);
    } catch (err) {
      setCandidatesError(getApiErrorMessage(err));
    } finally {
      setCandidatesLoading(false);
    }
  };

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {t('assignment.title')}
      </h3>

      {/* COD gating hint */}
      {detail.paymentMethod === 'cash_on_delivery' && !hasBoundAgent && (
        <p className="text-xs text-amber-600 mb-2">{t('assignment.codHint')}</p>
      )}

      {/* Bound agent + reassign */}
      {hasBoundAgent && detail.agent && (
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0 overflow-hidden">
              {detail.agent.avatarUrl ? (
                <img src={detail.agent.avatarUrl} crossOrigin="use-credentials" alt={detail.agent.name} className="w-full h-full object-cover" />
              ) : (
                initials(detail.agent.name)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{detail.agent.name}</p>
              <p className="text-xs text-muted-foreground">{detail.agent.phone}</p>
            </div>
            <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200">
              <UserCheck className="w-3 h-3" /> {t('assignment.accepted')}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to={`/dashboard/tracking?agent=${detail.agentId}`}>
                <Navigation className="w-3.5 h-3.5" /> {t('assignment.trackOnMap')}
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setReassignOpen(true)}>
              <Repeat className="w-3.5 h-3.5" /> {t('assignment.reassign')}
            </Button>
          </div>
        </div>
      )}

      {/* Live offer / broadcast (best-effort) */}
      {pendingOffer && !hasBoundAgent && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-amber-900">
              {isBroadcasting ? (
                <Radar className="w-4 h-4 flex-shrink-0" />
              ) : (
                <Clock className="w-4 h-4 flex-shrink-0" />
              )}
              <span>
                {isBroadcasting
                  ? t('assignment.searching')
                  : t('assignment.offerPending', { name: nameFor(pendingOffer.agentId) })}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0 gap-1"
              disabled={pendingKey === `cancel-offer:${detail.id}`}
              onClick={handleCancelOffer}
            >
              {pendingKey === `cancel-offer:${detail.id}` ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5" />{' '}
                  {isBroadcasting ? t('assignment.stop') : t('assignment.cancel')}
                </>
              )}
            </Button>
          </div>
          {isBroadcasting && (
            <p className="text-xs text-amber-800">{t('assignment.broadcastExplainer')}</p>
          )}
        </div>
      )}

      {/* Offer controls */}
      {canOffer && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Select value={agentDraft} onValueChange={setAgentDraft}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t('assignment.choosePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {activeAgents.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    {t('assignment.noActiveAgents')}
                  </div>
                ) : (
                  activeAgents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={!agentDraft || pendingKey === `assign:${detail.id}`} onClick={handleAssign}>
              {pendingKey === `assign:${detail.id}` ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                t('assignment.offer')
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              disabled={pendingKey === `auto:${detail.id}`}
              onClick={handleAutoAssign}
            >
              {pendingKey === `auto:${detail.id}` ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {t('assignment.autoAssign')}
            </Button>
            <Popover onOpenChange={(o) => o && candidates === null && loadCandidates()}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 gap-1.5">
                  <ListOrdered className="w-3.5 h-3.5" /> {t('assignment.previewCandidates')}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-0">
                <div className="p-3 border-b flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t('assignment.candidatesTitle')}</p>
                    {/* Proximity is the sort; the weighted score is tie-break context. */}
                    <p className="text-xs text-muted-foreground">{t('assignment.candidatesSubtitle')}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={loadCandidates}>
                    {t('assignment.candidatesRefresh')}
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                  {candidatesLoading ? (
                    <div className="flex items-center gap-2 justify-center py-6 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> {t('assignment.candidatesRanking')}
                    </div>
                  ) : candidatesError ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">{candidatesError}</p>
                  ) : !candidates || candidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      {t('assignment.candidatesEmpty')}
                    </p>
                  ) : (
                    candidates.map((c) => (
                      <button
                        key={c.agentId}
                        onClick={() => setAgentDraft(c.agentId)}
                        className="w-full text-start rounded-md p-2 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {t('assignment.candidateRank', {
                              rank: c.rank + 1,
                              name: nameFor(c.agentId) ?? c.agentId.slice(-6),
                            })}
                          </span>
                          <Badge variant="secondary">
                            {t('common:units.percent', { value: (c.score * 100).toFixed(0) })}
                          </Badge>
                        </div>
                        {/* `distance_km` is null whenever the pickup point or the
                            agent's position could not be resolved — the rest of
                            the breakdown still stands, so only the distance drops. */}
                        <p className="text-xs text-muted-foreground">
                          {t('assignment.candidateBreakdown', {
                            distance:
                              typeof c.breakdown?.distance_km === 'number'
                                ? t('assignment.candidateDistance', {
                                    km: c.breakdown.distance_km.toFixed(1),
                                  })
                                : t('assignment.candidateDistanceUnknown'),
                            capacity: c.breakdown?.free_capacity ?? t('common:values.notAvailable'),
                            trust: c.breakdown?.trust_score ?? t('common:values.notAvailable'),
                          })}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      {/* Nothing to do (no agent, not offerable, no local offer) */}
      {!hasBoundAgent && !canOffer && !pendingOffer && (
        <p className="text-xs text-muted-foreground">
          {detail.status === 'handing_over'
            ? t('assignment.handoverInProgress')
            : t('assignment.notOfferable')}
        </p>
      )}

      {/* Handover pickup info */}
      {detail.handover && (
        <div className="mt-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">{t('assignment.handoverTitle')}</p>
          {detail.handover.pickup.address?.label && <p>{detail.handover.pickup.address.label}</p>}
          {/* `formattedAddress` is the geocoder's own one-liner where there is
              one, so prefer it over recomposing the parts. */}
          {describeAddress(detail.handover.pickup.address) && (
            <p>
              {detail.handover.pickup.address?.formattedAddress ??
                describeAddress(detail.handover.pickup.address)}
            </p>
          )}
          {detail.handover.pickup.note && (
            <p>{t('assignment.handoverNote', { note: detail.handover.pickup.note })}</p>
          )}
          {detail.handover.pickup.isFallback && (
            <p className="text-amber-600">{t('assignment.handoverFallback')}</p>
          )}
        </div>
      )}

      {hasBoundAgent && detail.agent && (
        <ReassignDialog
          shipmentId={detail.id}
          currentAgentId={detail.agentId}
          status={detail.status}
          agents={agents}
          open={reassignOpen}
          onOpenChange={setReassignOpen}
          onReassigned={onChanged}
        />
      )}
    </section>
  );
}
