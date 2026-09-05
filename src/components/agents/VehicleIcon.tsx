import { createElement } from 'react';
import { getVehicleIcon } from '@/components/agents/vehicle.constants';

/**
 * The icon for an agent's vehicle, as a component.
 *
 * `getVehicleIcon` returns a component, so binding its result to a capitalized
 * local and rendering it reads to the linter as declaring a component during
 * render. The lookup is a module-level map so the reference is stable, and
 * `createElement` renders it without introducing that declaration; this leaf
 * also keeps the lookup out of every caller's render body.
 */
export function VehicleIcon({
  vehicleType,
  className,
}: {
  vehicleType: string | null | undefined;
  className?: string;
}) {
  return createElement(getVehicleIcon(vehicleType), { className });
}
