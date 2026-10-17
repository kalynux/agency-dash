import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFeeProposals } from '@/store/feeProposals.store';

const FEE_PROPOSALS_ROUTE = '/dashboard/fee-proposals';

/**
 * Shipments header button to the payer fee-proposal inbox — shown only while
 * some wait on us, since each one holds a pickup. (The sidebar entry is the
 * way to the history.) On phones it is the only way in short of the More sheet.
 */
export function FeeProposalsEntry() {
  const { t } = useTranslation('shipments');
  const { pendingCount } = useFeeProposals();
  if (pendingCount <= 0) return null;
  const label = t('feeProposals.entryPending', { count: pendingCount });
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="relative gap-1.5 border-primary/50 max-md:h-9 max-md:w-9 max-md:p-0"
    >
      <Link to={FEE_PROPOSALS_ROUTE} aria-label={label} title={label}>
        <Scale className="h-4 w-4" />
        <span className="max-md:hidden">{t('feeProposals.entry')}</span>
        <span
          aria-hidden
          className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground max-md:absolute max-md:-end-1.5 max-md:-top-1.5"
        >
          {pendingCount}
        </span>
      </Link>
    </Button>
  );
}
