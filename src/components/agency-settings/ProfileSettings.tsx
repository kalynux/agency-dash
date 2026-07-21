import { useState } from 'react';
import { Save, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { getApiErrorMessage } from '@/lib/errors';

export function ProfileSettings() {
  const { session, updateAgencyProfile, isSubmitting } = useOnboarding();
  const roleEntity = session?.role_entity;
  const [name, setName] = useState(roleEntity?.agency_name ?? '');
  const [registrationNumber, setRegistrationNumber] = useState(roleEntity?.kyc_details?.registration_number ?? '');
  const [transportLicenseId, setTransportLicenseId] = useState(roleEntity?.kyc_details?.transport_license_id ?? '');

  const handleSave = async () => {
    try {
      await updateAgencyProfile({
        agency_name: name.trim(),
        kyc_details: {
          registration_number: registrationNumber.trim() || null,
          transport_license_id: transportLicenseId.trim() || null,
        },
      });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Your agency&apos;s basic details and KYC</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-6">
          <img
            src={roleEntity?.logo_url || `https://i.pravatar.cc/150?u=${roleEntity?._id ?? 'agency'}`}
            alt={name || 'Agency'}
            className="w-20 h-20 rounded-full object-cover"
          />
          <div className="space-y-1">
            <p className="font-medium">{name || 'My Agency'}</p>
            <p className="text-sm text-muted-foreground">Update your logo from the Branding tab.</p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="agency-name">Agency Name</Label>
            <Input id="agency-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex items-center gap-2">
              <Input id="email" type="email" value={roleEntity?.email ?? ''} readOnly disabled />
            </div>
            <p className="text-xs text-muted-foreground">Email can't be changed here — contact support.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={roleEntity?.phone ?? ''} readOnly disabled placeholder="+237 6XX XXX XXX" />
            <p className="text-xs text-muted-foreground">Phone can't be changed here — contact support.</p>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> KYC / Verification
            </h4>
            {roleEntity?.kyc_details?.legit_verified ? (
              <Badge variant="outline" className="text-green-600 border-green-200 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600 border-amber-200">Pending review</Badge>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reg-number">Business registration number</Label>
              <Input id="reg-number" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport-license">Transport license ID</Label>
              <Input id="transport-license" value={transportLicenseId} onChange={(e) => setTransportLicenseId(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSubmitting} className="gap-2">
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
