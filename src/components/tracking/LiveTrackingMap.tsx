import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { txStatic } from '@/i18n/tx';
import { formatFixAge } from '@/components/tracking/format';
import { cn } from '@/lib/utils';
import { getTileProvider, type TileProvider } from '@/config/map';
import {
  END_PIN_COLOR,
  START_PIN_COLOR,
  START_PIN_COLOR_DARK,
  escapeHtml,
  pinMarkerHtml,
  type PinGlyph,
} from '@/components/tracking/pin-icons';
import type { AgentLiveFix, GeoPosition } from '@/types/tracking.types';

// A real, interactive Leaflet map for Live Tracking. It renders one marker per
// live agent (heading arrow + pulse + name), that agent's travelled path, the
// selected shipment's start/end pins with the road line between them, popups,
// deep-link focus and fit controls — all driven imperatively so markers glide
// between fixes instead of remounting on every broadcast.

/** One end of the selected shipment. */
export interface ShipmentPin {
  position: GeoPosition;
  glyph: PinGlyph;
  /** Short chip under the pin — "Pickup" / "Drop-off". */
  label: string;
  /** Popup heading — the place's own name. */
  title: string;
  /** Popup body — the full address. */
  address?: string | null;
}

interface LiveTrackingMapProps {
  /** Latest fix per agentId (from useGeoTrackerSocket). */
  fixes: Record<string, AgentLiveFix>;
  /** Recent positions per agentId (oldest→newest) for the live trail polyline. */
  trails: Record<string, GeoPosition[]>;
  nameFor: (id: string) => string;
  /** Deep-link target (?agent=…) — flown to once it has a position. */
  focusAgentId?: string | null;
  /** Currently selected agent (card click) — highlighted + flown to. */
  selectedAgentId?: string | null;
  onSelectAgent?: (id: string) => void;
  /**
   * The selected agent's already-travelled path (geo-tracker's durable
   * checkpoint trail, oldest→newest). Drawn continuous with the live trail.
   */
  historyPath?: GeoPosition[] | null;
  /** Start pin of the selected shipment — where the parcel is collected. */
  startPin?: ShipmentPin | null;
  /** End pin of the selected shipment — the customer. */
  endPin?: ShipmentPin | null;
  /** Road geometry between the two pins. Empty/absent → a dashed straight line. */
  routeLine?: GeoPosition[] | null;
  /**
   * Changes whenever the scene (selected agent / shipment) does, and is what
   * re-frames the view. Passing the same key twice never steals the map back
   * from an operator who has panned away.
   */
  sceneKey?: string | null;
  isDark: boolean;
  /** Message shown centered while no agent has a live position yet. */
  emptyHint?: string;
  className?: string;
}

const AGENT_COLOR = '#2563eb';
const SELECTED_COLOR = '#eaa916';
const ROUTE_COLOR = '#2563eb';
// Reasonable default view (Douala) shown only until the first fit; irrelevant once agents appear.
const DEFAULT_CENTER: L.LatLngExpression = [4.05, 9.7];
const DEFAULT_ZOOM = 6;
const FOCUS_ZOOM = 15;

function markerInnerHtml(name: string, heading?: number): string {
  const hasHeading = typeof heading === 'number';
  const headingStyle = hasHeading ? `transform:rotate(${heading}deg)` : 'display:none';
  return (
    `<span class="agent-marker__pulse"></span>` +
    `<span class="agent-marker__heading" style="${headingStyle}"><span class="agent-marker__arrow"></span></span>` +
    `<span class="agent-marker__dot"></span>` +
    `<span class="agent-marker__label">${escapeHtml(name)}</span>`
  );
}

function buildIcon(name: string, heading?: number): L.DivIcon {
  return L.divIcon({
    className: 'agent-marker-icon',
    html: markerInnerHtml(name, heading),
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -18],
  });
}

/** Update an existing marker's DOM in place, so setLatLng can still animate the move. */
function updateIconEl(marker: L.Marker, name: string, heading?: number): void {
  const el = marker.getElement();
  if (!el) return;
  const headingEl = el.querySelector<HTMLElement>('.agent-marker__heading');
  if (headingEl) {
    if (typeof heading === 'number') {
      headingEl.style.display = '';
      headingEl.style.transform = `rotate(${heading}deg)`;
    } else {
      headingEl.style.display = 'none';
    }
  }
  const labelEl = el.querySelector<HTMLElement>('.agent-marker__label');
  if (labelEl && labelEl.textContent !== name) labelEl.textContent = name;
}

function mapsLink(lat: number, lng: number, label: string): string {
  return (
    `<a class="agent-popup__link" href="https://www.google.com/maps?q=${lat},${lng}" ` +
    `target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  );
}

function popupHtml(name: string, fix: AgentLiveFix): string {
  const { latitude: lat, longitude: lng } = fix.position;
  const meta = [
    typeof fix.speedMps === 'number'
      ? txStatic('tracking:agent.speed', { value: (fix.speedMps * 3.6).toFixed(0) })
      : null,
    typeof fix.headingDegrees === 'number'
      ? txStatic('tracking:agent.heading', { value: fix.headingDegrees.toFixed(0) })
      : null,
    typeof fix.etaSeconds === 'number'
      ? txStatic('tracking:agent.eta', { minutes: Math.round(fix.etaSeconds / 60) })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    `<div class="agent-popup">` +
    `<p class="agent-popup__name">${escapeHtml(name)}</p>` +
    `<p class="agent-popup__coords">${lat.toFixed(5)}, ${lng.toFixed(5)}</p>` +
    (meta ? `<p class="agent-popup__meta">${escapeHtml(meta)}</p>` : '') +
    `<p class="agent-popup__seen">${escapeHtml(txStatic('tracking:agent.updated', { when: formatFixAge(fix.receivedAt) }))}</p>` +
    mapsLink(lat, lng, txStatic('tracking:agent.openInGoogleMaps')) +
    `</div>`
  );
}

function pinPopupHtml(pin: ShipmentPin): string {
  const { latitude: lat, longitude: lng } = pin.position;
  return (
    `<div class="agent-popup">` +
    `<p class="agent-popup__kicker">${escapeHtml(pin.label)}</p>` +
    `<p class="agent-popup__name">${escapeHtml(pin.title)}</p>` +
    (pin.address ? `<p class="agent-popup__meta">${escapeHtml(pin.address)}</p>` : '') +
    `<p class="agent-popup__coords">${lat.toFixed(5)}, ${lng.toFixed(5)}</p>` +
    mapsLink(lat, lng, txStatic('tracking:agent.openInGoogleMaps')) +
    `</div>`
  );
}

function makeTileLayer(provider: TileProvider, isDark: boolean): L.TileLayer {
  const cfg = isDark && provider.dark ? provider.dark : provider.light;
  return L.tileLayer(cfg.url, {
    attribution: cfg.attribution,
    subdomains: cfg.subdomains ?? 'abc',
    maxZoom: cfg.maxZoom ?? 19,
  });
}

const toLatLng = (p: GeoPosition): [number, number] => [p.latitude, p.longitude];

export function LiveTrackingMap({
  fixes,
  trails,
  nameFor,
  focusAgentId,
  selectedAgentId,
  onSelectAgent,
  historyPath,
  startPin,
  endPin,
  routeLine,
  sceneKey,
  isDark,
  emptyHint,
  className,
}: LiveTrackingMapProps) {
  const { t } = useTranslation('tracking');
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const trailLinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const historyLineRef = useRef<L.Polyline | null>(null);
  const pinsRef = useRef<{ start: L.Marker | null; end: L.Marker | null }>({ start: null, end: null });
  /** What each pin is currently drawn as, so an unchanged one is left alone. */
  const pinSigRef = useRef<{ start: string | null; end: string | null }>({ start: null, end: null });
  const routeRef = useRef<{ casing: L.Polyline; line: L.Polyline } | null>(null);
  const remainingRef = useRef<L.Polyline | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const providerRef = useRef<TileProvider>(getTileProvider());

  // View-management flags: interacted = user moved the map; programmatic guards our
  // own fit/fly calls from being mistaken for user interaction.
  const interactedRef = useRef(false);
  const programmaticRef = useRef(false);
  const lastSetKeyRef = useRef<string | null>(null);
  const lastFlownRef = useRef<string | null>(null);
  const lastSceneRef = useRef<string | null>(null);

  // Latest props for imperative handlers, so we never rebind Leaflet listeners.
  const propsRef = useRef({ fixes, nameFor, onSelectAgent });
  useEffect(() => {
    propsRef.current = { fixes, nameFor, onSelectAgent };
  });

  const hasScene = !!(startPin || endPin);

  // ── Init the map once ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const markers = markersRef.current;
    const trailLines = trailLinesRef.current;

    const map = L.map(el, { zoomControl: true, worldCopyJump: true }).setView(
      DEFAULT_CENTER,
      DEFAULT_ZOOM,
    );
    mapRef.current = map;

    map.on('dragstart', () => {
      interactedRef.current = true;
    });
    map.on('zoomstart', () => {
      el.classList.add('agent-map--zooming');
      if (!programmaticRef.current) interactedRef.current = true;
    });
    map.on('zoomend', () => el.classList.remove('agent-map--zooming'));
    map.on('moveend', () => {
      programmaticRef.current = false;
    });

    // Keep the map sized to its container (sidebar collapse, window resize…).
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    roRef.current = ro;
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      roRef.current?.disconnect();
      roRef.current = null;
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      markers.clear();
      trailLines.clear();
      historyLineRef.current = null;
      pinsRef.current = { start: null, end: null };
      pinSigRef.current = { start: null, end: null };
      routeRef.current = null;
      remainingRef.current = null;
      lastSetKeyRef.current = null;
      lastFlownRef.current = null;
      lastSceneRef.current = null;
    };
  }, []);

  // ── Tile layer follows the theme ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!map || !el) return;
    const provider = providerRef.current;
    if (tileRef.current) map.removeLayer(tileRef.current);
    tileRef.current = makeTileLayer(provider, isDark).addTo(map);
    // Fallback: a provider with no dark basemap gets its light tiles CSS-dimmed.
    el.classList.toggle('agent-map--dim', isDark && !provider.dark);
  }, [isDark]);

  // ── Sync agent markers + live trails on every fix/trail change ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const { nameFor: name } = propsRef.current;

    // Remove markers/trails for agents that are no longer present.
    for (const [id, marker] of markersRef.current) {
      if (!(id in fixes)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }
    for (const [id, line] of trailLinesRef.current) {
      if (!(id in trails)) {
        map.removeLayer(line);
        trailLinesRef.current.delete(id);
      }
    }

    const ids = Object.keys(fixes);
    for (const id of ids) {
      const fix = fixes[id];
      const latlng = toLatLng(fix.position);
      const label = name(id);
      const isSelected = id === selectedAgentId;

      let marker = markersRef.current.get(id);
      if (!marker) {
        marker = L.marker(latlng, { icon: buildIcon(label, fix.headingDegrees) });
        marker.on('click', () => propsRef.current.onSelectAgent?.(id));
        marker.bindPopup(popupHtml(label, fix), { className: 'agent-popup-wrap' });
        marker.addTo(map);
        markersRef.current.set(id, marker);
      } else {
        marker.setLatLng(latlng);
        marker.setPopupContent(popupHtml(label, fix));
        updateIconEl(marker, label, fix.headingDegrees);
      }
      // The selected agent sits above the others, and above the shipment pins,
      // because it is the thing that moves.
      marker.setZIndexOffset(isSelected ? 1000 : 0);

      const markerEl = marker.getElement();
      if (markerEl) {
        markerEl.classList.toggle('agent-marker-icon--selected', isSelected);
        // With a shipment in focus, everyone else recedes rather than disappears.
        markerEl.classList.toggle('agent-marker-icon--muted', !!selectedAgentId && !isSelected);
      }

      // Live trail polyline from the positions received since the page opened.
      const latlngs = (trails[id] ?? []).map(toLatLng);
      let line = trailLinesRef.current.get(id);
      if (latlngs.length >= 2) {
        const style = {
          color: isSelected ? SELECTED_COLOR : AGENT_COLOR,
          weight: isSelected ? 4 : 3,
          opacity: isSelected ? 0.9 : selectedAgentId ? 0.25 : 0.5,
        };
        if (!line) {
          line = L.polyline(latlngs, { ...style, interactive: false });
          line.addTo(map);
          trailLinesRef.current.set(id, line);
        } else {
          line.setLatLngs(latlngs);
          line.setStyle(style);
        }
      } else if (line) {
        map.removeLayer(line);
        trailLinesRef.current.delete(id);
      }
    }

    // Auto-fit once on first data, and again when the tracked set changes — unless
    // the operator has taken manual control, or a shipment scene owns the view.
    if (ids.length > 0) {
      const setKey = ids.slice().sort().join(',');
      if (setKey !== lastSetKeyRef.current) {
        const firstTime = lastSetKeyRef.current === null;
        lastSetKeyRef.current = setKey;
        if (!hasScene && (firstTime || !interactedRef.current)) {
          const bounds = L.latLngBounds(ids.map((id) => toLatLng(fixes[id].position)));
          programmaticRef.current = true;
          if (ids.length === 1) {
            map.setView(bounds.getCenter(), Math.max(map.getZoom(), FOCUS_ZOOM));
          } else {
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
          }
        }
      }
    } else {
      lastSetKeyRef.current = null;
    }
  }, [fixes, trails, selectedAgentId, hasScene]);

  // ── The selected agent's already-travelled path ────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const points = (historyPath ?? []).map(toLatLng);
    if (points.length < 2) {
      if (historyLineRef.current) {
        map.removeLayer(historyLineRef.current);
        historyLineRef.current = null;
      }
      return;
    }
    if (!historyLineRef.current) {
      historyLineRef.current = L.polyline(points, {
        color: SELECTED_COLOR,
        weight: 4,
        opacity: 0.75,
        dashArray: '1 7',
        lineCap: 'round',
        interactive: false,
      }).addTo(map);
    } else {
      historyLineRef.current.setLatLngs(points);
    }
  }, [historyPath]);

  // ── Selected shipment: the start and end pins ─────────────────────────────
  // Deliberately NOT keyed on `fixes`: rebuilding a pin's icon replays its drop
  // animation, and a broadcast arrives every few seconds.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncPin = (which: 'start' | 'end', pin: ShipmentPin | null | undefined) => {
      const existing = pinsRef.current[which];
      if (!pin) {
        if (existing) map.removeLayer(existing);
        pinsRef.current[which] = null;
        pinSigRef.current[which] = null;
        return;
      }
      const color =
        pin.glyph === 'store' ? (isDark ? START_PIN_COLOR_DARK : START_PIN_COLOR) : END_PIN_COLOR;
      // The board is re-polled on a timer, so `pin` is a fresh object on an
      // unchanged delivery. Compare what is actually drawn, not identity.
      const signature = [
        pin.glyph,
        pin.label,
        color,
        pin.position.latitude,
        pin.position.longitude,
      ].join('|');
      if (existing && pinSigRef.current[which] === signature) {
        existing.setPopupContent(pinPopupHtml(pin));
        return;
      }
      pinSigRef.current[which] = signature;
      const icon = L.divIcon({
        className: `ship-pin ship-pin--${which}`,
        html: pinMarkerHtml({
          glyph: pin.glyph,
          color,
          outline: isDark ? 'rgba(15,23,42,.55)' : 'rgba(255,255,255,.9)',
          label: pin.label,
        }),
        iconSize: [40, 52],
        iconAnchor: [20, 52],
        popupAnchor: [0, -46],
      });
      const latlng = toLatLng(pin.position);
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(icon);
        existing.setPopupContent(pinPopupHtml(pin));
      } else {
        const marker = L.marker(latlng, { icon, zIndexOffset: 500 })
          .bindPopup(pinPopupHtml(pin), { className: 'agent-popup-wrap' })
          .addTo(map);
        pinsRef.current[which] = marker;
      }
    };

    syncPin('start', startPin);
    syncPin('end', endPin);
  }, [startPin, endPin, isDark]);

  // ── The corridor the parcel travels ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // The provider's road geometry when we have it, a dashed straight line
    // between the pins when we don't.
    const hasRoad = !!routeLine && routeLine.length >= 2;
    const corridor: [number, number][] = hasRoad
      ? routeLine!.map(toLatLng)
      : startPin && endPin
        ? [toLatLng(startPin.position), toLatLng(endPin.position)]
        : [];

    if (corridor.length >= 2) {
      const lineStyle: L.PolylineOptions = {
        color: ROUTE_COLOR,
        weight: 4,
        opacity: 0.85,
        dashArray: hasRoad ? undefined : '8 8',
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      };
      if (!routeRef.current) {
        // A wide, pale casing under the line is what makes a route legible over
        // busy tiles — the same trick every navigation map uses.
        const casing = L.polyline(corridor, {
          color: isDark ? '#0f172a' : '#ffffff',
          weight: 9,
          opacity: 0.55,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }).addTo(map);
        const line = L.polyline(corridor, lineStyle).addTo(map);
        routeRef.current = { casing, line };
      } else {
        routeRef.current.casing.setLatLngs(corridor);
        routeRef.current.casing.setStyle({ color: isDark ? '#0f172a' : '#ffffff' });
        routeRef.current.line.setLatLngs(corridor);
        routeRef.current.line.setStyle(lineStyle);
      }
    } else if (routeRef.current) {
      map.removeLayer(routeRef.current.casing);
      map.removeLayer(routeRef.current.line);
      routeRef.current = null;
    }
  }, [startPin, endPin, routeLine, isDark]);

  // ── The remaining leg — agent → drop-off ──────────────────────────────────
  // This one *does* follow every fix: it is the bit that moves.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // "How far is the agent from the drop-off" — a straight tie between the two,
    // deliberately dashed so it never reads as a road.
    const agentFix = selectedAgentId ? fixes[selectedAgentId] : undefined;
    if (agentFix && endPin) {
      const leg: [number, number][] = [toLatLng(agentFix.position), toLatLng(endPin.position)];
      if (!remainingRef.current) {
        remainingRef.current = L.polyline(leg, {
          color: SELECTED_COLOR,
          weight: 2.5,
          opacity: 0.9,
          dashArray: '2 8',
          lineCap: 'round',
          interactive: false,
        }).addTo(map);
      } else {
        remainingRef.current.setLatLngs(leg);
      }
    } else if (remainingRef.current) {
      map.removeLayer(remainingRef.current);
      remainingRef.current = null;
    }
  }, [endPin, selectedAgentId, fixes]);

  /** Everything the current selection wants on screen at once. */
  const sceneBounds = useCallback((): L.LatLngBounds | null => {
    const points: [number, number][] = [];
    if (startPin) points.push(toLatLng(startPin.position));
    if (endPin) points.push(toLatLng(endPin.position));
    const fix = selectedAgentId ? propsRef.current.fixes[selectedAgentId] : undefined;
    if (fix) points.push(toLatLng(fix.position));
    return points.length ? L.latLngBounds(points) : null;
  }, [startPin, endPin, selectedAgentId]);

  const frameScene = useCallback(() => {
    const map = mapRef.current;
    const bounds = sceneBounds();
    if (!map || !bounds) return false;
    interactedRef.current = false;
    programmaticRef.current = true;
    if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
      map.setView(bounds.getCenter(), Math.max(map.getZoom(), FOCUS_ZOOM));
    } else {
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16 });
    }
    return true;
  }, [sceneBounds]);

  // ── Re-frame when the selection changes ───────────────────────────────────
  useEffect(() => {
    const key = sceneKey ?? null;
    if (key === lastSceneRef.current) return;
    if (!hasScene) {
      lastSceneRef.current = key;
      return;
    }
    // Wait for the pins to have been laid down by the effect above.
    if (frameScene()) lastSceneRef.current = key;
  }, [sceneKey, hasScene, frameScene]);

  // ── Fly to the focused / selected agent once it has a position ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // A framed shipment scene already contains the agent; don't fight it.
    if (hasScene) return;
    const target = selectedAgentId ?? focusAgentId ?? null;
    if (!target) {
      lastFlownRef.current = null;
      return;
    }
    if (lastFlownRef.current === target) return;
    const fix = fixes[target];
    if (!fix) return; // wait until the agent starts broadcasting
    lastFlownRef.current = target;
    programmaticRef.current = true;
    map.flyTo(toLatLng(fix.position), Math.max(map.getZoom(), FOCUS_ZOOM), { duration: 0.8 });
    markersRef.current.get(target)?.openPopup();
  }, [selectedAgentId, focusAgentId, fixes, hasScene]);

  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = propsRef.current.fixes;
    const ids = Object.keys(current);
    if (ids.length === 0) return;
    interactedRef.current = false;
    const bounds = L.latLngBounds(ids.map((id) => toLatLng(current[id].position)));
    programmaticRef.current = true;
    if (ids.length === 1) {
      map.setView(bounds.getCenter(), Math.max(map.getZoom(), FOCUS_ZOOM));
    } else {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    }
  }, []);

  const showEmpty = useMemo(
    () => Object.keys(fixes).length === 0 && !startPin && !endPin,
    [fixes, startPin, endPin],
  );

  // `isolate` on the wrapper confines Leaflet's z-index scale (its panes sit at
  // 400–700, our own overlay controls below at 1100–1200) to this box. Without
  // it those numbers compete in the root stacking context and win against every
  // piece of app chrome — the status-bar scrim, dialogs, the tab bar — all of
  // which sit at 50 or below by design.
  return (
    <div className={cn('agent-map relative isolate h-full w-full overflow-hidden rounded-lg border', className)}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute end-3 top-3 z-[1200] flex flex-col gap-2">
        {hasScene && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="pointer-events-auto shadow-md"
            onClick={frameScene}
            title={t('map.fitScene')}
            aria-label={t('map.fitScene')}
          >
            <Crosshair className="h-4 w-4" />
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="pointer-events-auto shadow-md"
          onClick={fitAll}
          title={t('map.fitAll')}
          aria-label={t('map.fitAll')}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {showEmpty && (
        <div className="pointer-events-none absolute inset-0 z-[1100] flex items-center justify-center">
          <span className="rounded-full border bg-background/85 px-4 py-2 text-sm text-muted-foreground shadow-sm">
            {emptyHint ?? t('empty.noPositions')}
          </span>
        </div>
      )}
    </div>
  );
}
