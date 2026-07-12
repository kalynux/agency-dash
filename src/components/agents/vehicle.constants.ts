import { Bike, Car, Truck, Footprints, type LucideIcon } from 'lucide-react';
import type { AgentVehicle } from '@/types';

export const VEHICLE_LABELS: Record<AgentVehicle, string> = {
  motorbike: 'Motorbike',
  car: 'Car',
  van: 'Van',
  bicycle: 'Bicycle',
  on_foot: 'On foot',
};

export const VEHICLE_ICONS: Record<AgentVehicle, LucideIcon> = {
  motorbike: Bike,
  car: Car,
  van: Truck,
  bicycle: Bike,
  on_foot: Footprints,
};
