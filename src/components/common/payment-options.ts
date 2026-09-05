// ─── Payment picker options ──────────────────────────────────────────────────────
// The view model `PaymentOptionGroup` renders, plus the registry → options
// mapping. Kept out of the component file so that file exports components only
// and fast refresh keeps working.

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { brandLabel, type PaymentBrand } from '@/lib/payment-brands';

export interface PaymentOption {
  value: string;
  /** Printed name. Brand names are proper nouns — pass them untranslated. */
  label: string;
  description?: string;
  /** The option's own mark (tile layout, and the leading plate on a row). */
  brand?: PaymentBrand;
  /** Marks this option *accepts*, shown as a strip under the description. */
  brands?: readonly PaymentBrand[];
  /** Stand-in for an option with no brand mark. */
  icon?: LucideIcon;
  /** Trailing note on a row — the currency the charge lands in, say. */
  meta?: string;
  disabled?: boolean;
  /** Why it is greyed out ("Soon"). Printed on the option, not just as a title. */
  badge?: string;
  /**
   * Extra content on the option's last line, beside the brand strip — the pill
   * naming the processor, say. `stacked` layout only; a row has no room for it.
   */
  footer?: ReactNode;
}

/**
 * Registry entries → options for a group.
 *
 * Every surface stores a brand under a different key — payout keeps the
 * marketing string, billing keeps the gateway operator — so the caller names
 * the value and which entries are out of reach. Nothing else differs, which is
 * why the mapping lives here once instead of in each screen.
 */
export function brandOptions(
  brands: readonly PaymentBrand[],
  opts: {
    valueOf: (brand: PaymentBrand) => string;
    disabled?: (brand: PaymentBrand) => boolean;
    badgeFor?: (brand: PaymentBrand) => string | undefined;
    /** Use the compact name — tiles are narrow. */
    short?: boolean;
  },
): PaymentOption[] {
  return brands.map((brand) => ({
    value: opts.valueOf(brand),
    label: opts.short ? brand.shortName : brandLabel(brand),
    brand,
    disabled: opts.disabled?.(brand) ?? false,
    badge: opts.badgeFor?.(brand),
  }));
}
