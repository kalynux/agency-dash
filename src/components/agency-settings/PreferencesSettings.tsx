import { useTranslation } from 'react-i18next';
import { InfoHint } from '@/components/common/InfoHint';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { useAutoAssignSetting } from '@/hooks/useAutoAssignSetting';
import { useUIStore } from '@/store';
import { cn } from '@/lib/utils';
import type { Theme } from '@/lib/theme';


export function PreferencesSettings() {
  const { t } = useTranslation('settings');
  const { theme, resolvedTheme, setTheme } = useUIStore();

  const themeLabel = {
    light: t('preferences.themeLight'),
    dark: t('preferences.themeDark'),
    system: t('preferences.themeSystem'),
  } satisfies Record<Theme, string>;

  // No section heading: this tab is a single block, so the page header above it
  // already names it — a heading here would print the same line twice.
  return (
    <Card className={sectionSurfaceClass}>
      <CardContent className="space-y-4 max-md:px-0">
        <AutoAssignRow />
        <AgentFeeProposalsRow />
        <Separator />
        {/* Three short answers → tap buttons under the label (as on the vendor
            dashboard), not a small native dropdown beside it. */}
        <div className="space-y-3">
          <div>
            <div>
              <p className="text-sm font-medium">{t('preferences.theme')}</p>
              {/* "Choose your preferred theme" says nothing the select beside it
                  doesn't, so a phone drops it; the following-device line is a
                  state and stays. */}
              <p className={cn('text-sm text-muted-foreground', theme !== 'system' && 'max-md:hidden')}>
                {theme === 'system'
                  ? t('preferences.themeFollowingDevice', {
                      // The resolved theme is what the OS is showing right now,
                      // so name it in the user's language rather than echoing
                      // the raw `light`/`dark` token.
                      theme: themeLabel[resolvedTheme].toLowerCase(),
                    })
                  : t('preferences.themeHint')}
              </p>
            </div>
          </div>
          <ChoiceChips
            label={t('preferences.theme')}
            value={theme}
            onChange={(v) => setTheme(v as Theme)}
            options={[
              { value: 'light', label: themeLabel.light },
              { value: 'dark', label: themeLabel.dark },
              { value: 'system', label: themeLabel.system },
            ]}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Standing auto-assignment: once on, the backend offers every shipment handed
 * to this agency to the nearest eligible agent by itself — the agency's
 * counterpart of the vendor's "auto-redirect orders to agency".
 */
function AutoAssignRow() {
  const { t } = useTranslation(['settings', 'common']);
  const { enabled, loadError, saving, reload, setEnabled } = useAutoAssignSetting();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start">
        <div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="auto-assign" className="text-sm font-medium">
              {t('preferences.autoAssign')}
            </Label>
            <InfoHint
              className="md:hidden"
              label={t('common:form.aboutSection', { title: t('preferences.autoAssign') })}
            >
              {t('preferences.autoAssignHint')}
            </InfoHint>
          </div>
          {/* Four lines of how-it-works under a switch on a phone; behind the ⓘ
              there. The load error below is a state and stays visible. */}
          <p className="text-sm text-muted-foreground max-md:hidden">{t('preferences.autoAssignHint')}</p>
          {loadError && (
            <p className="mt-1 text-sm text-destructive">
              {t('preferences.autoAssignLoadError')}{' '}
              <button type="button" className="underline" onClick={() => void reload()}>
                {t('preferences.retry')}
              </button>
            </p>
          )}
        </div>
      </div>
      <Switch
        id="auto-assign"
        className="mt-0.5"
        checked={enabled === true}
        disabled={enabled === null || saving}
        onCheckedChange={setEnabled}
      />
    </div>
  );
}

/**
 * `agentsCanProposeDeliveryFee`: lets the agent holding a shipment's accepted
 * offer propose a different delivery fee. The proposal goes straight to the
 * vendor — the agency sees it and may edit it, but does not approve it first.
 * Its PATCH carries only this key (the endpoint is partial since 2026-10-02).
 */
function AgentFeeProposalsRow() {
  const { t } = useTranslation(['settings', 'common']);
  const { agentsCanProposeDeliveryFee, savingAgentFee, setAgentsCanProposeDeliveryFee } =
    useAutoAssignSetting();

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="agents-propose-fee" className="text-sm font-medium">
            {t('preferences.agentFeeProposals')}
          </Label>
          <InfoHint
            className="md:hidden"
            label={t('common:form.aboutSection', { title: t('preferences.agentFeeProposals') })}
          >
            {t('preferences.agentFeeProposalsHint')}
          </InfoHint>
        </div>
        <p className="text-sm text-muted-foreground max-md:hidden">{t('preferences.agentFeeProposalsHint')}</p>
      </div>
      <Switch
        id="agents-propose-fee"
        className="mt-0.5"
        checked={agentsCanProposeDeliveryFee === true}
        disabled={agentsCanProposeDeliveryFee === null || savingAgentFee}
        onCheckedChange={setAgentsCanProposeDeliveryFee}
      />
    </div>
  );
}
