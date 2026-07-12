import { useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useOnboarding } from '@/onboarding/store/onboarding.store';

export function ProfileSettings() {
  const { session } = useOnboarding();
  const roleEntity = session?.role_entity;
  const [name, setName] = useState(roleEntity?.agency_name ?? '');
  const [email, setEmail] = useState(roleEntity?.email ?? '');
  const [phone, setPhone] = useState(roleEntity?.phone ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsSaving(false);
    toast.success('Profile updated');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Your agency&apos;s basic contact details</CardDescription>
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
            <Input id="agency-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email ?? ''} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone ?? ''} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6XX XXX XXX" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
