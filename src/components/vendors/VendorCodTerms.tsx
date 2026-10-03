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
 * `chip` matches the policy chips on a vendor card; `rows` is the bordered
 * block of the vendor detail sheet.
 */
export function VendorCodTerms({
  terms,
  variant = 'chip',
  className,
}: {
  terms: VendorCodTermsDto | null | undefined;
  variant?: 'chip' | 'rows';
  className?: string;
}) {
  const { t } = useTranslation('vendors');
  if (!terms) return null;

  const accepts = terms.codEnabled ? t('codTerms.accepts') : t('codTerms.none');
  const cap =
    typeof terms.maxCashPerAgency === 'number'
      ? t('codTerms.cap', { amount: formatCurrency(terms.maxCashPerAgency) })
      : null;

  if (variant === 'rows') {
    return (
      <div className={cn('rounded-lg border divide-y', className)}>
        <p className="flex items-center gap-1 py-2 px-3 text-xs font-medium">
          <Banknote className="w-3 h-3 shrink-0" />
          {accepts}
        </p>
        {cap && <p className="py-2 px-3 text-xs text-muted-foreground">{cap}</p>}
      </div>
    );
  }

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
