import { useTranslation } from 'react-i18next';
import { ExternalLink, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { openExternal } from '@/platform/browser';
import { webBillingUrl, webDashboardHost } from '@/platform/purchases';

/**
 * Which gated action the surrounding section would have started.
 *
 * `method` is not a purchase, but it is the form that funds one, so it is gated
 * with them rather than left as the only card-collecting screen in a build that
 * cannot take a payment. See Phase 5's closing notes.
 */
export type ManageOnWebKind = 'plan' | 'topup' | 'method';

interface ManageOnWebNoticeProps {
  kind: ManageOnWebKind;
  className?: string;
}

/**
 * The one piece of UI Phase 5 adds: what stands where a purchase button used to
 * be inside the native shell (CAPACITOR-PLAN.md → Phase 5, decision D4).
 *
 * The copy is a statement of where the thing lives, naming the host so it is
 * checkable — not an apology, not "unfortunately", and not a sales prompt.
 * Anything that reads as a workaround for a store rule invites a reviewer to
 * look harder at the rule.
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
          {t(`web.${kind}` as 'web.plan', { host: webDashboardHost })}
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
