import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { AuthError, AuthShell } from '@/components/auth/AuthShell';
import { PhoneInput } from '@/components/common/PhoneInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/auth.service';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { getApiErrorMessage } from '@/lib/errors';
import {
  AGENCY_NAME_MAX,
  buildRegisterSchema,
  type RegisterFormValues,
} from '@/lib/validation-schemas';

/**
 * Create an agency account.
 *
 * This screen creates the account and nothing else. A fresh agency comes back at
 * `onboarding_step: 1`, so it hands straight over to the existing onboarding
 * subsystem — logistics, payout, branding, policies — and none of that is
 * duplicated here.
 *
 * Phone and WhatsApp **verification is deliberately absent**. It already exists
 * in-app under agency settings (`WhatsappLinkCard`, `ChannelSetupDialog`), and
 * putting a verification wall between "create account" and "start onboarding"
 * would be a second place to maintain it and a step to abandon sign-up on.
 */
export function Register() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { session, adoptSession } = useOnboarding();
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Rebuilt on a language switch so field errors follow the UI.
  const schema = useMemo(() => buildRegisterSchema(t), [t]);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', name: '', agency_name: '', email: '', password: '' },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setApiError(null);
    try {
      const res = await authService.register({
        phone: values.phone,
        name: values.name,
        agency_name: values.agency_name,
        password: values.password,
        email: values.email,
      });

      const step = res.data.role_entity.onboarding_step;
      adoptSession(res.data);
      // A new agency lands on step 1. The `=== 0` branch is not dead code — it
      // is what stops a future server-side change to the starting step from
      // parking someone on an onboarding flow with nothing left to fill in.
      navigate(step === 0 ? '/dashboard' : '/onboarding', { replace: true });
    } catch (err) {
      // Includes the 429: registration shares the credential bucket at
      // 20/min/IP, and `getApiErrorMessage` interpolates `Retry-After` into the
      // copy. Also the ones worth reading verbatim — `AUTH_PHONE_TAKEN` and
      // `AUTH_EMAIL_TAKEN` both have catalogued messages.
      setApiError(getApiErrorMessage(err));
    }
  };

  if (session) {
    return (
      <Navigate
        to={session.role_entity.onboarding_step === 0 ? '/dashboard' : '/onboarding'}
        replace
      />
    );
  }

  return (
    <AuthShell
      title={t('register.title')}
      footer={
        <span className="text-muted-foreground">
          {t('register.haveAccount')}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t('register.signIn')}
          </Link>
        </span>
      }
    >
      <AuthError message={apiError} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* The business. Seeds Magazin.name on a separate document — which is
            why it is not simply the account's display name. */}
        <div className="space-y-2">
          <Label htmlFor="agency_name">{t('register.agencyName')}</Label>
          <Input
            id="agency_name"
            autoComplete="organization"
            maxLength={AGENCY_NAME_MAX}
            autoFocus
            aria-invalid={Boolean(errors.agency_name)}
            aria-describedby={errors.agency_name ? 'agency_name-error' : undefined}
            {...register('agency_name')}
          />
          {errors.agency_name && (
            <p id="agency_name-error" role="alert" className="text-xs text-destructive">
              {errors.agency_name.message}
            </p>
          )}
        </div>

        {/* The person. Lands on the role profile as display_name. */}
        <div className="space-y-2">
          <Label htmlFor="name">{t('register.name')}</Label>
          <Input
            id="name"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
            {...register('name')}
          />
          {errors.name && (
            <p id="name-error" role="alert" className="text-xs text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">{t('register.phone')}</Label>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              // Emits E.164 and validates against the selected country's
              // numbering plan, so the account's unique key is well-formed
              // before it is ever sent.
              <PhoneInput
                id="phone"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                hasError={Boolean(errors.phone)}
                describedBy={errors.phone ? 'phone-error' : 'phone-hint'}
              />
            )}
          />
          {errors.phone ? (
            <p id="phone-error" role="alert" className="text-xs text-destructive">
              {errors.phone.message}
            </p>
          ) : (
            <p id="phone-hint" className="text-xs text-muted-foreground">
              {t('register.phoneHint')}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">
            {t('register.email')}{' '}
            <span className="font-normal text-muted-foreground">{t('register.optional')}</span>
          </Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
          {errors.email && (
            <p id="email-error" role="alert" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('register.password')}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="pe-10"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : 'password-hint'}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
              aria-pressed={showPassword}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password ? (
            <p id="password-error" role="alert" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          ) : (
            <p id="password-hint" className="text-xs text-muted-foreground">
              {t('register.passwordHint')}
            </p>
          )}
        </div>

        {/* Disabled in flight: registration shares the 20/min/IP credential
            bucket, and a double-submit spends two of them — or races two
            accounts onto one phone number. */}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {t('register.submit')}
        </Button>
      </form>
    </AuthShell>
  );
}
