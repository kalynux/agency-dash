// The verified seal's geometry, shared by the React `VerifiedBadge` and the
// HTML-string version the Leaflet map needs — one drawing, two renderers.

// Lucide's `badge-check` outline (ISC), filled instead of stroked. The viewBox
// is cropped to the seal so it sits flush against the text it follows.
export const SEAL_VIEWBOX = '1.8 1.8 20.4 20.4';
export const SEAL_PATH =
  'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z';
export const CHECK_PATH = 'm8.6 12 2.3 2.3 4.5-4.6';
/** One fixed blue in both themes — the colour is the badge's meaning, like a brand mark. */
export const SEAL_COLOR = '#1877F2';

/**
 * The seal as an HTML string, for the places that are not React — the Leaflet
 * marker labels and popups on the live map. The caller passes the
 * already-translated label (`txStatic('common:values.verified')`).
 */
export function verifiedBadgeHtml(label: string, sizePx = 14): string {
  const safe = label.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return (
    `<svg viewBox="${SEAL_VIEWBOX}" width="${sizePx}" height="${sizePx}" role="img" aria-label="${safe}"` +
    ` style="display:inline-block;flex-shrink:0;vertical-align:-0.15em">` +
    `<title>${safe}</title>` +
    `<path d="${SEAL_PATH}" fill="${SEAL_COLOR}"/>` +
    `<path d="${CHECK_PATH}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`
  );
}
