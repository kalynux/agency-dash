import { useState } from 'react';
import { Moon, Sun, Languages, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUIStore } from '@/store';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { getApiErrorMessage } from '@/lib/errors';

type Lang = 'en' | 'fr' | 'pt' | 'es' | 'ar';

const LANGUAGES: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'pt', label: 'Português' },
  { value: 'es', label: 'Español' },
  { value: 'ar', label: 'العربية' },
];

export function PreferencesSettings() {
  const { theme, setTheme } = useUIStore();
  const { session, updateAgencyProfile } = useOnboarding();
  const [language, setLanguage] = useState<Lang>(session?.role_entity.preferred_language ?? 'en');
  const [savingLang, setSavingLang] = useState(false);

  const changeLanguage = async (next: Lang) => {
    const prev = language;
    setLanguage(next);
    setSavingLang(true);
    try {
      await updateAgencyProfile({ preferred_language: next });
      toast.success('Notification language updated.');
    } catch (err) {
      setLanguage(prev);
      toast.error(getApiErrorMessage(err));
    } finally {
      setSavingLang(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Personalize how the dashboard looks and the language of your notifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
            </div>
          </div>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            className="p-2 border rounded-md bg-background"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Languages className="w-5 h-5" />
            <div>
              <p className="font-medium">Notification language</p>
              <p className="text-sm text-muted-foreground">Every notification is rendered in this language</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {savingLang && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Select value={language} onValueChange={(v) => changeLanguage(v as Lang)} disabled={savingLang}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
