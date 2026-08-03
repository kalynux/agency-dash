import { txStatic } from '@/i18n/tx';

/**
 * "just now" / "12s ago" / "3m ago" for a fix timestamp, in the active language.
 *
 * Its own module (and not `lib/format`) because the map's popup HTML is built
 * imperatively outside React — `txStatic` reads the live i18next instance, so
 * this must stay a call, never a module constant. The tracking page renders the
 * same phrasing on its cards and imports it from here too.
 */
export function formatFixAge(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return txStatic('tracking:relative.justNow');
  if (s < 60) return txStatic('tracking:relative.secondsAgo', { value: s });
  return txStatic('tracking:relative.minutesAgo', { value: Math.round(s / 60) });
}

/**
 * Road distance to the drop-off: "820 m" / "2.3 km".
 *
 * geo-tracker sends metres; below a kilometre a decimal reads as false
 * precision on a GPS fix, so it switches unit rather than digits.
 */
export function formatDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
}
