import { useTranslation } from 'react-i18next';
import { ExternalLink, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { openExternal } from '@/platform/browser';
import { webBillingUrl, webDashboardHost } from '@/platform/purchases';

/**
 * Which card action the surrounding section could not offer.
 *
 * Both kinds are about a **card**, and that is the whole remaining surface of
 * this component. Plans and credit top-ups are no longer sent to the web at
 * all — mobile money completes them on the handset — so the `plan` and `topup`
 * kinds are gone with the flag that produced them.
 */
export type ManageOnWebKind = 'payCard' | 'saveCard';

interface ManageOnWebNoticeProps {
  kind: ManageOnWebKind;
  className?: string;
}

/**
 * What stands where the card option would be inside the native shell
 * (CAPACITOR-PLAN.md → Phase 5, decision D4, narrowed to cards).
 *
 * The copy is a statement of where the thing lives, naming the host so it is
 * checkable — not an apology, not "unfortunately", and not a sales prompt. It
 * also names the method that *does* work here, because the agency is one tap
 * from finishing rather than genuinely blocked.
 *
 * The link opens through `openExternal`, which on native means a Custom Tab /
 * `SFSafariViewController` over the still-running app rather than navigating the
 * WebView somewhere it cannot come back from (P3.5).
 */
export function ManageOnWebNotice({ kind, className }: ManageOnWebNoticeProps) {
  const { t } = useTranslation('billing');

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {t(`web.${kind}` as 'web.payCard', { host: webDashboardHost })}
        </p>
      </div>
      {/* h-11 rather than the default h-10: this only ever renders on a phone,
          where it is the section's sole action. */}
      <Button
        variant="outline"
        className="h-11 shrink-0 gap-2 max-sm:w-full"
        onClick={() => void openExternal(webBillingUrl)}
      >
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        {t('web.open')}
      </Button>
    </div>
  );
}
