import { useCallback, useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getTileProvider, type TileProvider } from '@/config/map';
import type { AgentLiveFix, GeoPosition } from '@/types/tracking.types';

// A real, interactive Leaflet map for Live Tracking. It renders one marker per
// live agent (heading arrow + pulse + name), a recent-movement trail per agent,
// popups, deep-link focus, and a "fit all" control — all driven imperatively so
// markers glide between fixes instead of remounting on every broadcast.

interface LiveTrackingMapProps {
  /** Latest fix per agentId (from useGeoTrackerSocket). */
  fixes: Record<string, AgentLiveFix>;
  /** Recent positions per agentId (oldest→newest) for the trail polyline. */
  trails: Record<string, GeoPosition[]>;
  nameFor: (id: string) => string;
  /** Deep-link target (?agent=…) — flown to once it has a position. */
  focusAgentId?: string | null;
  /** Currently selected agent (card click) — highlighted + flown to. */
  selectedAgentId?: string | null;
  onSelectAgent?: (id: string) => void;
  isDark: boolean;
  /** Message shown centered while no agent has a live position yet. */
  emptyHint?: string;
  className?: string;
}

const AGENT_COLOR = '#2563eb';
// Reasonable default view (Douala) shown only until the first fit; irrelevant once agents appear.
const DEFAULT_CENTER: L.LatLngExpression = [4.05, 9.7];
const DEFAULT_ZOOM = 6;
const FOCUS_ZOOM = 15;

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

function secondsAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

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

function popupHtml(name: string, fix: AgentLiveFix): string {
  const { latitude: lat, longitude: lng } = fix.position;
  const meta = [
    typeof fix.speedMps === 'number' ? `${(fix.speedMps * 3.6).toFixed(0)} km/h` : null,
    typeof fix.headingDegrees === 'number' ? `${fix.headingDegrees.toFixed(0)}°` : null,
    typeof fix.etaSeconds === 'number' ? `ETA ${Math.round(fix.etaSeconds / 60)} min` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    `<div class="agent-popup">` +
    `<p class="agent-popup__name">${escapeHtml(name)}</p>` +
    `<p class="agent-popup__coords">${lat.toFixed(5)}, ${lng.toFixed(5)}</p>` +
    (meta ? `<p class="agent-popup__meta">${meta}</p>` : '') +
    `<p class="agent-popup__seen">Updated ${escapeHtml(secondsAgo(fix.receivedAt))}</p>` +
    `<a class="agent-popup__link" href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a>` +
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

export function LiveTrackingMap({
  fixes,
  trails,
  nameFor,
  focusAgentId,
  selectedAgentId,
  onSelectAgent,
  isDark,
  emptyHint,
  className,
}: LiveTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const trailLinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const roRef = useRef<ResizeObserver | null>(null);
  const providerRef = useRef<TileProvider>(getTileProvider());

  // View-management flags: interacted = user moved the map; programmatic guards our
  // own fit/fly calls from being mistaken for user interaction.
  const interactedRef = useRef(false);
  const programmaticRef = useRef(false);
  const lastSetKeyRef = useRef<string | null>(null);
  const lastFlownRef = useRef<string | null>(null);

  // Latest props for imperative handlers, so we never rebind Leaflet listeners.
  const propsRef = useRef({ fixes, nameFor, onSelectAgent });
  useEffect(() => {
    propsRef.current = { fixes, nameFor, onSelectAgent };
  });

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
      lastSetKeyRef.current = null;
      lastFlownRef.current = null;
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

  // ── Sync markers + trails on every fix/trail change ────────────────────────
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
      const latlng: L.LatLngExpression = [fix.position.latitude, fix.position.longitude];
      const label = name(id);

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

      const markerEl = marker.getElement();
      if (markerEl) markerEl.classList.toggle('agent-marker-icon--selected', id === selectedAgentId);

      // Trail polyline from the recent-position history.
      const latlngs = (trails[id] ?? []).map(
        (p) => [p.latitude, p.longitude] as [number, number],
      );
      let line = trailLinesRef.current.get(id);
      if (latlngs.length >= 2) {
        if (!line) {
          line = L.polyline(latlngs, {
            color: AGENT_COLOR,
            weight: 3,
            opacity: 0.5,
            interactive: false,
          });
          line.addTo(map);
          trailLinesRef.current.set(id, line);
        } else {
          line.setLatLngs(latlngs);
        }
      } else if (line) {
        map.removeLayer(line);
        trailLinesRef.current.delete(id);
      }
    }

    // Auto-fit once on first data, and again when the tracked set changes — unless
    // the operator has taken manual control of the view.
    if (ids.length > 0) {
      const setKey = ids.slice().sort().join(',');
      if (setKey !== lastSetKeyRef.current) {
        const firstTime = lastSetKeyRef.current === null;
        lastSetKeyRef.current = setKey;
        if (firstTime || !interactedRef.current) {
          const bounds = L.latLngBounds(
            ids.map((id) => [fixes[id].position.latitude, fixes[id].position.longitude]),
          );
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
  }, [fixes, trails, selectedAgentId]);

  // ── Fly to the focused / selected agent once it has a position ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
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
    map.flyTo([fix.position.latitude, fix.position.longitude], Math.max(map.getZoom(), FOCUS_ZOOM), {
      duration: 0.8,
    });
    markersRef.current.get(target)?.openPopup();
  }, [selectedAgentId, focusAgentId, fixes]);

  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = propsRef.current.fixes;
    const ids = Object.keys(current);
    if (ids.length === 0) return;
    interactedRef.current = false;
    const bounds = L.latLngBounds(
      ids.map((id) => [current[id].position.latitude, current[id].position.longitude]),
    );
    programmaticRef.current = true;
    if (ids.length === 1) {
      map.setView(bounds.getCenter(), Math.max(map.getZoom(), FOCUS_ZOOM));
    } else {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    }
  }, []);

  const showEmpty = Object.keys(fixes).length === 0;

  return (
    <div className={cn('agent-map relative h-full w-full overflow-hidden rounded-lg border', className)}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute right-3 top-3 z-[1200] flex flex-col gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="pointer-events-auto shadow-md"
          onClick={fitAll}
          title="Fit all agents"
          aria-label="Fit all agents"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {showEmpty && (
        <div className="pointer-events-none absolute inset-0 z-[1100] flex items-center justify-center">
          <span className="rounded-full border bg-background/85 px-4 py-2 text-sm text-muted-foreground shadow-sm">
            {emptyHint ?? 'No live positions yet.'}
          </span>
        </div>
      )}
    </div>
  );
}
