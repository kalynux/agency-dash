import { useTranslation } from 'react-i18next';
import { Monitor, Moon, Sun } from 'lucide-react';
import { SectionHeading } from '@/components/common/InfoHint';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { useUIStore } from '@/store';
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

  return (
    <Card className={sectionSurfaceClass}>
      <SectionHeading title={t('preferences.title')} description={t('preferences.description')} />
      <CardContent className="space-y-4 max-md:px-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{t('preferences.theme')}</p>
              <p className="text-sm text-muted-foreground">
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
