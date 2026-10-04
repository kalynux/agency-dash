import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';

import { AuthShell } from '@/components/auth/AuthShell';

/**
 * Where the owner lands after confirming a closure that took their LAST role
 * (`outcome.accountClosed: true`). The whole Wi-Mall account is closed, so
 * there is nothing to sign in to and this screen offers no way to.
 *
 * Public and static: it is reached after the session is gone, and it must also
 * survive a reload. A closure that left other roles open goes to `/login`
 * instead — see `lib/roleClosure.ts`.
 */
export function AccountClosed() {
  const { t } = useTranslation('auth');
  return (
    <AuthShell title={t('closed.title')} subtitle={t('closed.subtitle')}>
      <div className="flex items-start gap-3 text-sm">
        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
        <div className="space-y-2">
          <p>{t('closed.body')}</p>
          <p className="text-muted-foreground">{t('closed.records')}</p>
        </div>
      </div>
    </AuthShell>
  );
}
