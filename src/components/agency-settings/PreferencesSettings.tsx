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
  const { theme, resolvedTheme, setTheme } = useUIStore();
  const Icon = THEME_ICON[theme];

  return (
    <Card className={sectionSurfaceClass}>
      <SectionHeading title="Preferences" description="Personalize how the dashboard looks" />
      <CardContent className="space-y-4 max-md:px-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">
                {theme === 'system'
                  ? `Following your device — currently ${resolvedTheme}`
                  : 'Choose your preferred theme'}
              </p>
            </div>
          </div>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
            aria-label="Theme"
            className="rounded-md border border-input bg-background p-2 text-sm text-foreground"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
      </CardContent>
    </Card>
  );
}
