import { useParams } from 'react-router-dom';
import { PoliciesSettings } from '@/components/agency-settings/PoliciesSettings';
import { NotificationSettings } from '@/components/agency-settings/NotificationSettings';
import { PreferencesSettings } from '@/components/agency-settings/PreferencesSettings';
import { InfoHint } from '@/components/common/InfoHint';

const VALID_TABS = ['policies', 'notifications', 'preferences'] as const;
type SettingsTab = typeof VALID_TABS[number];

export function Settings() {
  const { tab } = useParams<{ tab: string }>();
  const activeTab: SettingsTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as SettingsTab)
    : 'policies';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-bold">
          Settings
          <InfoHint className="md:hidden" label="About the Settings section">
            Manage your delivery policies and dashboard preferences.
          </InfoHint>
        </h1>
        <p className="text-muted-foreground max-md:hidden">
          Manage your delivery policies and dashboard preferences
        </p>
        <p className="text-muted-foreground md:hidden">Policies and preferences</p>
      </div>

      {activeTab === 'policies' && <PoliciesSettings />}
      {activeTab === 'notifications' && <NotificationSettings />}
      {activeTab === 'preferences' && <PreferencesSettings />}
    </div>
  );
}
