import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import {
  Clock,
  MapPin,
  PanelRightClose,
  PanelRightOpen,
  Radio,
  RefreshCw,
  Route,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AsyncBoundary, EmptyState } from '@/components/common/state-views';
import { PageHeader } from '@/components/layout/PageContainer';
import { useResource } from '@/hooks/useResource';
import { useGeoTrackerSocket, type TrackingScope } from '@/hooks/useGeoTrackerSocket';
import { useIsBelowDesktop } from '@/hooks/use-mobile';
import { useUIStore } from '@/store';
import { trackingService } from '@/services/tracking.service';
import { geoTrackerService, toPath, warnGeoTrackerDegraded } from '@/services/geo-tracker.service';
import { LiveTrackingMap, type ShipmentPin } from '@/components/tracking/LiveTrackingMap';
import { PinMark } from '@/components/tracking/PinMark';
import { TrackingPanel, type SignalFilter } from '@/components/tracking/TrackingPanel';
import { formatDistance } from '@/components/tracking/format';
import { ShipmentStatusBadge } from '@/components/shipments/ShipmentStatusBadge';
import { cn } from '@/lib/utils';
import { isConclusiveRevoke } from '@/types/tracking.types';
import type { TrackingSocketStatus } from '@/types/tracking.types';

const STATUS_META: Record<
  TrackingSocketStatus,
  {
    labelKey: `connection.${TrackingSocketStatus}`;
    className: string;
    icon: React.ElementType;
  }
> = {
  idle: {
    labelKey: 'connection.idle',
    className: 'text-muted-foreground',
    icon: WifiOff,
  },
  connecting: {
    labelKey: 'connection.connecting',
    className: 'text-amber-600',
    icon: Radio,
  },
  open: {
    labelKey: 'connection.open',
    className: 'text-green-600',
    icon: Wifi,
  },
  closed: {
    labelKey: 'connection.closed',
    className: 'text-muted-foreground',
    icon: WifiOff,
  },
  error: {
    labelKey: 'connection.error',
    className: 'text-destructive',
    icon: WifiOff,
  },
};

/**
 * The board is a snapshot of *assignments*, which change on the order of
 * minutes; positions change on the order of seconds and arrive on the socket.
 * Re-fetching the board per position update would be pure waste.
 */
const BOARD_POLL_MS = 60_000;
/** Enough checkpoints for a long delivery — the trail is downsampled, not per-fix. */
const TRAIL_LIMIT = 500;

/**
 * The map is the page, so it takes the viewport rather than a fixed box.
 *
 * The subtracted height is the chrome around it: on phones the page gutter, the
 * two-line `PageHeader` (its actions sit beside the title, so they cost no
 * height), the roster trigger below the map and the fixed tab bar's `pb-24`; on
 * desktop the app header and gutter. Both are approximations with slack — an
 * error banner pushing the stage down makes the page scroll, which is the
 * graceful outcome.
 */
const STAGE_HEIGHT =
  'h-[calc(100dvh-15rem)] min-h-[300px] lg:h-[calc(100dvh-13rem)] lg:min-h-[520px] lg:max-h-[900px]';

export function LiveTracking() {
  const { t } = useTranslation(['tracking', 'common']);
  const { resolvedTheme } = useUIStore();
  const isBelowDesktop = useIsBelowDesktop();
  const [searchParams] = useSearchParams();
  const focusAgentId = searchParams.get('agent');
  const focusShipmentId = searchParams.get('shipment');

  // One call draws the whole map: the agents this agency may watch and, per
  // agent, their active shipments with a start and an end pin. It never carries
  // a position — those arrive only on the socket.
  const board = useResource(() => trackingService.getBoard(), []);
  const agents = useMemo(() => board.data?.agents ?? [], [board.data]);
  const agentIds = useMemo(() => agents.map((a) => a.agentId), [agents]);

  // The agent the map is centered/highlighted on — seeded from the ?agent= deep
  // link, then driven by clicking a card or a marker.
  const [selected, setSelected] = useState<string | null>(focusAgentId);
  const [selectedShipment, setSelectedShipment] = useState<string | null>(focusShipmentId);
  const [search, setSearch] = useState('');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('all');
  /** Desktop: the sidebar, open by default and closable to give the map the width. */
  const [panelOpen, setPanelOpen] = useState(true);
  /** Phones: the same panel as a bottom sheet. */
  const [sheetOpen, setSheetOpen] = useState(false);

  // Follow the deep link if it changes in-place (adjusting state during render — the
  // React-recommended alternative to a setState-in-effect).
  const [prevFocus, setPrevFocus] = useState<string | null>(focusAgentId);
  if (focusAgentId !== prevFocus) {
    setPrevFocus(focusAgentId);
    if (focusAgentId) setSelected(focusAgentId);
  }

  const selectedAgent = agents.find((a) => a.agentId === selected) ?? null;
  const shipment = selectedAgent?.shipments.find((s) => s.shipmentId === selectedShipment) ?? null;

  // A live ETA is scoped per subscription, and we scope it by SHIPMENT rather
  // than by coordinates: the server resolves that shipment's own drop-off from
  // its tracking session, so the customer's address never has to be handed to a
  // second service to get an ETA out of it.
  //
  // Naming the shipment also settles the multi-drop case. An agent running
  // several deliveries has several drop-offs, and "watch agent X" does not say
  // which one is meant — the server declines to guess, so without this the
  // selected row would show no ETA at all.
  const scopes = useMemo<Record<string, TrackingScope>>(() => {
    if (!selected || !shipment) return {};
    return { [selected]: { shipmentId: shipment.shipmentId } };
  }, [selected, shipment]);

  const socket = useGeoTrackerSocket(agentIds, scopes);

  // Refetch the board on ANY revocation, whatever the reason.
  //
  // On `shipment_completed` the board genuinely changed. On the other two
  // nothing is known about the shipment — and the board is the only thing that
  // can say whether the row is still in flight, which is exactly why we ask it
  // rather than concluding anything from the frame.
  useEffect(() => {
    if (socket.revokedAt) board.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket.revokedAt]);

  // …otherwise a slow poll keeps the assignments honest.
  useEffect(() => {
    const id = setInterval(() => board.refetch(), BOARD_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The sheet is the phone shell for the panel; growing past the breakpoint
  // hands the roster back to the sidebar, so a stale sheet must not survive it.
  useEffect(() => {
    if (!isBelowDesktop) setSheetOpen(false);
  }, [isBelowDesktop]);

  // Drop a selection the board no longer carries (delivery finished mid-view).
  useEffect(() => {
    if (!board.data) return;
    if (selected && !agentIds.includes(selected)) {
      setSelected(null);
      setSelectedShipment(null);
    } else if (selectedShipment && selectedAgent && !shipment) {
      setSelectedShipment(null);
    }
  }, [board.data, agentIds, selected, selectedShipment, selectedAgent, shipment]);

  // Selecting an agent who is running exactly one delivery selects it too —
  // that is the delivery they meant to look at.
  const selectAgent = (agentId: string) => {
    if (agentId === selected) {
      // A second tap on the open row collapses it back to the roster.
      setSelected(null);
      setSelectedShipment(null);
      return;
    }
    setSelected(agentId);
    const shipments = agents.find((a) => a.agentId === agentId)?.shipments;
    setSelectedShipment(shipments?.length === 1 ? shipments[0].shipmentId : null);
  };

  const selectShipment = (agentId: string, shipmentId: string) => {
    const clearing = agentId === selected && shipmentId === selectedShipment;
    setSelected(agentId);
    setSelectedShipment(clearing ? null : shipmentId);
    // On a phone the sheet covers the map it just re-drew — get out of the way.
    if (!clearing) setSheetOpen(false);
  };

  // ── The selected agent's already-travelled path ───────────────────────────
  // geo-tracker's durable checkpoint trail. Scoped to the selected shipment it
  // is that delivery's whole path, continuous across every reconnect; without
  // one it is the agent's recent movement across everything they carry.
  const trail = useResource(async () => {
    if (!selected) return [];
    try {
      const checkpoints = await geoTrackerService.getCheckpoints(selected, {
        limit: TRAIL_LIMIT,
        ...(selectedShipment ? { shipment: selectedShipment } : {}),
      });
      return toPath(checkpoints);
    } catch (err) {
      // geo-tracker being unreachable costs the drawn path and nothing else.
      warnGeoTrackerDegraded('checkpoint trail', err);
      return [];
    }
  }, [selected, selectedShipment]);

  // ── The road line between the two pins ────────────────────────────────────
  // geo-tracker owns routing; wi-mall's board deliberately ships pins only. The
  // two ways this comes back empty are different problems and must not look the
  // same in the log: a THROW is geo-tracker or its provider chain (the code and
  // requestId say which), an empty `geometry` is a provider that answered with a
  // distance and no line.
  const originCoords = shipment?.origin?.address?.coordinates ?? null;
  const destCoords = shipment?.destination?.coordinates ?? null;
  const route = useResource(async () => {
    if (!originCoords || !destCoords) return null;
    try {
      const result = await geoTrackerService.getRoute(
        { latitude: originCoords.lat, longitude: originCoords.lng },
        { latitude: destCoords.lat, longitude: destCoords.lng },
      );
      if (result.geometry.length >= 2) return result.geometry;
      warnGeoTrackerDegraded('road geometry', {
        reason: 'provider returned a route with no drawable geometry',
        points: result.geometry.length,
        distanceMeters: result.distanceMeters,
      });
      return null;
    } catch (err) {
      // Optional by design — the map falls back to a straight line between the pins.
      warnGeoTrackerDegraded('road route', err);
      return null;
    }
  }, [originCoords?.lat, originCoords?.lng, destCoords?.lat, destCoords?.lng]);

  const startPin = useMemo<ShipmentPin | null>(() => {
    const address = shipment?.origin?.address;
    if (!address?.coordinates) return null;
    return {
      position: {
        latitude: address.coordinates.lat,
        longitude: address.coordinates.lng,
      },
      glyph: 'store',
      label: t('map.pinStart'),
      title: address.label || address.formattedAddress || t('map.pinStart'),
      address: address.formattedAddress,
    };
  }, [shipment, t]);

  const endPin = useMemo<ShipmentPin | null>(() => {
    const address = shipment?.destination;
    if (!address?.coordinates) return null;
    return {
      position: {
        latitude: address.coordinates.lat,
        longitude: address.coordinates.lng,
      },
      glyph: 'person',
      label: t('map.pinEnd'),
      title: address.label || address.formattedAddress || t('map.pinEnd'),
      address: address.formattedAddress,
    };
  }, [shipment, t]);

  // Keep the selected agent's row in view (deep-link or marker click). No-ops
  // while the panel is closed, which is the right answer.
  useEffect(() => {
    if (!selected) return;
    document
      .getElementById(`track-agent-${selected}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selected]);

  const nameFor = (id: string) =>
    agents.find((a) => a.agentId === id)?.name ?? t('agent.fallbackName', { code: id.slice(-6) });

  const focusPresent = !!focusAgentId && agentIds.includes(focusAgentId);

  // The roster narrows; the map keeps every agent so a filtered view never
  // hides someone who is actually moving.
  const query = search.trim().toLowerCase();
  const visibleAgents = agents.filter((a) => {
    const live = !!socket.fixes[a.agentId];
    // "Ended" means the platform confirmed we are no longer entitled to this
    // agent. An inconclusive revocation — our token was rejected, or jovi-mall
    // could not be reached — says nothing about the delivery, so it belongs
    // under "no signal" alongside every other agent we are not hearing from.
    const reason = socket.revoked.get(a.agentId) ?? null;
    const ended = reason !== null && isConclusiveRevoke(reason);
    if (signalFilter === 'live' && !live) return false;
    if (signalFilter === 'ended' && !ended) return false;
    if (signalFilter === 'no_signal' && (live || ended)) return false;
    if (!query) return true;
    return (
      a.name.toLowerCase().includes(query) ||
      a.shipments.some((s) =>
        [s.trackingNumber, s.orderNumber].some((v) => v?.toLowerCase().includes(query)),
      )
    );
  });

  const statusMeta = STATUS_META[socket.status];
  const StatusIcon = statusMeta.icon;
  const isDark = resolvedTheme === 'dark';
  const emptyHint = socket.status === 'open' ? t('empty.waiting') : t('empty.noPositions');
  const selectedFix = selected ? socket.fixes[selected] : undefined;
  const showSidebar = panelOpen && !isBelowDesktop;

  const panel = (
    <TrackingPanel
      agents={visibleAgents}
      search={search}
      onSearchChange={setSearch}
      signalFilter={signalFilter}
      onSignalFilterChange={setSignalFilter}
      fixes={socket.fixes}
      revoked={socket.revoked}
      selectedAgentId={selected}
      selectedShipmentId={selectedShipment}
      isDark={isDark}
      onSelectAgent={selectAgent}
      onSelectShipment={selectShipment}
      className="h-full"
    />
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title={t('page.title')}
        description={t('page.description')}
        shortDescription={t('page.shortDescription')}
        // The live-connection state is a readout, not something you press, so
        // it stays on the bar rather than folding into the overflow — the one
        // thing on this page you want visible without opening anything.
        actions={
          <span
            className={cn('flex items-center gap-1.5 text-sm font-medium', statusMeta.className)}
          >
            <StatusIcon className="h-4 w-4" />
            <span className="max-lg:sr-only">{t(statusMeta.labelKey)}</span>
          </span>
        }
        actionItems={[
          {
            id: 'refresh',
            label: t('common:actions.refresh'),
            icon: RefreshCw,
            onSelect: () => {
              board.refetch();
              socket.reconnect();
            },
          },
          // The side panel only exists from `lg` up, so on anything narrower
          // there is nothing for this to toggle.
          ...(isBelowDesktop
            ? []
            : [
                {
                  id: 'panel',
                  label: panelOpen ? t('panel.hide') : t('panel.show'),
                  icon: panelOpen ? PanelRightClose : PanelRightOpen,
                  onSelect: () => setPanelOpen((v) => !v),
                },
              ]),
        ]}
      />

      {socket.status === 'error' && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex items-center justify-between gap-3 p-3 text-xs text-amber-800">
            <span>{t('connection.errorBanner')}</span>
            <Button variant="outline" size="sm" onClick={socket.reconnect}>
              {t('common:actions.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {board.data?.meta.truncated && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="p-3 text-xs text-amber-800">{t('board.truncated')}</CardContent>
        </Card>
      )}

      {focusAgentId && !focusPresent && !board.isLoading && !board.error && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 text-xs text-muted-foreground">
            <Trans
              ns="tracking"
              i18nKey="focus.notBroadcasting"
              values={{ name: nameFor(focusAgentId) }}
              components={{
                strong: <span className="font-medium text-foreground" />,
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Only the FIRST load may show a skeleton: the 60s poll re-enters
          `isLoading`, and honouring it there would tear the Leaflet map down
          and back up every minute. A failed poll keeps the stale board. */}
      <AsyncBoundary
        isLoading={board.isLoading && !board.data}
        error={board.data ? null : board.error}
        onRetry={board.refetch}
        isEmpty={agents.length === 0}
        emptyState={
          <EmptyState icon={MapPin} title={t('empty.title')} description={t('empty.description')} />
        }
      >
        <div
          className={cn(
            'grid grid-cols-1 gap-3',
            showSidebar && 'lg:grid-cols-[minmax(0,1fr)_21rem]',
          )}
        >
          <div className="flex flex-col gap-2">
            {/* `isolate` is load-bearing: Leaflet's controls sit at z-index 1000
                and this stage's overlays above them, so without a stacking
                context of their own they paint straight through the mobile
                sheet (a portal at z-50). */}
            <div className={cn('relative isolate', STAGE_HEIGHT)}>
              <LiveTrackingMap
                fixes={socket.fixes}
                trails={socket.trails}
                nameFor={nameFor}
                focusAgentId={focusAgentId}
                selectedAgentId={selected}
                onSelectAgent={selectAgent}
                historyPath={trail.data}
                startPin={startPin}
                endPin={endPin}
                routeLine={route.data}
                sceneKey={selected && selectedShipment ? `${selected}:${selectedShipment}` : null}
                isDark={isDark}
                emptyHint={emptyHint}
              />

              {/* The selected delivery rides on the map's bottom edge — over the
                map, directly above the roster trigger below it. */}
              {shipment && selectedAgent && (
                <div className="absolute inset-x-2 bottom-2 z-[1200]">
                  <div className="rounded-lg border bg-background/95 px-2.5 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-[11px] leading-4 text-muted-foreground">
                            {shipment.trackingNumber ??
                              shipment.orderNumber ??
                              shipment.shipmentId.slice(-8)}
                          </span>
                          <ShipmentStatusBadge
                            status={shipment.status}
                            className="px-1.5 py-0 text-[10px]"
                          />
                          <span className="truncate text-[11px] leading-4 text-muted-foreground">
                            {t('board.carriedBy', { name: selectedAgent.name })}
                          </span>
                        </div>

                        {/* Two different places, so a rule between them — run
                          together they read as one wrapped address. */}
                        <div className="flex items-stretch gap-1.5 text-[11px] leading-4">
                          <span className="flex min-w-0 flex-1 items-center gap-1">
                            <PinMark glyph="store" isDark={isDark} height={14} />
                            <span className="min-w-0 flex-1 truncate">
                              {shipment.origin?.address?.label ||
                                shipment.origin?.address?.formattedAddress ||
                                t('shipment.originUnknown')}
                            </span>
                          </span>
                          <span className="w-px shrink-0 bg-border" aria-hidden="true" />
                          <span className="flex min-w-0 flex-1 items-center gap-1">
                            <PinMark glyph="person" isDark={isDark} height={14} />
                            <span className="min-w-0 flex-1 truncate">
                              {shipment.destination?.label ||
                                shipment.destination?.formattedAddress ||
                                t('shipment.destinationUnknown')}
                            </span>
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] leading-4">
                          {typeof selectedFix?.etaSeconds === 'number' ? (
                            <span className="flex items-center gap-1 font-medium text-primary">
                              <Clock className="h-3 w-3" />
                              {t('agent.eta', {
                                minutes: Math.round(selectedFix.etaSeconds / 60),
                              })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {selectedFix ? t('board.etaPending') : t('board.etaNoSignal')}
                            </span>
                          )}
                          {typeof selectedFix?.distanceMeters === 'number' && (
                            <span className="flex items-center gap-1 font-medium text-primary">
                              <Route className="h-3 w-3" />
                              {formatDistance(selectedFix.distanceMeters)}
                            </span>
                          )}
                          {!shipment.mappable && (
                            <span className="text-amber-600 dark:text-amber-500">
                              {t('shipment.notMappable')}
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => setSelectedShipment(null)}
                        title={t('board.clearShipment')}
                        aria-label={t('board.clearShipment')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* The roster trigger sits BELOW the map, in the flow — the page's
                own `pb-24` lands it just above the fixed tab bar, and the map
                keeps every pixel above it. */}
            <Button
              type="button"
              variant="secondary"
              className="w-full shadow-sm lg:hidden"
              onClick={() => setSheetOpen(true)}
            >
              <Users className="h-4 w-4" />
              {t('panel.openMobile', { count: agents.length })}
            </Button>
          </div>

          {showSidebar && (
            <aside className={cn('hidden lg:flex lg:flex-col', STAGE_HEIGHT)}>{panel}</aside>
          )}
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="flex h-[85dvh] flex-col gap-0 rounded-t-2xl p-0">
            <div className="mx-auto mt-2 h-1 w-10 flex-shrink-0 rounded-full bg-muted" />
            <SheetHeader className="flex-shrink-0 px-3 pb-1 pt-2">
              <SheetTitle className="text-sm font-semibold">
                {t('panel.title', { count: agents.length })}
              </SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 px-3 pb-[env(safe-area-inset-bottom)]">{panel}</div>
          </SheetContent>
        </Sheet>
      </AsyncBoundary>
    </div>
  );
}
