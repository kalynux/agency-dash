import { useTranslation } from 'react-i18next';
import { Monitor, Moon, Sun, Zap } from 'lucide-react';
import { InfoHint } from '@/components/common/InfoHint';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAutoAssignSetting } from '@/hooks/useAutoAssignSetting';
import { useUIStore } from '@/store';
import { cn } from '@/lib/utils';
import type { Theme } from '@/lib/theme';

// `system` gets its own glyph — a sun there would claim a preference the user
// hasn't made. Explicit choices show what they selected.
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor } as const;

export function PreferencesSettings() {
  const { t } = useTranslation('settings');
  const { theme, resolvedTheme, setTheme } = useUIStore();
  const Icon = THEME_ICON[theme];

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
        <Separator />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">{t('preferences.theme')}</p>
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
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
            aria-label={t('preferences.theme')}
            className="rounded-md border border-input bg-background p-2 text-sm text-foreground"
          >
            <option value="light">{themeLabel.light}</option>
            <option value="dark">{themeLabel.dark}</option>
            <option value="system">{themeLabel.system}</option>
          </select>
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
      <div className="flex items-start gap-3">
        <Zap className="w-4 h-4 md:w-5 md:h-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
        <div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="auto-assign" className="font-medium text-base">
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
