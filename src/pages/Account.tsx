import { useParams, Navigate } from 'react-router-dom';
import { ProfileSettings } from '@/components/agency-settings/ProfileSettings';
import { MagazinSettings } from '@/components/agency-settings/MagazinSettings';
import { LocationsSettings } from '@/components/agency-settings/LocationsSettings';
import { SecuritySettings } from '@/components/agency-settings/SecuritySettings';
import { PayoutSettings } from '@/components/agency-settings/PayoutSettings';
import { EarningsPayoutCard } from '@/components/agency-settings/EarningsPayoutCard';
import { BillingTab } from '@/components/billing/BillingTab';
import { InfoHint } from '@/components/common/InfoHint';
import { sectionGroupClass } from '@/components/layout/PageContainer';

const VALID_TABS = ['profile', 'store', 'locations', 'security', 'billing', 'payout'] as const;
type AccountTab = typeof VALID_TABS[number];

export function Account() {
  const { tab } = useParams<{ tab: string }>();

  // Legacy aliases — the business identity moved to the Store (magazin) tab and
  // coverage/HQ addresses became "Locations". Keep old links/bookmarks working.
  if (tab === 'branding') return <Navigate to="/dashboard/account/store" replace />;
  if (tab === 'business') return <Navigate to="/dashboard/account/locations" replace />;

  const activeTab: AccountTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as AccountTab)
    : 'profile';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-bold">
          Account
          <InfoHint className="md:hidden" label="About the Account section">
            Manage your personal profile, business identity, and payouts.
          </InfoHint>
        </h1>
        <p className="text-muted-foreground max-md:hidden">
          Manage your personal profile, business identity, and payouts
        </p>
        <p className="text-muted-foreground md:hidden">Profile, business and payouts</p>
      </div>

      {activeTab === 'profile' && <ProfileSettings />}
      {activeTab === 'store' && <MagazinSettings />}
      {activeTab === 'locations' && <LocationsSettings />}
      {activeTab === 'security' && <SecuritySettings />}
      {activeTab === 'billing' && <BillingTab />}
      {activeTab === 'payout' && (
        <div className={sectionGroupClass}>
          <EarningsPayoutCard />
          <PayoutSettings />
        </div>
      )}
    </div>
  );
}
