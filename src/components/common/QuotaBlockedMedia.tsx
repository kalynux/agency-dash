// What a file whose owner is over their storage plan looks like.
//
// `access: "quota_blocked"` arrived on 2026-09-07 as a third value alongside
// `public` and `authorized` (api-doc/files/private-files.md § The third value).
// It is a BILLING state and the right screen is not an error screen: the row,
// the bytes, and the file's contribution to `usedBytes` all survive — blocking
// is what an owner gets *instead* of losing data when a plan downgrade puts
// them over the cap, and it lifts unchanged the moment they upgrade or free
// room.
//
// So: a placeholder and a way to fix it. Never a broken image, never "file
// missing", and above all never "deleted" — that word starts a support
// conversation about data loss that did not happen.
//
// It applies to PUBLIC trees too. The tree classification and the quota check
// are independent, so logos, avatars and product photos can all come back
// blocked; a screen that only handles this on the private surfaces still shows
// broken images on the ordinary ones.
//
// ⚠ **Only render this for files THIS agency owns.** `quota_blocked` names the
// *owner's* plan, and plenty of the files on these screens belong to somebody
// else — an agent's avatar, a vendor's logo, a vendor's product photo. Telling
// an agency to upgrade because a vendor is over their cap is both wrong and
// unactionable, so those surfaces keep their existing initials/empty fallback
// (they already do: the backend sends `url: null`, and `agentAvatarUrl` and
// friends pass that straight through). Ours are the media library, the picker,
// and the agency's own avatar / magazin logo / policy documents.

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Where an agency fixes it. Same target as the `plans` deep-link alias. */
const PLAN_ROUTE = '/dashboard/account/billing';

/**
 * The full tile — icon, one line of explanation, and a link to the plan page.
 * For a media grid cell, an inspector preview, or anywhere there is room to say
 * what happened.
 */
export function QuotaBlockedMedia({
  className,
  /** Drop the plan link where the surrounding UI already offers one. */
  showAction = true,
}: {
  className?: string;
  showAction?: boolean;
}) {
  const { t } = useTranslation('media');
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center',
        className,
      )}
    >
      <div className="rounded-xl bg-amber-100 p-3 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
        <HardDrive className="h-6 w-6" />
      </div>
      <p className="text-xs font-medium text-foreground">{t('quotaBlocked.title')}</p>
      <p className="max-w-[22ch] text-xs text-muted-foreground">{t('quotaBlocked.body')}</p>
      {showAction && (
        <Link
          to={PLAN_ROUTE}
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('quotaBlocked.action')}
        </Link>
      )}
    </div>
  );
}

/**
 * The same state at avatar/thumbnail size, where there is room for an icon and
 * nothing else.
 *
 * Deliberately NOT the initials fallback an avatar would otherwise use: an
 * initials circle reads as "this account has no logo", which is a different and
 * wrong statement. `title` carries the real reason for anyone who hovers.
 */
export function QuotaBlockedBadge({ className }: { className?: string }) {
  const { t } = useTranslation('media');
  return (
    <span
      title={t('quotaBlocked.short')}
      aria-label={t('quotaBlocked.short')}
      className={cn(
        'flex h-full w-full items-center justify-center bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
        className,
      )}
    >
      <HardDrive className="h-1/2 w-1/2" />
    </span>
  );
}
