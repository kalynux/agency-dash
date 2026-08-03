import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PoliciesSettings } from '@/components/agency-settings/PoliciesSettings';
import { NotificationSettings } from '@/components/agency-settings/NotificationSettings';
import { PreferencesSettings } from '@/components/agency-settings/PreferencesSettings';
import { InfoHint } from '@/components/common/InfoHint';

const VALID_TABS = ['policies', 'notifications', 'preferences'] as const;
type SettingsTab = typeof VALID_TABS[number];

export function Settings() {
  const { t } = useTranslation('settings');
  const { tab } = useParams<{ tab: string }>();
  const activeTab: SettingsTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as SettingsTab)
    : 'policies';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-bold">
          {t('page.title')}
          <InfoHint className="md:hidden" label={t('page.aboutLabel')}>
            {t('page.description')}
          </InfoHint>
        </h1>
        <p className="text-muted-foreground max-md:hidden">{t('page.description')}</p>
        <p className="text-muted-foreground md:hidden">{t('page.descriptionShort')}</p>
      </div>

      {activeTab === 'policies' && <PoliciesSettings />}
      {activeTab === 'notifications' && <NotificationSettings />}
      {activeTab === 'preferences' && <PreferencesSettings />}
    </div>
  );
}
