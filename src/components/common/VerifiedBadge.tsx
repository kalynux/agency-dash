import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { CHECK_PATH, SEAL_COLOR, SEAL_PATH, SEAL_VIEWBOX } from '@/components/common/verified-badge';

/**
 * The blue scalloped seal beside a vendor's or agent's name when the platform
 * has verified them (KYC). Deliberately the shape people already read as
 * "verified" from Facebook and WhatsApp, so it needs no legend.
 *
 * Renders NOTHING unless `verified` is exactly `true`: an unverified name looks
 * like every other name rather than carrying a "not verified" mark, and an
 * absent flag (an older backend, a ticket actor that is neither vendor nor
 * agent) is "no badge", never a claim either way.
 *
 * Sized in `em` so it follows the name's font size; put it inside the same
 * flex row as the name, AFTER a `truncate` name span — it is `shrink-0`, so a
 * long name gives way and the seal stays whole. For non-React HTML (the live
 * map) use `verifiedBadgeHtml` from `verified-badge.ts`.
 */
export function VerifiedBadge({
  verified,
  className,
}: {
  verified: boolean | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation('common');
  if (verified !== true) return null;
  const label = t('values.verified');
  return (
    <svg
      viewBox={SEAL_VIEWBOX}
      role="img"
      aria-label={label}
      className={cn('inline-block h-[1.05em] w-[1.05em] flex-shrink-0 align-[-0.15em]', className)}
    >
      <title>{label}</title>
      <path d={SEAL_PATH} fill={SEAL_COLOR} />
      <path d={CHECK_PATH} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
