import { useTranslation } from 'react-i18next';
import { Banknote } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { VendorCodTerms as VendorCodTermsDto } from '@/types/vendor-connection.types';

/**
 * A vendor's COD terms (api-doc/agency/vendor-connections.md § Vendor COD
 * terms): whether they accept cash on delivery, and — when they set one — the
 * most of their COD cash one agency may hold un-remitted.
 *
 * `null` / missing terms (older responses) render nothing.
 *
 * Matches the policy chips on a vendor card and a connection row. The detail
 * sheet renders the same two facts as rows of its own policy card.
 */
export function VendorCodTerms({
  terms,
  className,
}: {
  terms: VendorCodTermsDto | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation('vendors');
  if (!terms) return null;

  const accepts = terms.codEnabled ? t('codTerms.accepts') : t('codTerms.none');
  const cap =
    typeof terms.maxCashPerAgency === 'number'
      ? t('codTerms.cap', { amount: formatCurrency(terms.maxCashPerAgency) })
      : null;

  return (
    <div className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-0.5', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted',
          terms.codEnabled ? 'text-emerald-600' : 'text-muted-foreground',
        )}
      >
        <Banknote className="w-2.5 h-2.5" />
        {accepts}
      </span>
      {cap && <span className="text-[10px] leading-snug text-muted-foreground">{cap}</span>}
    </div>
  );
}
