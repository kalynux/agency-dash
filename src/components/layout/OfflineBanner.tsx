import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';

import { useIsOnline } from '@/platform/network';

/**
 * A bar across the top of the app for as long as the device has no network.
 *
 * `PlatformStatus` reports the same fact, but only in the sidebar footer — and
 * the sidebar is not rendered below 768px, which is every phone this app is
 * being packaged for. Without this, the mobile build's answer to "am I offline?"
 * is a screen full of requests that quietly never resolve.
 *
 * Deliberately app-wide rather than dashboard-only: a failed sign-in on a phone
 * with no signal is exactly the moment the user most needs to be told it is the
 * network and not their password.
 *
 * It occupies the safe-area band on purpose — while it is up, it *is* the top
 * chrome, and covering the status bar with an opaque bar is the point. It
 * disappears the moment connectivity returns; there is no "back online"
 * confirmation, because the app resuming is the confirmation.
 */
export function OfflineBanner() {
  const { t } = useTranslation('nav');
  const online = useIsOnline();

  if (online) return null;

  return (
    // Dark amber on amber rather than the usual white-on-colour: `--warning` is
    // a light, saturated yellow in both themes and white on it clears barely
    // 2.5:1. The amber-500 is the one the unsaved-changes pulse already uses.
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 bg-amber-500 pt-[env(safe-area-inset-top)] text-amber-950 shadow-md"
    >
      <div className="flex items-center justify-center gap-2 px-4 py-2 text-center">
        <WifiOff className="h-4 w-4 flex-shrink-0" aria-hidden />
        <p className="text-xs font-semibold">
          {t('platformStatus.offline')}
          <span className="hidden font-normal opacity-90 sm:inline">
            {' — '}
            {t('platformStatus.offlineDetail')}
          </span>
        </p>
      </div>
    </div>
  );
}
