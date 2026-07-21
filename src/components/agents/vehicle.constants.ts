import { Bike, Car, Truck, Footprints, type LucideIcon } from 'lucide-react';

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

export function formatVehicleType(vehicleType: string | undefined | null): string {
  if (!vehicleType) return 'Unknown';
  return vehicleType
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
