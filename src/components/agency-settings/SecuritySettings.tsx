import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Lock, Shield } from 'lucide-react';
import { SectionHeading } from '@/components/common/InfoHint';
import { sectionGroupClass, sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { authService } from '@/services/auth.service';
import { ApiError } from '@/types/api';
import { getApiErrorMessage, getFieldErrorMessage } from '@/lib/errors';
import { buildPasswordSchema, type PasswordFormValues } from '@/lib/validation-schemas';
import { cn } from '@/lib/utils';

export function SecuritySettings() {
  const { t } = useTranslation('account');
  return (
    <div className={sectionGroupClass}>
      <ChangePasswordCard />

      {/* Not-yet-implemented security features, greyed out (no agency API for these). */}
      <Card className={cn(sectionSurfaceClass, 'opacity-60')}>
        <SectionHeading
          icon={Shield}
          title={
            <>
              {t('security.twoFactor.title')}
              <Badge variant="outline" className="ms-1">{t('security.twoFactor.comingSoon')}</Badge>
            </>
          }
          description={t('security.twoFactor.description')}
        />
        <CardContent className="max-md:px-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('security.twoFactor.enable')}</p>
              <p className="text-sm text-muted-foreground">
                {t('security.twoFactor.notAvailable')}
              </p>
            </div>
            <Switch disabled aria-label={t('security.twoFactor.enableAria')} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Change the account password via the shared PATCH /me/password endpoint. */
function ChangePasswordCard() {
  const { t } = useTranslation('account');
  const [apiError, setApiError] = useState<string | null>(null);
  // Rebuilt on a language switch so the field errors follow the UI.
  const schema = useMemo(() => buildPasswordSchema(t), [t]);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: PasswordFormValues) => {
    setApiError(null);
    try {
      await authService.changePassword(values.oldPassword, values.newPassword);
      toast.success(t('security.password.success'));
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'USER_INVALID_PASSWORD') {
        setError('oldPassword', { message: getApiErrorMessage(err) });
      } else if (err instanceof ApiError && err.isValidation) {
        // A field-level message is the only server text we ever show — it names
        // the offending field and has no code to resolve. Prefer the catalogued
        // message whenever there is one.
        setApiError(getFieldErrorMessage(err) ?? getApiErrorMessage(err));
      } else {
        setApiError(getApiErrorMessage(err));
      }
    }
  };

  return (
    <Card className={sectionSurfaceClass}>
      <SectionHeading
        icon={Lock}
        title={t('security.password.title')}
        description={t('security.password.description')}
      />
      <CardContent className="max-md:px-0">
        {apiError && (
          <div role="alert" className="mb-4 p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200">
            {apiError}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="old-password">{t('security.password.current')}</Label>
            <Input id="old-password" type="password" autoComplete="current-password" {...register('oldPassword')} />
            {errors.oldPassword && <p className="text-xs text-red-500" role="alert">{errors.oldPassword.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t('security.password.new')}</Label>
            <Input id="new-password" type="password" autoComplete="new-password" {...register('newPassword')} />
            {errors.newPassword && <p className="text-xs text-red-500" role="alert">{errors.newPassword.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('security.password.confirm')}</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-xs text-red-500" role="alert">{errors.confirmPassword.message}</p>}
          </div>
          <p className="text-xs text-muted-foreground">{t('security.password.rules')}</p>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('security.password.submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
