// Swappable basemap tile provider for the Live Tracking map.
//
// Default is OpenStreetMap — the last raster basemap that is genuinely keyless.
//
// CARTO used to be the default and no longer can be. Since CARTO put its
// basemaps behind an API key, `basemaps.cartocdn.com` still answers `200` with a
// real, correctly-rendered tile — with "API KEY REQUIRED" stamped diagonally
// across it. Nothing in the app could have caught that: a watermark is a
// successful image, not an error, so there is no failed request, no console
// warning and no fallback to trigger. It simply appears on the map.
//
// To go back to a keyed provider (CARTO with a key, MapTiler, Stadia, …), set
// `VITE_MAP_TILE_URL` — see env/README.md. That env override is the single seam,
// so ops can retarget the basemap per-deploy without a code change.

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

/**
 * Plain OpenStreetMap — light only; dark mode CSS-dims these tiles (see
 * `.agent-map--dim` in index.css). No `{s}`: OSM serves every tile from one
 * HTTP/2 host now and the a/b/c subdomains are deprecated.
 *
 * OSM's tile policy is for modest, non-commercial use. It is the right *default*
 * — it always renders, unwatermarked, with no account — and the wrong thing to
 * leave pointed at a production dashboard under real traffic. That deploy sets
 * `VITE_MAP_TILE_URL`.
 */
export const OSM: TileProvider = {
  light: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  },
};

/**
 * CARTO Voyager (light) + Dark Matter (dark) — the nicest of the raster
 * basemaps, and the one this map was designed against. It is NOT keyless: pass
 * the key from CARTO's dashboard, or every tile arrives watermarked.
 *
 * Exported as a function rather than a constant precisely so it cannot be used
 * without one. Nothing wires it today; it is here so the URL shape and the
 * retina/zoom settings survive for whoever provisions the key. The query form
 * below is CARTO's documented one — if your dashboard issues a different one,
 * use `VITE_MAP_TILE_URL` instead of editing this.
 */
export function cartoWithKey(apiKey: string): TileProvider {
  const tiles = (style: string) =>
    `https://{s}.basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}{r}.png` +
    `?api_key=${encodeURIComponent(apiKey)}`;
  return {
    light: {
      url: tiles('voyager'),
      attribution: CARTO_ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 20,
    },
    dark: {
      url: tiles('dark_all'),
      attribution: CARTO_ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 20,
    },
  };
}

/** The provider used when no env override is set. Swap this to change providers app-wide. */
const DEFAULT_PROVIDER: TileProvider = OSM;

/**
 * Resolve the active tile provider. An env override (`VITE_MAP_TILE_URL`) wins so
 * a provider can be changed per-deploy without touching code; otherwise the
 * `DEFAULT_PROVIDER` (OSM) is used.
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
