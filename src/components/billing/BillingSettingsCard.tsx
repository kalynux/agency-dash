import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { fetchBillingSettings, updateBillingSettings } from '@/services/billing.service';
import { ApiError } from '@/types/api';
import { CardSkeleton } from './BillingSkeletons';
import { NOTIFY_DAYS_MIN, NOTIFY_DAYS_MAX, billingErrorMessage } from './billing.constants';

const schema = z.object({
  notifyDaysBeforeExpiry: z
    .number({ message: 'Enter a number of days' })
    .int('Must be a whole number')
    .min(NOTIFY_DAYS_MIN, `Must be at least ${NOTIFY_DAYS_MIN}`)
    .max(NOTIFY_DAYS_MAX, `Must be at most ${NOTIFY_DAYS_MAX}`),
});

type FormValues = z.infer<typeof schema>;

export function BillingSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { notifyDaysBeforeExpiry: 7 },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await fetchBillingSettings();
        if (!cancelled) reset({ notifyDaysBeforeExpiry: settings.notifyDaysBeforeExpiry });
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Failed to load settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reset]);

  async function onSubmit(values: FormValues) {
    try {
      const updated = await updateBillingSettings(values.notifyDaysBeforeExpiry);
      reset({ notifyDaysBeforeExpiry: updated.notifyDaysBeforeExpiry });
      toast.success('Settings updated');
    } catch (err) {
      toast.error(billingErrorMessage(err, 'Failed to update settings.'));
    }
  }

  if (loading) return <CardSkeleton lines={2} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expiry reminders</CardTitle>
        <CardDescription>
          How many days before your plan expires should we warn you?
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5 sm:max-w-[200px]">
              <Label htmlFor="notify-days">Days before expiry</Label>
              <Input
                id="notify-days"
                type="number"
                min={NOTIFY_DAYS_MIN}
                max={NOTIFY_DAYS_MAX}
                {...register('notifyDaysBeforeExpiry', { valueAsNumber: true })}
                aria-invalid={!!errors.notifyDaysBeforeExpiry}
              />
              {errors.notifyDaysBeforeExpiry && (
                <p className="text-xs text-destructive">{errors.notifyDaysBeforeExpiry.message}</p>
              )}
            </div>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
