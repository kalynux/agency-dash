import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { ProfileSettings } from '@/components/agency-settings/ProfileSettings';
import { MagazinSettings } from '@/components/agency-settings/MagazinSettings';
import { LocationsSettings } from '@/components/agency-settings/LocationsSettings';
import { VerificationSettings } from '@/components/agency-settings/verification/VerificationSettings';
import { SecuritySettings } from '@/components/agency-settings/SecuritySettings';
import { PayoutSettings } from '@/components/agency-settings/PayoutSettings';
import { EarningsPayoutCard } from '@/components/agency-settings/EarningsPayoutCard';
import { BillingTab } from '@/components/billing/BillingTab';
import { SubPageHeader, sectionGroupClass } from '@/components/layout/PageContainer';
import { TabSwipeArea } from '@/components/layout/TabSwipeArea';

const VALID_TABS = [
  'profile',
  'store',
  'locations',
  'verification',
  'security',
  'billing',
  'payout',
] as const;
type AccountTab = typeof VALID_TABS[number];

export function Account() {
  const { t } = useTranslation(['account', 'nav']);
  const { tab } = useParams<{ tab: string }>();
  const isMobile = useIsMobile();
  const [logoutOpen, setLogoutOpen] = useState(false);

  // Legacy aliases — the business identity moved to the Store (magazin) tab and
  // coverage/HQ addresses became "Locations". Keep old links/bookmarks working.
  if (tab === 'branding') return <Navigate to="/dashboard/account/store" replace />;
  if (tab === 'business') return <Navigate to="/dashboard/account/locations" replace />;

  const activeTab: AccountTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as AccountTab)
    : 'profile';

  return (
    <TabSwipeArea
      tabs={VALID_TABS}
      active={activeTab}
      toPath={(next) => `/dashboard/account/${next}`}
      className="space-y-6 animate-fade-in"
    >
      {/* The crumb names the parent menu; the copy under it belongs to the tab
          you are actually on, not to "Account" as a whole. */}
      <SubPageHeader
        path={`/dashboard/account/${activeTab}`}
        description={t(`tabs.${activeTab}.description`)}
        shortDescription={t(`tabs.${activeTab}.short`)}
        // Sign-out, on the Profile tab, on mobile only.
        //
        // The desktop shell already offers it in the header's avatar menu, and
        // the phone shell has no header at all — which until now left a native
        // build with no way to sign out whatsoever. Profile is where people look
        // for it, and this is that screen's top-right corner.
        actionItems={
          isMobile && activeTab === 'profile'
            ? [
                {
                  id: 'logout',
                  label: t('nav:header.logout'),
                  icon: LogOut,
                  destructive: true,
                  onSelect: () => setLogoutOpen(true),
                },
              ]
            : undefined
        }
      />

      <LogoutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} />

      {activeTab === 'profile' && <ProfileSettings />}
      {activeTab === 'store' && <MagazinSettings />}
      {activeTab === 'locations' && <LocationsSettings />}
      {activeTab === 'verification' && <VerificationSettings />}
      {activeTab === 'security' && <SecuritySettings />}
      {activeTab === 'billing' && <BillingTab />}
      {activeTab === 'payout' && (
        <div className={sectionGroupClass}>
          <EarningsPayoutCard />
          <PayoutSettings />
        </div>
      )}
    </TabSwipeArea>
  );
}
