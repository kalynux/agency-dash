import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { sectionRuleClass, sectionSurfaceClass } from '@/components/layout/PageContainer';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { fetchBillingSettings, updateBillingSettings } from '@/services/billing.service';
import { getApiErrorMessage } from '@/lib/errors';
import type { AnyTFunction } from '@/i18n/tx';
import { CardSkeleton } from './BillingSkeletons';
import { NOTIFY_DAYS_MIN, NOTIFY_DAYS_MAX, billingErrorMessage } from './billing.constants';

/**
 * A factory, not a module constant: a schema built at import time would freeze
 * its messages in whatever language was active at boot.
 */
function buildSchema(t: AnyTFunction) {
  return z.object({
    notifyDaysBeforeExpiry: z
      .number({ message: t('billing:settings.validation.number') })
      .int(t('billing:settings.validation.integer'))
      .min(NOTIFY_DAYS_MIN, t('billing:settings.validation.min', { min: NOTIFY_DAYS_MIN }))
      .max(NOTIFY_DAYS_MAX, t('billing:settings.validation.max', { max: NOTIFY_DAYS_MAX })),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export function BillingSettingsCard() {
  const { t } = useTranslation(['billing', 'common']);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const schema = useMemo(() => buildSchema(t), [t]);

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
        if (!cancelled) setLoadError(getApiErrorMessage(err));
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
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(billingErrorMessage(err, t('settings.saveFailed')));
    }
  }

  if (loading) return <CardSkeleton lines={2} />;

  return (
    <Card className={cn(sectionSurfaceClass, sectionRuleClass)}>
      <CardHeader className="max-md:px-0">
        <CardTitle>{t('settings.title')}</CardTitle>
        <CardDescription>{t('settings.description')}</CardDescription>
      </CardHeader>
      <CardContent className="max-md:px-0">
        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5 sm:max-w-[200px]">
              <Label htmlFor="notify-days">{t('settings.daysLabel')}</Label>
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
              {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('common:actions.save')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
