import { useTranslation } from 'react-i18next';
import { ChevronDown, Clock, Gauge, Phone, Route, User } from 'lucide-react';
import { SHIPMENT_STATUS_STYLE } from '@/components/shipments/shipment-status';
import { VehicleIcon } from '@/components/agents/VehicleIcon';
import { formatVehicleType } from '@/components/agents/vehicle.constants';
import { PinMark } from '@/components/tracking/PinMark';
import { formatDistance, formatFixAge } from '@/components/tracking/format';
import { cn } from '@/lib/utils';
import type {
  AgentLiveFix,
  TrackingBoardAgent,
  TrackingBoardShipment,
} from '@/types/tracking.types';

/**
 * One agent on the board, as a **collapsed row** until selected.
 *
 * Density is the whole design here: an agent can be carrying fifteen deliveries,
 * and a card that renders all of them at all times turns a roster of four agents
 * into a page of scrolling. So the closed row is the agent's identity card —
 * name, vehicle, phone, signal — and the deliveries plus live telemetry appear
 * only for the selected one.
 */

interface TrackedAgentCardProps {
  agent: TrackingBoardAgent;
  /** Live fix from the socket, if the agent is broadcasting. */
  fix?: AgentLiveFix;
  /** The socket revoked this agent — the shipment finished or released them. */
  isRevoked: boolean;
  isSelected: boolean;
  selectedShipmentId: string | null;
  isDark: boolean;
  onSelectAgent: () => void;
  /** Passing the already-selected shipment id clears the selection. */
  onSelectShipment: (shipmentId: string) => void;
}

function ShipmentRow({
  shipment,
  isActive,
  isDark,
  onSelect,
  eta,
}: {
  shipment: TrackingBoardShipment;
  isActive: boolean;
  isDark: boolean;
  onSelect: () => void;
  eta?: { seconds?: number; metres?: number };
}) {
  const { t } = useTranslation(['tracking', 'shipments']);
  const origin = shipment.origin?.address ?? null;
  const destination = shipment.destination;
  const originText = origin?.label || origin?.formattedAddress || t('shipment.originUnknown');
  const destText =
    destination?.label || destination?.formattedAddress || t('shipment.destinationUnknown');
  const style = SHIPMENT_STATUS_STYLE[shipment.status];
  const extraPickups = Math.max(0, (shipment.origin?.count ?? 1) - 1);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      aria-pressed={isActive}
      title={`${originText} → ${destText}`}
      className={cn(
        'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-start transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-accent/40',
      )}
    >
      {/* The status is a dot plus a coloured label, not a badge: on a fifteen-row
          list the badge's tint and border are all chrome. Both colours are the
          badge's own, from the shared status map. */}
      {/* <span
        className={cn('mt-[5px] h-2 w-2 shrink-0 rounded-full', style.dot)}
        aria-hidden="true"
      /> */}

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-mono text-[11px] leading-4">
            {shipment.trackingNumber ?? shipment.orderNumber ?? shipment.shipmentId.slice(-8)}
          </span>
          <span className={cn('shrink-0 text-[10px] font-medium leading-4', style.text)}>
            {t(`shipments:status.${shipment.status}` as 'shipments:status.pending')}
          </span>
        </span>

        {/* Pickup and drop-off are two different places, so they get a rule
            between them — run together they read as one wrapped address. */}
        <span className="mt-1 flex items-stretch gap-1.5 text-[11px] leading-4 text-muted-foreground">
          <span className="flex min-w-0 flex-1 items-center gap-1">
            <PinMark glyph="store" isDark={isDark} height={13} />
            <span className="min-w-0 flex-1 truncate">{originText}</span>
            {/* The start pin is only the FIRST collection point when there are
                several — without this the map silently under-reports the route. */}
            {extraPickups > 0 && (
              <span
                className="shrink-0 rounded bg-muted px-1 text-[9px] font-semibold leading-4"
                title={t('shipment.morePickups', { count: extraPickups })}
              >
                +{extraPickups}
              </span>
            )}
          </span>
          <span className="w-px shrink-0 bg-border" aria-hidden="true" />
          <span className="flex min-w-0 flex-1 items-center gap-1">
            <PinMark glyph="person" isDark={isDark} height={13} />
            <span className="min-w-0 flex-1 truncate">{destText}</span>
          </span>
        </span>

        {isActive && (typeof eta?.seconds === 'number' || typeof eta?.metres === 'number') && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] font-medium leading-4 text-primary">
            {typeof eta.seconds === 'number' && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t('agent.eta', { minutes: Math.round(eta.seconds / 60) })}
              </span>
            )}
            {typeof eta.metres === 'number' && (
              <span className="flex items-center gap-1">
                <Route className="h-3 w-3" />
                {formatDistance(eta.metres)}
              </span>
            )}
          </span>
        )}

        {!shipment.mappable && (
          <span className="mt-0.5 block text-[10px] leading-4 text-amber-600 dark:text-amber-500">
            {t('shipment.notMappable')}
          </span>
        )}
      </span>
    </button>
  );
}

export function TrackedAgentCard({
  agent,
  fix,
  isRevoked,
  isSelected,
  selectedShipmentId,
  isDark,
  onSelectAgent,
  onSelectShipment,
}: TrackedAgentCardProps) {
  const { t } = useTranslation('tracking');
  const count = agent.shipments.length;
  const signalLabel = fix ? t('agent.live') : isRevoked ? t('agent.ended') : t('agent.noSignal');

  return (
    <div
      id={`track-agent-${agent.agentId}`}
      className={cn(
        'overflow-hidden rounded-lg border bg-card transition-colors',
        isRevoked && 'opacity-60',
        isSelected ? 'border-primary/60 shadow-sm' : 'hover:border-border',
      )}
    >
      {/* The header is a click target that CONTAINS a `tel:` link, and an anchor
          inside a button is invalid. So the button is an overlay above the
          content, and only the phone link lifts itself back over it. */}
      <div className="group relative">
        <div
          className={cn(
            'flex items-start gap-2 px-2 py-1.5 transition-colors',
            isSelected ? 'bg-primary/5' : 'group-hover:bg-accent/30',
          )}
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
            {agent.avatar?.url ? (
              <img
                src={agent.avatar.url}
                crossOrigin="anonymous"
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium leading-4">{agent.name}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-4 text-muted-foreground">
              <span className="flex items-center gap-1">
                <VehicleIcon vehicleType={agent.vehicleType} className="h-3 w-3" />
                {agent.vehicleType ? formatVehicleType(agent.vehicleType) : t('agent.noVehicle')}
              </span>
              {agent.phone && (
                <a
                  href={`tel:${agent.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="relative z-20 flex items-center gap-1 hover:text-foreground hover:underline"
                >
                  <Phone className="h-3 w-3" />
                  {agent.phone}
                </a>
              )}
            </span>
          </span>

          <span className="flex items-center gap-1.5 self-center">
            {/* Signal as a dot with an accessible name — the word "Live" on
                every row costs more width than it earns. */}
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                fix
                  ? 'animate-pulse bg-green-500'
                  : isRevoked
                    ? 'bg-muted-foreground/50'
                    : 'bg-amber-400',
              )}
              title={signalLabel}
              aria-label={signalLabel}
              role="img"
            />
            {count > 0 && (
              <span
                className="shrink-0 rounded bg-muted px-1.5 text-[10px] font-semibold leading-[18px] text-muted-foreground tabular-nums"
                title={t('shipment.heading', { count })}
              >
                {count}
              </span>
            )}
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                isSelected && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </span>
        </div>

        <button
          type="button"
          onClick={onSelectAgent}
          aria-expanded={isSelected}
          aria-label={agent.name}
          className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        />
      </div>

      {isSelected && (
        <div className="border-t px-2 py-1.5">
          {/* Telemetry only for the agent being watched — one line, no grid. */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 px-0.5 pb-1.5 text-[11px] leading-4 text-muted-foreground">
            {typeof fix?.speedMps === 'number' && (
              <span className="flex items-center gap-1">
                <Gauge className="h-3 w-3" />
                {t('agent.speed', { value: (fix.speedMps * 3.6).toFixed(0) })}
              </span>
            )}
            <span>
              {fix
                ? t('agent.updated', { when: formatFixAge(fix.receivedAt) })
                : isRevoked
                  ? t('agent.trackingEnded')
                  : t('agent.awaitingPosition')}
            </span>
          </div>

          {count > 0 ? (
            <div className="space-y-0.5">
              {agent.shipments.map((shipment) => (
                  <ShipmentRow
                    key={shipment.shipmentId}
                    shipment={shipment}
                    isActive={shipment.shipmentId === selectedShipmentId}
                    isDark={isDark}
                    onSelect={() => onSelectShipment(shipment.shipmentId)}
                    eta={{
                      seconds: fix?.etaSeconds,
                      metres: fix?.distanceMeters,
                    }}
                  />
              ))}
            </div>
          ) : (
            <p className="px-0.5 pb-0.5 text-[11px] text-muted-foreground">{t('shipment.none')}</p>
          )}
        </div>
      )}
    </div>
  );
}
