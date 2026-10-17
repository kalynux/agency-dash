import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Ban } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { compactCardClass } from '@/components/layout/PageContainer';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Shown on every Cash tab while an administrator has paused cash on delivery
 * for this agency (`codRestricted` on `GET /agency/cod/limit`).
 *
 * It says what stopped and what did not, and nothing else: the reason and the
 * author are never sent to the agency, and only an administrator can lift the
 * pause — so there is no "why", no button and no appeal form, just the way to
 * support. See api-doc/agency/FRONTEND-CHANGELOG-cod-restrictions.md.
 */
export function CodRestrictedBanner({ since }: { since?: string | null }) {
  const { t } = useTranslation('cash');
  // The date is the administrator's to send; without a usable one the banner
  // still has to appear, so it falls back to the undated sentence.
  const date = since && !Number.isNaN(Date.parse(since)) ? formatDate(since) : null;

  return (
    <Card role="status" className={cn(compactCardClass, 'border-amber-200 bg-amber-50/60')}>
      <CardContent className="p-4 flex items-start gap-3">
        <Ban className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">{t('restricted.title')}</p>
          <p className="text-xs text-amber-700 mt-0.5">
            {date ? t('restricted.body', { date }) : t('restricted.bodyUndated')}{' '}
            <Link
              to="/dashboard/tickets"
              className="font-medium text-amber-900 underline underline-offset-2"
            >
              {t('restricted.contactSupport')}
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
