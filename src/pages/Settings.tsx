import { useParams, useNavigate } from 'react-router-dom';
import { ScrollText, Bell, SlidersHorizontal } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PoliciesSettings } from '@/components/agency-settings/PoliciesSettings';
import { NotificationSettings } from '@/components/agency-settings/NotificationSettings';
import { PreferencesSettings } from '@/components/agency-settings/PreferencesSettings';

const VALID_TABS = ['policies', 'notifications', 'preferences'] as const;
type SettingsTab = typeof VALID_TABS[number];

export function Settings() {
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const activeTab: SettingsTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as SettingsTab)
    : 'policies';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your delivery policies and dashboard preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => navigate(`/dashboard/settings/${v}`)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="policies" className="gap-2"><ScrollText className="w-4 h-4" />Policies</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="w-4 h-4" />Notifications</TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2"><SlidersHorizontal className="w-4 h-4" />Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="mt-6"><PoliciesSettings /></TabsContent>
        <TabsContent value="notifications" className="mt-6"><NotificationSettings /></TabsContent>
        <TabsContent value="preferences" className="mt-6"><PreferencesSettings /></TabsContent>
      </Tabs>
    </div>
  );
}
