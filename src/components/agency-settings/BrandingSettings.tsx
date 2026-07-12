import { useCallback, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Save, Image as ImageIcon, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { brandingSchema, type BrandingFormValues } from '@/onboarding/schemas/onboarding.schemas';
import { ApiError } from '@/types/api';

const TIMEZONES = [
  { value: 'Africa/Douala', label: 'Douala (WAT, UTC+1)' },
  { value: 'Africa/Lagos', label: 'Lagos (WAT, UTC+1)' },
  { value: 'Africa/Abidjan', label: 'Abidjan (GMT, UTC+0)' },
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT, UTC+3)' },
  { value: 'Europe/Paris', label: 'Paris (CET, UTC+1)' },
];

export function BrandingSettings() {
  const { session, submitBranding, isSubmitting } = useOnboarding();
  const navigate = useNavigate();
  const roleEntity = session?.role_entity;
  const [apiError, setApiError] = useState<string | null>(null);

  const { register, handleSubmit, control, formState: { errors } } = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      logo_url: roleEntity?.logo_url ?? '',
      timezone: roleEntity?.timezone ?? '',
    },
  });

  const onSubmit = useCallback(async (values: BrandingFormValues) => {
    setApiError(null);
    try {
      await submitBranding({ skip: false, logo_url: values.logo_url || undefined, timezone: values.timezone || undefined });
      toast.success('Branding saved!');
      navigate('/dashboard/account/branding', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setApiError(err.isServer ? 'Server error. Please try again.' : err.message);
    }
  }, [submitBranding, navigate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>Your agency&apos;s logo and operating timezone</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {apiError && <div role="alert" className="p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200">{apiError}</div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" />Logo URL</Label>
            <Input type="url" placeholder="https://cdn.example.com/logo.png" {...register('logo_url')} />
            {errors.logo_url && <p className="text-xs text-red-500">{errors.logo_url.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Timezone</Label>
            <Controller control={control} name="timezone" render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
