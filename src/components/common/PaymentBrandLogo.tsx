import { CreditCard, Smartphone, Landmark } from 'lucide-react';

import { cn } from '@/lib/utils';
import { brandLabel, resolveBrand, type PaymentBrand } from '@/lib/payment-brands';
import type { PaymentMethodType } from '@/types/payment-method.types';

/**
 * A payment brand's mark, on a plate.
 *
 * The plate is always white, in both themes, and that is deliberate: three of
 * the seven marks are full-bleed brand tiles with their own background (MTN's
 * yellow, Orange's near-black, Wave's cyan) and the rest are bare marks. White
 * is the only ground all of them stay legible on, and it is how every payment
 * sheet worth copying renders them. `object-contain` keeps each one's own
 * proportions inside the square.
 */

const PLATE_SIZES = {
  sm: 'h-7 w-7 rounded-md p-0.5',
  md: 'h-10 w-10 rounded-lg p-1',
  lg: 'h-12 w-12 rounded-xl p-1.5',
} as const;

const ICON_SIZES = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
} as const;

export type PaymentBrandLogoSize = keyof typeof PLATE_SIZES;

export interface PaymentBrandLogoProps {
  brand: PaymentBrand;
  size?: PaymentBrandLogoSize;
  /**
   * Set when the brand's name is already rendered beside the mark, so a screen
   * reader hears it once rather than twice.
   */
  decorative?: boolean;
  className?: string;
}

export function PaymentBrandLogo({
  brand,
  size = 'md',
  decorative = false,
  className,
}: PaymentBrandLogoProps) {
  const label = brandLabel(brand);
  const Icon = brand.icon;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden',
        'ring-1 ring-inset ring-black/[0.08] dark:ring-white/15',
        brand.logo ? 'bg-white' : 'bg-muted text-muted-foreground',
        PLATE_SIZES[size],
        className,
      )}
    >
      {brand.logo ? (
        <img
          src={brand.logo}
          alt={decorative ? '' : label}
          aria-hidden={decorative || undefined}
          width={brand.logoSize?.width}
          height={brand.logoSize?.height}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full object-contain"
        />
      ) : Icon ? (
        <Icon className={ICON_SIZES[size]} aria-hidden="true" />
      ) : null}
      {!brand.logo && !decorative && <span className="sr-only">{label}</span>}
    </span>
  );
}

const FALLBACK_ICONS: Record<PaymentMethodType, typeof CreditCard> = {
  card: CreditCard,
  mobile_money: Smartphone,
  bank_transfer: Landmark,
};

export interface PaymentMethodMarkProps {
  /** Whatever the record calls its brand — `visa`, `MTN`, `Orange Money`, … */
  brand: string | null | undefined;
  /** Decides the fallback glyph when the brand isn't one we hold a logo for. */
  methodType: PaymentMethodType;
  size?: PaymentBrandLogoSize;
  className?: string;
}

/**
 * A saved method's mark: the operator's or network's own logo when we recognise
 * the brand, a channel glyph when we don't. A gateway can report a network this
 * registry has never heard of, and a row with a hole in it is worse than a row
 * with a generic card icon — so the fallback is never optional.
 */
export function PaymentMethodMark({
  brand,
  methodType,
  size = 'md',
  className,
}: PaymentMethodMarkProps) {
  const resolved = resolveBrand(brand);
  if (resolved) {
    return <PaymentBrandLogo brand={resolved} size={size} decorative className={className} />;
  }
  const Icon = FALLBACK_ICONS[methodType] ?? CreditCard;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center bg-muted text-muted-foreground',
        PLATE_SIZES[size],
        className,
      )}
    >
      <Icon className={ICON_SIZES[size]} aria-hidden="true" />
    </span>
  );
}

export interface PaymentBrandStripProps {
  brands: readonly PaymentBrand[];
  size?: PaymentBrandLogoSize;
  /** Cap the row and print "+N" for the rest — keeps long lists off a phone's second line. */
  max?: number;
  /** Hide from assistive tech, for when nearby copy already names the brands. */
  decorative?: boolean;
  className?: string;
}

/**
 * The row of marks that says what a channel accepts ("Visa, Mastercard, bank").
 * The marks are decorative; the group carries the names as one accessible label
 * so the row is announced as a single fact instead of a stutter of images.
 */
export function PaymentBrandStrip({
  brands,
  size = 'sm',
  max,
  decorative = false,
  className,
}: PaymentBrandStripProps) {
  const shown = max ? brands.slice(0, max) : brands;
  const overflow = brands.length - shown.length;

  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : brands.map(brandLabel).join(', ')}
    >
      {shown.map((brand) => (
        <PaymentBrandLogo key={brand.id} brand={brand} size={size} decorative />
      ))}
      {overflow > 0 && (
        <span className="text-[11px] font-medium text-muted-foreground" aria-hidden="true">
          +{overflow}
        </span>
      )}
    </span>
  );
}
