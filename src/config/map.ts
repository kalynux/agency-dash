// Swappable basemap tile provider for the Live Tracking map.
//
// Default is CARTO — free, no API key, with native light (Voyager) and dark
// (Dark Matter) styles. To switch providers app-wide later, either point
// `DEFAULT_PROVIDER` at another `TileProvider` below, or (without a code change)
// set `VITE_MAP_TILE_URL` — see env/README.md. That env override is the single
// seam so ops can retarget the basemap per-deploy.

export interface TileLayerConfig {
  /** Leaflet URL template ({s}/{z}/{x}/{y}, optional {r} for retina @2x). */
  url: string;
  attribution: string;
  /** Subdomains for `{s}` in the template, when the provider uses them. */
  subdomains?: string;
  maxZoom?: number;
}

export interface TileProvider {
  light: TileLayerConfig;
  /** Dedicated dark basemap. When absent, the map dims the light tiles via CSS. */
  dark?: TileLayerConfig;
}

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`;

/** CARTO Voyager (light) + Dark Matter (dark) — keyless, retina-aware via `{r}`. */
export const CARTO: TileProvider = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTRIBUTION,
    subdomains: 'abcd',
    maxZoom: 20,
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTRIBUTION,
    subdomains: 'abcd',
    maxZoom: 20,
  },
};

/** Plain OpenStreetMap — documented alternative (light only; dark is CSS-dimmed). */
export const OSM: TileProvider = {
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTRIBUTION,
    subdomains: 'abc',
    maxZoom: 19,
  },
};

/** The provider used when no env override is set. Swap this to change providers app-wide. */
const DEFAULT_PROVIDER: TileProvider = CARTO;

/**
 * Resolve the active tile provider. An env override (`VITE_MAP_TILE_URL`) wins so
 * a provider can be changed per-deploy without touching code; otherwise the
 * `DEFAULT_PROVIDER` (CARTO) is used.
 */
export function getTileProvider(): TileProvider {
  const url = (import.meta.env.VITE_MAP_TILE_URL as string | undefined)?.trim();
  if (url) {
    const attribution =
      (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined)?.trim() || OSM_ATTRIBUTION;
    const darkUrl = (import.meta.env.VITE_MAP_TILE_URL_DARK as string | undefined)?.trim();
    return {
      light: { url, attribution },
      dark: darkUrl ? { url: darkUrl, attribution } : undefined,
    };
  }
  return DEFAULT_PROVIDER;
}
