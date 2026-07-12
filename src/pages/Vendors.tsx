import { useParams, useNavigate } from 'react-router-dom';
import { Handshake, Search } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useVendorConnections } from '@/store/vendorConnections.store';
import { ConnectionsTab } from '@/components/vendors/ConnectionsTab';
import { BrowseTab } from '@/components/vendors/BrowseTab';

const VALID_TABS = ['connections', 'browse'] as const;
type VendorsTab = typeof VALID_TABS[number];

export function Vendors() {
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const { pendingActionCount, refetch } = useVendorConnections();
  const activeTab: VendorsTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as VendorsTab)
    : 'connections';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Vendors</h1>
        <p className="text-muted-foreground">Manage vendor partnerships — you only receive orders from connected vendors</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => navigate(`/dashboard/vendors/${v}`)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="connections" className="gap-2">
            <Handshake className="w-4 h-4" />
            Connections
            {pendingActionCount > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 h-5 min-w-5 justify-center">
                {pendingActionCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="browse" className="gap-2">
            <Search className="w-4 h-4" />
            Browse
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="mt-6">
          <ConnectionsTab onConnectionChange={refetch} />
        </TabsContent>
        <TabsContent value="browse" className="mt-6">
          <BrowseTab onConnectionChange={refetch} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
