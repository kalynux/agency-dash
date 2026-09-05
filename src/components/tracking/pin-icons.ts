// The two shipment pins, as inline SVG.
//
// Both follow the same anatomy as the supplied artwork — a teardrop with a white
// disc punched out of it, and a glyph inside the disc:
//
//   START (origin / pickup)   dark pin  + storefront glyph — where the parcel is collected
//   END   (destination)       green pin + person glyph     — the customer it is going to
//
// They are SVG rather than bitmaps so they stay crisp at every zoom, carry no
// network request, and can take a contrast outline in dark mode — a near-black
// pin on a dark basemap is otherwise a hole in the map.

export type PinGlyph = 'store' | 'person';

export const START_PIN_COLOR = '#111827';
/** Lighter body for the dark basemap; the glyph disc stays white either way. */
export const START_PIN_COLOR_DARK = '#e2e8f0';
export const END_PIN_COLOR = '#5faa3c';

/**
 * Teardrop of a 40×52 pin: a circle of r=19.2 around (20, 20) drawn down to a
 * point at (20, 51.2), so a Leaflet icon anchors exactly on the tip.
 */
const PIN_BODY =
  'M20 .8A19.2 19.2 0 0 0 .8 20c0 10 9.2 20 19.2 31.2C30 40 39.2 30 39.2 20A19.2 19.2 0 0 0 20 .8Z';

/**
 * Storefront: a striped awning over a scalloped valance, a shop front with two
 * windows and a doorway. Drawn in a 24×24 box; the windows and door are real
 * holes (`evenodd`), so the white disc shows through rather than being painted
 * over — the glyph then works on any pin colour.
 */
const STORE_GLYPH = [
  // Awning — five stripes splaying outward as they descend (top 4→20, bottom 1→23).
  '<path d="M4 2H6.75L4.8 7.5H1Z' +
    'M7.2 2H9.95L9.2 7.5H5.4Z' +
    'M10.4 2H13.15L13.6 7.5H9.8Z' +
    'M13.6 2H16.35L18 7.5H14.2Z' +
    'M16.8 2H19.55L22.4 7.5H18.6Z"/>',
  // Scalloped valance hanging off the awning: five half-discs, 1 → 23.
  '<path d="M1 7.5a2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0Z"/>',
  // Shop front with the two windows and the doorway cut out of it.
  '<path fill-rule="evenodd" d="M3 8.9H21V22H3Z' +
    'M5.6 11.3H9.7V15.3H5.6Z' +
    'M14.3 11.3H18.4V15.3H14.3Z' +
    'M10.6 12.7H13.4V22H10.6Z"/>',
  // Door knob.
  '<ellipse cx="12.55" cy="17.4" rx=".5" ry="1"/>',
].join('');

/** Person: head and shoulders, drawn in the same 24×24 box. */
const PERSON_GLYPH =
  '<circle cx="12" cy="8.4" r="4.1"/>' +
  '<path d="M12 13.4c-4.5 0-8.1 3.2-8.1 7.1 0 .3.2.5.5.5h15.2c.3 0 .5-.2.5-.5 0-3.9-3.6-7.1-8.1-7.1Z"/>';

const GLYPHS: Record<PinGlyph, string> = { store: STORE_GLYPH, person: PERSON_GLYPH };

export interface PinOptions {
  glyph: PinGlyph;
  /** Body colour of the teardrop. */
  color: string;
  /** Contrast ring around the body — keeps a dark pin readable on a dark basemap. */
  outline?: string;
  /** Rendered height in px (width follows the 40:52 ratio). Defaults to the map size. */
  height?: number;
}

/**
 * The pin as standalone SVG markup, 40×52 by default with its point at the
 * bottom centre — so a Leaflet icon anchors at `[20, 52]`.
 */
export function pinSvg({ glyph, color, outline, height = 52 }: PinOptions): string {
  const width = Math.round((height * 40) / 52);
  return (
    `<svg class="ship-pin__svg" viewBox="0 0 40 52" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">` +
    `<path d="${PIN_BODY}" fill="${color}"${outline ? ` stroke="${outline}" stroke-width="1.6"` : ''}/>` +
    `<circle cx="20" cy="20" r="13.4" fill="#ffffff"/>` +
    // 24×24 glyph scaled to 20.4 and centred on the disc at (20, 20). At this
    // scale the glyph's furthest corner sits 12.6 from the centre — inside the
    // 13.4 disc, so nothing crosses the white edge.
    `<g transform="translate(9.8 9.8) scale(.85)" fill="${color}">${GLYPHS[glyph]}</g>` +
    `</svg>`
  );
}

/**
 * Full marker markup: the pin, a ground shadow that sells its height, and a
 * caption chip. Consumed by Leaflet's `divIcon`, anchored on the tip.
 */
export function pinMarkerHtml(options: PinOptions & { label: string; caption?: string }): string {
  const { label, caption, ...pin } = options;
  return (
    `<span class="ship-pin__shadow"></span>` +
    `<span class="ship-pin__body">${pinSvg(pin)}</span>` +
    `<span class="ship-pin__label">${escapeHtml(label)}` +
    (caption ? `<span class="ship-pin__caption">${escapeHtml(caption)}</span>` : '') +
    `</span>`
  );
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
