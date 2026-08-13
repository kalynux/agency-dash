import logoSrc from '@/assets/brand/wimall-logo.png';
import { cn } from '@/lib/utils';

/**
 * The WiMall product mark — the platform's own logo, not a tenant's.
 *
 * Use it only where the chrome speaks for the platform (sidebar footer,
 * onboarding header, the login hand-off). The agency's own logo belongs in the
 * sidebar header, the account avatar and the mobile profile card; those slots
 * fall back to a glyph, never to this mark.
 *
 * The mark is a single fixed blue (#2563EA) on transparency, so it is served on
 * a white plate in both themes, the same call `PaymentBrandLogo` makes: bare on
 * the dark card it lands at ~3.5:1 and reads muddy, and tinting the artwork to
 * fix that would mean shipping a logo nobody approved. The plate disappears
 * against light surfaces — which are white already — and turns into a proper
 * app-icon tile in the dark.
 */

const PLATE_SIZES = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-9 w-9 rounded-xl',
  lg: 'h-16 w-16 rounded-2xl',
} as const;

export type AppLogoSize = keyof typeof PLATE_SIZES;

export interface AppLogoProps {
  size?: AppLogoSize;
  /**
   * Set when the platform name is already rendered beside the mark, so a screen
   * reader hears it once rather than twice.
   */
  decorative?: boolean;
  /** Drop the white plate and ring, for grounds the mark is already legible on. */
  bare?: boolean;
  className?: string;
}

export function AppLogo({
  size = 'md',
  decorative = false,
  bare = false,
  className,
}: AppLogoProps) {
  return (
    <span
      className={cn(
        // Block-level, not inline: every slot is a standalone mark, so this
        // keeps `mx-auto` working and drops the inline baseline gap that would
        // otherwise push it out of a fixed-height box.
        'flex shrink-0 items-center justify-center overflow-hidden',
        !bare && 'bg-white ring-1 ring-inset ring-black/[0.08] dark:ring-white/15',
        PLATE_SIZES[size],
        className,
      )}
    >
      <img
        src={logoSrc}
        alt={decorative ? '' : 'WiMall'}
        aria-hidden={decorative || undefined}
        draggable={false}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
