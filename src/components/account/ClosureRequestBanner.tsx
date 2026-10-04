// "An administrator asked to close this agency account" — over every dashboard
// page while a request is pending (ADR-A10).
//
// A banner and not a gate: nothing about the agency changes until the owner
// confirms, and the request expires on its own after seven days. The agency
// keeps working — and has to, since unfinished shipments and held cash are
// exactly what blocks the closure.

import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useClosureRequest } from '@/store/closureRequest.store';
import { ACCOUNT_CLOSURE_PATH } from '@/lib/roleClosure';
import { formatDate } from '@/lib/format';

export function ClosureRequestBanner() {
  const { t } = useTranslation('account');
  const { request } = useClosureRequest();
  const { pathname } = useLocation();

  if (!request || request.status !== 'pending') return null;
  // The screen it links to says all of this, at length.
  if (pathname === ACCOUNT_CLOSURE_PATH) return null;

  return (
    <Card className="mb-6 py-0 border-destructive/30 bg-destructive/5">
      <CardContent className="flex flex-wrap items-start gap-3 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{t('closure.banner.title')}</p>
          <p className="text-sm text-muted-foreground">
            {t('closure.banner.body', { date: formatDate(request.expiresAt) })}
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="gap-2">
          <Link to={ACCOUNT_CLOSURE_PATH}>
            {t('closure.banner.cta')}
            <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
