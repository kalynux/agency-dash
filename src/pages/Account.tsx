import { useParams, useNavigate } from 'react-router-dom';
import { User, MapPin, Image as ImageIcon, Shield, CreditCard, Wallet } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ProfileSettings } from '@/components/agency-settings/ProfileSettings';
import { BusinessSettings } from '@/components/agency-settings/BusinessSettings';
import { BrandingSettings } from '@/components/agency-settings/BrandingSettings';
import { SecuritySettings } from '@/components/agency-settings/SecuritySettings';
import { BillingTab } from '@/components/agency-settings/BillingTab';
import { PayoutSettings } from '@/components/agency-settings/PayoutSettings';

const VALID_TABS = ['profile', 'business', 'branding', 'security', 'billing', 'payout'] as const;
type AccountTab = typeof VALID_TABS[number];

export function Account() {
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const activeTab: AccountTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as AccountTab)
    : 'profile';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-muted-foreground">Manage your agency profile and account settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => navigate(`/dashboard/account/${v}`)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="profile" className="gap-2"><User className="w-4 h-4" />Profile</TabsTrigger>
          <TabsTrigger value="business" className="gap-2"><MapPin className="w-4 h-4" />Business</TabsTrigger>
          <TabsTrigger value="branding" className="gap-2"><ImageIcon className="w-4 h-4" />Branding</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Shield className="w-4 h-4" />Security</TabsTrigger>
          <TabsTrigger value="billing" className="gap-2"><CreditCard className="w-4 h-4" />Billing</TabsTrigger>
          <TabsTrigger value="payout" className="gap-2"><Wallet className="w-4 h-4" />Payout</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6"><ProfileSettings /></TabsContent>
        <TabsContent value="business" className="mt-6"><BusinessSettings /></TabsContent>
        <TabsContent value="branding" className="mt-6"><BrandingSettings /></TabsContent>
        <TabsContent value="security" className="mt-6"><SecuritySettings /></TabsContent>
        <TabsContent value="billing" className="mt-6"><BillingTab /></TabsContent>
        <TabsContent value="payout" className="mt-6"><PayoutSettings /></TabsContent>
      </Tabs>
    </div>
  );
}
