import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CounterpartyStatus } from '@/types/vendor-connection.types';

/**
 * The VENDOR's own account status on a connection (`counterpartyStatus`,
 * 2026-10-18) — not the connection's status, which `ConnectionStatusBadge`
 * shows beside it.
 *
 * Renders nothing for `active` (the normal case), for `null` (the vendor record
 * is gone — the connection row already says what happened) and for a backend
 * that does not send the field yet.
 *
 * ⚠ Information only. Approval ignores this status, so nothing here may disable
 * or confirm an action.
 */
export function VendorAccountStatusBadge({
  status,
  className,
}: {
  status: CounterpartyStatus | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation('vendors');
  if (status !== 'pending_verification' && status !== 'inactive') return null;

  const label = status === 'pending_verification' ? t('vendorStatus.notActiveYet') : t('vendorStatus.inactive');
  const hint = status === 'pending_verification' ? t('vendorStatus.notActiveYetHint') : t('vendorStatus.inactiveHint');

  return (
    <Badge
      variant="outline"
      title={hint}
      className={cn(
        status === 'pending_verification'
          ? 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800'
          : 'text-muted-foreground bg-muted border-border',
        className,
      )}
    >
      {label}
      <span className="sr-only">. {hint}</span>
    </Badge>
  );
}
