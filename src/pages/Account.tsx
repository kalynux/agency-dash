import { useParams } from 'react-router-dom';
import { ProfileSettings } from '@/components/agency-settings/ProfileSettings';
import { BusinessSettings } from '@/components/agency-settings/BusinessSettings';
import { BrandingSettings } from '@/components/agency-settings/BrandingSettings';
import { SecuritySettings } from '@/components/agency-settings/SecuritySettings';
import { PayoutSettings } from '@/components/agency-settings/PayoutSettings';
import { EarningsPayoutCard } from '@/components/agency-settings/EarningsPayoutCard';

const VALID_TABS = ['profile', 'business', 'branding', 'security', 'payout'] as const;
type AccountTab = typeof VALID_TABS[number];

export function Account() {
  const { tab } = useParams<{ tab: string }>();
  const activeTab: AccountTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as AccountTab)
    : 'profile';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-muted-foreground">Manage your agency profile and account settings</p>
      </div>

      {activeTab === 'profile' && <ProfileSettings />}
      {activeTab === 'business' && <BusinessSettings />}
      {activeTab === 'branding' && <BrandingSettings />}
      {activeTab === 'security' && <SecuritySettings />}
      {activeTab === 'payout' && (
        <div className="space-y-6">
          <EarningsPayoutCard />
          <PayoutSettings />
        </div>
      )}
    </div>
  );
}
