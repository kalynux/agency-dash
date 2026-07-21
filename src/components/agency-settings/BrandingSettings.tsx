import { useCallback, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, Image as ImageIcon, Clock, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useFileUpload } from '@/hooks/useFileUpload';
import { brandingSchema, type BrandingFormValues } from '@/onboarding/schemas/onboarding.schemas';
import { getApiErrorMessage } from '@/lib/errors';

const TIMEZONES = [
  { value: 'Africa/Douala', label: 'Douala (WAT, UTC+1)' },
  { value: 'Africa/Lagos', label: 'Lagos (WAT, UTC+1)' },
  { value: 'Africa/Abidjan', label: 'Abidjan (GMT, UTC+0)' },
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT, UTC+3)' },
  { value: 'Europe/Paris', label: 'Paris (CET, UTC+1)' },
];

export function BrandingSettings() {
  const { session, updateAgencyProfile, isSubmitting } = useOnboarding();
  const roleEntity = session?.role_entity;
  const [apiError, setApiError] = useState<string | null>(null);
  const { isUploading, upload } = useFileUpload();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      logo_url: roleEntity?.logo_url ?? '',
      timezone: roleEntity?.timezone ?? '',
    },
  });

  const logoUrl = watch('logo_url');

  const handleLogoFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const uploaded = await upload([files[0]]);
    if (logoInputRef.current) logoInputRef.current.value = '';
    if (uploaded && uploaded[0]) {
      setValue('logo_url', uploaded[0].url, { shouldValidate: true });
      toast.success('Logo uploaded.');
    }
  };

  const onSubmit = useCallback(async (values: BrandingFormValues) => {
    setApiError(null);
    try {
      await updateAgencyProfile({
        logo_url: values.logo_url || null,
        timezone: values.timezone || undefined,
      });
      toast.success('Branding saved!');
    } catch (err) {
      setApiError(getApiErrorMessage(err));
    }
  }, [updateAgencyProfile]);

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
            <Label className="flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" />Logo</Label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoFile(e.target.files)} />
                <Button type="button" variant="outline" size="sm" className="gap-2" disabled={isUploading} onClick={() => logoInputRef.current?.click()}>
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload logo
                </Button>
                <Input type="url" placeholder="…or paste an image URL" {...register('logo_url')} />
                {errors.logo_url && <p className="text-xs text-red-500">{errors.logo_url.message}</p>}
              </div>
            </div>
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
