import { useTranslation } from 'react-i18next';
import { Store } from 'lucide-react';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { cn } from '@/lib/utils';
import type { StorageInvoiceVendor } from '@/types/storage-invoice.types';

/**
 * Whose statement it is.
 *
 * ⚠ The one LIVE value on a statement: a renamed store shows its new name on old
 * statements, while every figure stays frozen at issue. So it is rendered beside
 * the record — never among the frozen lines — and says so on hover.
 */
export function StatementVendor({ vendor, className }: { vendor: StorageInvoiceVendor | null | undefined; className?: string }) {
  const { t } = useTranslation('inventory');
  const name = vendor?.businessName || vendor?.displayName || null;
  return (
    <span className={cn('flex min-w-0 items-center gap-1.5', className)} title={t('statements.vendorLive')}>
      <Store className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <span className={cn('truncate', !name && 'italic text-muted-foreground')}>
        {name ?? t('statements.unnamedVendor')}
      </span>
      {vendor && <VerifiedBadge verified={vendor.verified} className="flex-shrink-0" />}
    </span>
  );
}
