import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, RefreshCw, Navigation, Gauge, Clock, Wifi, WifiOff, ExternalLink, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AsyncBoundary, EmptyState } from '@/components/common/state-views';
import { useResource } from '@/hooks/useResource';
import { useGeoTrackerSocket } from '@/hooks/useGeoTrackerSocket';
import { useAgentsRoster } from '@/store/agents.store';
import { useUIStore } from '@/store';
import { trackingService } from '@/services/tracking.service';
import { LiveTrackingMap } from '@/components/tracking/LiveTrackingMap';
import { cn } from '@/lib/utils';
import type { TrackingSocketStatus } from '@/types/tracking.types';

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

export function LiveTracking() {
  const { agents } = useAgentsRoster();
  const { theme } = useUIStore();
  const [searchParams] = useSearchParams();
  const focusAgentId = searchParams.get('agent');
  const visible = useResource(() => trackingService.getVisibleAgents().then((r) => r.data), []);

  const agentIds = useMemo(() => visible.data?.agents ?? [], [visible.data]);
  const socket = useGeoTrackerSocket(agentIds);

  // The agent the map is centered/highlighted on — seeded from the ?agent= deep link,
  // then driven by clicking a card or a marker.
  const [selected, setSelected] = useState<string | null>(focusAgentId);
  // Follow the deep link if it changes in-place (adjusting state during render — the
  // React-recommended alternative to a setState-in-effect).
  const [prevFocus, setPrevFocus] = useState<string | null>(focusAgentId);
  if (focusAgentId !== prevFocus) {
    setPrevFocus(focusAgentId);
    if (focusAgentId) setSelected(focusAgentId);
  }

  const nameFor = (id: string) => agents.find((a) => a.id === id)?.name ?? `Agent ${id.slice(-6)}`;

  const focusPresent = !!focusAgentId && agentIds.includes(focusAgentId);

  // Keep the selected agent's card in view (deep-link or marker click).
  useEffect(() => {
    if (!selected) return;
    document
      .getElementById(`track-agent-${selected}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selected]);

  const statusMeta = STATUS_META[socket.status];
  const StatusIcon = statusMeta.icon;
  const isDark = theme === 'dark';
  const emptyHint = socket.status === 'open' ? 'Waiting for the first position…' : 'No live positions yet.';

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
          <div className="lg:col-span-2 h-[420px] lg:h-[600px]">
            <LiveTrackingMap
              fixes={socket.fixes}
              trails={socket.trails}
              nameFor={nameFor}
              focusAgentId={focusAgentId}
              selectedAgentId={selected}
              onSelectAgent={setSelected}
              isDark={isDark}
              emptyHint={emptyHint}
            />
          </div>

          <div className="space-y-3 lg:max-h-[600px] lg:overflow-y-auto lg:pr-1">
            {agentIds.map((id) => {
              const fix = socket.fixes[id];
              const isRevoked = socket.revoked.has(id);
              const isSelected = id === selected;
              return (
                <Card
                  key={id}
                  id={`track-agent-${id}`}
                  onClick={() => setSelected(id)}
                  className={cn(
                    'cursor-pointer transition-shadow hover:shadow-md',
                    isRevoked && 'opacity-60',
                    isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
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
                            onClick={(e) => e.stopPropagation()}
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
