import { PHONE_FIELDS } from '@/components/agency-settings/phoneFields';
import { cn } from '@/lib/utils';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PoliciesSettings } from '@/components/agency-settings/PoliciesSettings';
import { NotificationSettings } from '@/components/agency-settings/NotificationSettings';
import { PreferencesSettings } from '@/components/agency-settings/PreferencesSettings';
import { LegalSettings } from '@/components/agency-settings/LegalSettings';
import { SubPageHeader, sectionGroupClass } from '@/components/layout/PageContainer';
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
      className={cn('space-y-6 animate-fade-in', PHONE_FIELDS)}
    >
      <SubPageHeader
        path={`/dashboard/settings/${activeTab}`}
        description={t(`tabs.${activeTab}.description`)}
        shortDescription={t(`tabs.${activeTab}.short`)}
      />

      {activeTab === 'policies' && <PoliciesSettings />}
      {activeTab === 'notifications' && <NotificationSettings />}
      {activeTab === 'preferences' && (
        <div className={sectionGroupClass}>
          <PreferencesSettings />
          {/* Here rather than a tab of its own: two links do not earn a tab,
              and Preferences is the catch-all where people look for them. */}
          <LegalSettings />
        </div>
      )}
    </TabSwipeArea>
  );
}
