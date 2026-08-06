import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useVendorConnections } from '@/store/vendorConnections.store';
import { ConnectionsTab } from '@/components/vendors/ConnectionsTab';
import { BrowseTab } from '@/components/vendors/BrowseTab';
import { SubPageHeader } from '@/components/layout/PageContainer';

const VALID_TABS = ['connections', 'browse'] as const;
type VendorsTab = typeof VALID_TABS[number];

export function Vendors() {
  const { t } = useTranslation('vendors');
  const { tab } = useParams<{ tab: string }>();
  const { refetch } = useVendorConnections();
  const activeTab: VendorsTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as VendorsTab)
    : 'connections';

  return (
    <div className="space-y-6 animate-fade-in">
      <SubPageHeader
        path={`/dashboard/vendors/${activeTab}`}
        description={t(`tabs.${activeTab}.description`)}
        shortDescription={t(`tabs.${activeTab}.short`)}
      />

      {activeTab === 'connections' && <ConnectionsTab onConnectionChange={refetch} />}
      {activeTab === 'browse' && <BrowseTab onConnectionChange={refetch} />}
    </div>
  );
}
