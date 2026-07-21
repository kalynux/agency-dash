import { useParams } from 'react-router-dom';
import { useVendorConnections } from '@/store/vendorConnections.store';
import { ConnectionsTab } from '@/components/vendors/ConnectionsTab';
import { BrowseTab } from '@/components/vendors/BrowseTab';

const VALID_TABS = ['connections', 'browse'] as const;
type VendorsTab = typeof VALID_TABS[number];

export function Vendors() {
  const { tab } = useParams<{ tab: string }>();
  const { refetch } = useVendorConnections();
  const activeTab: VendorsTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as VendorsTab)
    : 'connections';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Vendors</h1>
        <p className="text-muted-foreground">Manage vendor partnerships — you only receive orders from connected vendors</p>
      </div>

      {activeTab === 'connections' && <ConnectionsTab onConnectionChange={refetch} />}
      {activeTab === 'browse' && <BrowseTab onConnectionChange={refetch} />}
    </div>
  );
}
