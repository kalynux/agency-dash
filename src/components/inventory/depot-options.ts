/**
 * Naming the agency's own depots, once.
 *
 * There is no depots endpoint — the magazin's `headquartersAddresses[]` IS the
 * list (see api-doc/agency/magazin.md), and index 0 is the primary. Both the
 * inventory location filter and the depot-move dialog need the same names, and a
 * depot called "Bonabéri branch" in one and "Branch 2" in the other would read as
 * two different buildings.
 *
 * Legacy entries predate labels, so `label` is nullable; the fallback chain is
 * the one the magazin doc prescribes.
 */

import type { MagazinHeadquartersAddress } from '@/types/magazin.types';

export interface DepotOption {
  /** The magazin entry's `_id` — what `locationId` means everywhere else. */
  value: string;
  label: string;
  isPrimary: boolean;
}

export interface DepotLabels {
  primary: string;
  /** Takes `{ number }` — the 1-based index among non-primary entries. */
  branch: (number: number) => string;
}

/**
 * Depot options in magazin order, primary first.
 *
 * The index is taken BEFORE filtering so "Branch 2" keeps naming the second
 * address the user actually saved, not the second one that happens to carry an
 * `_id`. An entry the backend never assigned an `_id` cannot be filtered or moved
 * to, so it is dropped rather than offered as a dead option.
 */
export function buildDepotOptions(
  depots: MagazinHeadquartersAddress[],
  labels: DepotLabels,
): DepotOption[] {
  return depots
    .map((entry, index) => ({
      value: entry._id ?? '',
      // `join` yields '' (not null) when both parts are missing, so this chain
      // uses `||` rather than `??`.
      label:
        entry.label ||
        [entry.city, entry.region].filter(Boolean).join(', ') ||
        (index === 0 ? labels.primary : labels.branch(index)),
      isPrimary: index === 0,
    }))
    .filter((option) => Boolean(option.value));
}
