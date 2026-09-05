import { Bike, Car, Truck, Footprints, type LucideIcon } from 'lucide-react';

import { txStatic } from '@/i18n/tx';

// The backend sends `vehicleInfo.vehicle_type` as a free-form string, not a fixed enum,
// so this maps a handful of known tokens and falls back to a generic icon/label for the rest.

const VEHICLE_ICON_MAP: Record<string, LucideIcon> = {
  motorbike: Bike,
  bike: Bike,
  motorcycle: Bike,
  bicycle: Bike,
  car: Car,
  van: Truck,
  truck: Truck,
  on_foot: Footprints,
  foot: Footprints,
};

export function getVehicleIcon(vehicleType: string | undefined | null): LucideIcon {
  if (!vehicleType) return Truck;
  return VEHICLE_ICON_MAP[vehicleType.toLowerCase()] ?? Truck;
}

/**
 * A readable vehicle name. The known tokens are translated
 * (`agents:vehicle.<token>`); anything else the backend invents is
 * title-cased as-is, because there is no copy for a value we've never seen.
 *
 * Uses `txStatic` rather than a hook so the plain-function call sites keep
 * working — every one of them renders inside a component that already
 * subscribes to the language via `useTranslation`.
 */
export function formatVehicleType(vehicleType: string | undefined | null): string {
  if (!vehicleType) return txStatic('agents:vehicle.unknown');

  const token = vehicleType.toLowerCase();
  const key = `agents:vehicle.${token}`;
  const translated = txStatic(key);
  if (translated !== key) return translated;

  return vehicleType
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Colour ───────────────────────────────────────────────────────────────────
// `vehicleInfo.color` is a lowercase English token, but free text is accepted at
// the agent's end — so this is the same shape as `formatVehicleType`: translate
// what we know, title-case what we don't.

/**
 * A CSS colour for the swatch, for tokens we recognise.
 *
 * Deliberately NOT a guess for anything else. Mapping an unknown token to a
 * plausible hex would print a confident colour nobody verified, on a field an
 * agency uses to pick a vehicle out of a car park — a neutral swatch that says
 * "we were told something we can't draw" is the honest rendering.
 */
const VEHICLE_COLOR_MAP: Record<string, string> = {
  black: '#111827',
  white: '#f9fafb',
  grey: '#9ca3af',
  gray: '#9ca3af',
  silver: '#d1d5db',
  red: '#dc2626',
  dark_red: '#991b1b',
  blue: '#2563eb',
  dark_blue: '#1e3a8a',
  light_blue: '#60a5fa',
  green: '#16a34a',
  dark_green: '#166534',
  yellow: '#eab308',
  orange: '#ea580c',
  brown: '#78350f',
  beige: '#e7d9c3',
  gold: '#ca8a04',
  purple: '#7c3aed',
  pink: '#ec4899',
};

/** The swatch colour, or `null` when the token is not one we can draw. */
export function vehicleColorSwatch(color: string | undefined | null): string | null {
  if (!color) return null;
  return VEHICLE_COLOR_MAP[color.toLowerCase().replace(/[\s-]+/g, '_')] ?? null;
}

/** A readable colour name — `agents:vehicle.colors.<token>`, else title-cased. */
export function formatVehicleColor(color: string | undefined | null): string {
  if (!color) return txStatic('agents:vehicle.unknown');

  const token = color.toLowerCase().replace(/[\s-]+/g, '_');
  const key = `agents:vehicle.colors.${token}`;
  const translated = txStatic(key);
  if (translated !== key) return translated;

  return color
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
