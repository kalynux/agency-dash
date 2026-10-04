import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { COMBINED_REQUESTS_ROUTE } from '@/lib/notification-display';
import { cn } from '@/lib/utils';

/**
 * Shipments header button to the combined-price requests screen. Always
 * present (it is also the way to the history), counted when some are open —
 * those are customers waiting on an answer.
 */
export function CombinedRequestsEntry({ count }: { count: number | null }) {
  const { t } = useTranslation('shipments');
  const waiting = count !== null && count > 0;
  const label = waiting ? t('combined.entryOpen', { count }) : t('combined.title');
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={cn('relative gap-1.5 max-md:h-9 max-md:w-9 max-md:p-0', waiting && 'border-primary/50')}
    >
      <Link to={COMBINED_REQUESTS_ROUTE} aria-label={label} title={label}>
        <Layers className="h-4 w-4" />
        <span className="max-md:hidden">{t('combined.entry')}</span>
        {waiting && (
          <span
            aria-hidden
            className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground max-md:absolute max-md:-end-1.5 max-md:-top-1.5"
          >
            {count}
          </span>
        )}
      </Link>
    </Button>
  );
}
