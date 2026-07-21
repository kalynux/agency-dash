import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, RefreshCw, Navigation, Gauge, Clock, Wifi, WifiOff, ExternalLink, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AsyncBoundary, EmptyState } from '@/components/common/state-views';
import { useResource } from '@/hooks/useResource';
import { useGeoTrackerSocket } from '@/hooks/useGeoTrackerSocket';
import { useAgentsRoster } from '@/store/agents.store';
import { trackingService } from '@/services/tracking.service';
import { cn } from '@/lib/utils';
import type { AgentLiveFix, TrackingSocketStatus } from '@/types/tracking.types';

const STATUS_META: Record<TrackingSocketStatus, { label: string; className: string; icon: React.ElementType }> = {
  idle: { label: 'Idle', className: 'text-muted-foreground', icon: WifiOff },
  connecting: { label: 'Connecting…', className: 'text-amber-600', icon: Radio },
  open: { label: 'Live', className: 'text-green-600', icon: Wifi },
  closed: { label: 'Disconnected', className: 'text-muted-foreground', icon: WifiOff },
  error: { label: 'Connection error', className: 'text-destructive', icon: WifiOff },
};

function secondsAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

/** A relative (not-to-scale) plot of the live fixes, so operators get a spatial sense without a tile map. */
function RelativeMap({ fixes, nameFor }: { fixes: AgentLiveFix[]; nameFor: (id: string) => string }) {
  const W = 600;
  const H = 300;
  const pad = 30;

  const projected = useMemo(() => {
    if (fixes.length === 0) return [];
    const lats = fixes.map((f) => f.position.latitude);
    const lngs = fixes.map((f) => f.position.longitude);
    let minLat = Math.min(...lats), maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    if (maxLat - minLat < 1e-4) { minLat -= 0.01; maxLat += 0.01; }
    if (maxLng - minLng < 1e-4) { minLng -= 0.01; maxLng += 0.01; }
    return fixes.map((f) => ({
      id: f.agentId,
      x: pad + ((f.position.longitude - minLng) / (maxLng - minLng)) * (W - 2 * pad),
      y: pad + ((maxLat - f.position.latitude) / (maxLat - minLat)) * (H - 2 * pad),
      heading: f.headingDegrees,
    }));
  }, [fixes]);

  return (
    <div className="rounded-lg border bg-muted/30 overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Relative agent positions">
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" className="text-muted-foreground" />
        {projected.map((p) => (
          <g key={p.id} transform={`translate(${p.x}, ${p.y})`}>
            {typeof p.heading === 'number' && (
              <line x1="0" y1="0" x2={12 * Math.sin((p.heading * Math.PI) / 180)} y2={-12 * Math.cos((p.heading * Math.PI) / 180)}
                stroke="currentColor" className="text-primary" strokeWidth="2" />
            )}
            <circle r="6" className="fill-primary" />
            <circle r="10" className="fill-primary/20">
              <animate attributeName="r" values="6;14;6" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
            </circle>
            <text x="10" y="4" className="fill-foreground text-[10px]">{nameFor(p.id)}</text>
          </g>
        ))}
      </svg>
      <p className="text-[11px] text-muted-foreground px-3 py-1.5 border-t">Relative positions — not to scale.</p>
    </div>
  );
}

export function LiveTracking() {
  const { agents } = useAgentsRoster();
  const [searchParams] = useSearchParams();
  const focusAgentId = searchParams.get('agent');
  const visible = useResource(() => trackingService.getVisibleAgents().then((r) => r.data), []);

  const agentIds = useMemo(() => visible.data?.agents ?? [], [visible.data]);
  const socket = useGeoTrackerSocket(agentIds);

  const nameFor = (id: string) => agents.find((a) => a.id === id)?.name ?? `Agent ${id.slice(-6)}`;

  // Deep-link from a shipment row: scroll the requested agent's card into view.
  const focusPresent = !!focusAgentId && agentIds.includes(focusAgentId);
  useEffect(() => {
    if (!focusPresent || !focusAgentId) return;
    const el = document.getElementById(`track-agent-${focusAgentId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusPresent, focusAgentId]);
  const fixList = Object.values(socket.fixes);
  const statusMeta = STATUS_META[socket.status];
  const StatusIcon = statusMeta.icon;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Live Tracking</h1>
          <p className="text-muted-foreground">Real-time positions of agents on your active shipments</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn('flex items-center gap-1.5 text-sm font-medium', statusMeta.className)}>
            <StatusIcon className="w-4 h-4" />
            {statusMeta.label}
          </span>
          <Button variant="outline" size="icon" onClick={() => { visible.refetch(); socket.reconnect(); }} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {socket.status === 'error' && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="p-4 flex items-center justify-between gap-3 text-sm text-amber-800">
            <span>
              Couldn't reach the live-tracking service. It authenticates on your session cookie (same-site) — if
              geo-tracker runs on a different domain, a bearer token is required (see env/README.md).
            </span>
            <Button variant="outline" size="sm" onClick={socket.reconnect}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {focusAgentId && !focusPresent && !visible.isLoading && !visible.error && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{nameFor(focusAgentId)}</span> isn't broadcasting a
            live position right now. They'll appear here once they're out on an active shipment.
          </CardContent>
        </Card>
      )}

      <AsyncBoundary
        isLoading={visible.isLoading}
        error={visible.error}
        onRetry={visible.refetch}
        isEmpty={agentIds.length === 0}
        emptyState={
          <EmptyState
            icon={MapPin}
            title="No agents to track right now"
            description="Agents appear here while they're delivering an active shipment for your agency."
          />
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {fixList.length > 0 ? (
              <RelativeMap fixes={fixList} nameFor={nameFor} />
            ) : (
              <div className="rounded-lg border bg-muted/30 h-64 flex items-center justify-center text-sm text-muted-foreground">
                {socket.status === 'open' ? 'Waiting for the first position…' : 'No live positions yet.'}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {agentIds.map((id) => {
              const fix = socket.fixes[id];
              const isRevoked = socket.revoked.has(id);
              const isFocused = id === focusAgentId;
              return (
                <Card
                  key={id}
                  id={`track-agent-${id}`}
                  className={cn(
                    'transition-shadow',
                    isRevoked && 'opacity-60',
                    isFocused && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  )}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{nameFor(id)}</p>
                      {fix ? (
                        <Badge variant="outline" className="text-green-600 border-green-200 gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
                        </Badge>
                      ) : isRevoked ? (
                        <Badge variant="outline" className="text-muted-foreground">Ended</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">No signal</Badge>
                      )}
                    </div>
                    {fix ? (
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" />
                          {fix.position.latitude.toFixed(5)}, {fix.position.longitude.toFixed(5)}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {typeof fix.speedMps === 'number' && (
                            <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />{(fix.speedMps * 3.6).toFixed(0)} km/h</span>
                          )}
                          {typeof fix.headingDegrees === 'number' && (
                            <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />{fix.headingDegrees.toFixed(0)}°</span>
                          )}
                          {typeof fix.etaSeconds === 'number' && (
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />ETA {Math.round(fix.etaSeconds / 60)}m</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Updated {secondsAgo(fix.receivedAt)}</span>
                          <a
                            href={`https://www.google.com/maps?q=${fix.position.latitude},${fix.position.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Open in Maps <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {isRevoked ? 'Tracking ended (shipment finished).' : 'Awaiting a position from this agent.'}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </AsyncBoundary>
    </div>
  );
}
