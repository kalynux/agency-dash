import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PoliciesSettings } from '@/components/agency-settings/PoliciesSettings';
import { NotificationSettings } from '@/components/agency-settings/NotificationSettings';
import { PreferencesSettings } from '@/components/agency-settings/PreferencesSettings';
import { SubPageHeader } from '@/components/layout/PageContainer';
import { TabSwipeArea } from '@/components/layout/TabSwipeArea';

const VALID_TABS = ['policies', 'notifications', 'preferences'] as const;
type SettingsTab = typeof VALID_TABS[number];

export function Settings() {
  const { t } = useTranslation('settings');
  const { tab } = useParams<{ tab: string }>();
  const activeTab: SettingsTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as SettingsTab)
    : 'policies';

  return (
    <TabSwipeArea
      tabs={VALID_TABS}
      active={activeTab}
      toPath={(next) => `/dashboard/settings/${next}`}
      className="space-y-6 animate-fade-in"
    >
      <SubPageHeader
        path={`/dashboard/settings/${activeTab}`}
        description={t(`tabs.${activeTab}.description`)}
        shortDescription={t(`tabs.${activeTab}.short`)}
      />

      {activeTab === 'policies' && <PoliciesSettings />}
      {activeTab === 'notifications' && <NotificationSettings />}
      {activeTab === 'preferences' && <PreferencesSettings />}
    </TabSwipeArea>
  );
}
