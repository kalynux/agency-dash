import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Fingerprint, Loader2, Lock, Shield } from 'lucide-react';
import { SectionHeading } from '@/components/common/InfoHint';
import { sectionGroupClass, sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { authService } from '@/services/auth.service';
import { ApiError } from '@/types/api';
import { getApiErrorMessage, getFieldErrorMessage } from '@/lib/errors';
import { buildPasswordSchema, type PasswordFormValues } from '@/lib/validation-schemas';
import { cn } from '@/lib/utils';
import {
  disableBiometricUnlock,
  enableBiometricUnlock,
  isBiometricUnlockEnabled,
} from '@/lib/biometricUnlock';
import { updateBiometricPassword } from '@/platform/auth/biometricLogin';
import { getBiometryInfo, type BiometryInfo } from '@/platform/biometrics';
import { isNative } from '@/platform/env';
import { openBiometricEnrollmentSettings } from '@/platform/permissions';

export function SecuritySettings() {
  const { t } = useTranslation('account');
  return (
    <div className={sectionGroupClass}>
      <ChangePasswordCard />
      <BiometricUnlockCard />

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

/**
 * Turn "unlock with your fingerprint" on and off.
 *
 * The switch is only live when the device can actually deliver on it, and
 * turning it on runs a real prompt first (`enableBiometricUnlock`) — promising
 * a fingerprint sign-in and discovering on the next cold start that the sensor
 * refuses is the failure this rules out.
 *
 * Three unavailable states, told apart because only one of them is the user's
 * to fix: no hardware (nothing to say but so), nothing enrolled (a route to the
 * system screen that fixes it), and the web build (a statement about where the
 * feature lives, not a fault).
 */
function BiometricUnlockCard() {
  const { t } = useTranslation('account');
  const [info, setInfo] = useState<BiometryInfo | null>(null);
  const [enabled, setEnabled] = useState(isBiometricUnlockEnabled);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getBiometryInfo().then((next) => {
      if (!cancelled) setInfo(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggle = async (next: boolean) => {
    if (!next) {
      // Awaited, not fired and forgotten: this also forgets the sign-in details
      // saved for the fingerprint button, and the toast below says it happened.
      await disableBiometricUnlock();
      setEnabled(false);
      toast.success(t('security.biometric.disabledToast'));
      return;
    }

    setBusy(true);
    try {
      const outcome = await enableBiometricUnlock();
      if (outcome === 'ok') {
        setEnabled(true);
        toast.success(t('security.biometric.enabledToast'));
        return;
      }
      // The switch never moved — `enabled` is still false — so this only has to
      // say why. A cancel gets the neutral line rather than an error: choosing
      // not to finish is not a failure.
      if (outcome === 'cancelled') toast.info(t('security.biometric.cancelledToast'));
      else toast.error(t('security.biometric.unsupported'));
    } finally {
      setBusy(false);
    }
  };

  // Still asking the OS. Rendering the switch now would flash an interactive
  // control that is about to turn out to be disabled.
  if (info === null) return null;

  const unavailableReason = !isNative
    ? t('security.biometric.webOnly')
    : info.notEnrolled
      ? t('security.biometric.notEnrolled')
      : !info.available
        ? t('security.biometric.unsupported')
        : null;

  return (
    <Card className={cn(sectionSurfaceClass, unavailableReason && 'opacity-60')}>
      <SectionHeading
        icon={Fingerprint}
        title={t('security.biometric.title')}
        description={t('security.biometric.description')}
      />
      <CardContent className="max-md:px-0">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium">{t('security.biometric.enable')}</p>
            <p className="text-sm text-muted-foreground">
              {unavailableReason ??
                (enabled
                  ? t('security.biometric.enabledHint')
                  : t('security.biometric.disabledHint'))}
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={busy || unavailableReason !== null}
            onCheckedChange={(next) => void onToggle(next)}
            aria-label={t('security.biometric.toggleAria')}
          />
        </div>

        {/* Only for the one unavailable state the user can do something about. */}
        {isNative && info.notEnrolled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => void openBiometricEnrollmentSettings()}
          >
            {t('security.biometric.openSettings')}
          </Button>
        )}

        {enabled && (
          <p className="mt-4 text-xs text-muted-foreground">
            {t('security.biometric.signOutNote')}
          </p>
        )}
      </CardContent>
    </Card>
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
      // Keep the biometric credential in step. Without this, changing a password
      // here silently breaks the fingerprint button: the next unlock 401s, the
      // credential is thrown away, and the user is back to typing with no idea
      // which of the two things they did caused it. A no-op when nothing is
      // stored, and best-effort — the password change already succeeded.
      await updateBiometricPassword(values.newPassword);
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
            <PasswordInput id="old-password" autoComplete="current-password" {...register('oldPassword')} />
            {errors.oldPassword && <p className="text-xs text-red-500" role="alert">{errors.oldPassword.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t('security.password.new')}</Label>
            <PasswordInput id="new-password" autoComplete="new-password" {...register('newPassword')} />
            {errors.newPassword && <p className="text-xs text-red-500" role="alert">{errors.newPassword.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('security.password.confirm')}</Label>
            <PasswordInput id="confirm-password" autoComplete="new-password" {...register('confirmPassword')} />
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
