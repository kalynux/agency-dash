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
