import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { AuthError, AuthShell } from '@/components/auth/AuthShell';
import { PhoneInput } from '@/components/common/PhoneInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authService } from '@/services/auth.service';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { getApiErrorMessage } from '@/lib/errors';
import { buildLoginSchema, type LoginFormValues } from '@/lib/validation-schemas';

/**
 * Sign in to the agency dashboard.
 *
 * Until now this screen redirected to the main Wi-Mall site, because the
 * dashboard was only ever opened from there. A packaged mobile app has no such
 * place to be sent to, so sign-in has to live here — and once it does, the web
 * build gets it too. Registration and password reset are its siblings
 * (`/register`, `/forgot-password`).
 *
 * `role: 'agency'` is fixed by `authService.login`: this is the agency
 * dashboard, and letting the server resolve whichever role it found first would
 * sign a multi-role account into the wrong product.
 */
export function Login() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const { session, adoptSession } = useOnboarding();
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Rebuilt on a language switch so field errors follow the UI.
  const schema = useMemo(() => buildLoginSchema(t), [t]);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier_type: 'phone', identifier: '', password: '' },
  });

  // `useWatch`, not `watch()` — the latter returns a fresh function every render
  // and the React Compiler refuses to memoize a component that calls it.
  const identifierType = useWatch({ control, name: 'identifier_type' });

  const onSubmit = async (values: LoginFormValues) => {
    setApiError(null);
    try {
      const res = await authService.login({
        // `identifier_type` is a UI concern and stops here.
        identifier: values.identifier,
        password: values.password,
      });

      const step = res.data.role_entity.onboarding_step;
      adoptSession(res.data);

      // A guard that bounced someone here stashed where they were going. Honour
      // it only once onboarding is finished — an unfinished agency has exactly
      // one legal destination and it is not their bookmark.
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      const target =
        step === 0 ? (from && !from.startsWith('/login') ? from : '/dashboard') : '/onboarding';
      navigate(target, { replace: true });
    } catch (err) {
      // Covers the 429 too: the credential bucket is 20/min/IP, and
      // `getApiErrorMessage` interpolates `Retry-After` into the copy. A 429 is
      // NOT a sign-out — see api.ts → classifyAuthError.
      setApiError(getApiErrorMessage(err));
    }
  };

  // Already signed in — nothing to do here. Happens on a back-navigation to
  // /login after a successful sign-in.
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
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      footer={
        <div className="space-y-2">
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            {t('login.forgotPassword')}
          </Link>
          <p className="text-muted-foreground">
            {t('login.noAccount')}{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              {t('login.createAccount')}
            </Link>
          </p>
        </div>
      }
    >
      <AuthError message={apiError} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Phone or email — the server takes either in one field, but the two
            need different inputs, so the form asks rather than guesses. */}
        <Controller
          control={control}
          name="identifier_type"
          render={({ field }) => (
            <Tabs
              value={field.value}
              onValueChange={(next) => {
                field.onChange(next);
                // The old value is meaningless in the other mode — an E.164
                // number is not an email, and leaving it behind would submit a
                // phone as an email or vice versa.
                setValue('identifier', '', { shouldValidate: false });
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="phone">{t('login.usePhone')}</TabsTrigger>
                <TabsTrigger value="email">{t('login.useEmail')}</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        />

        <div className="space-y-2">
          <Label htmlFor="identifier">
            {identifierType === 'phone' ? t('login.phone') : t('login.email')}
          </Label>

          <Controller
            control={control}
            name="identifier"
            render={({ field }) =>
              identifierType === 'phone' ? (
                // Emits E.164 directly, so nothing downstream re-normalises.
                <PhoneInput
                  id="identifier"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  hasError={Boolean(errors.identifier)}
                  describedBy={errors.identifier ? 'identifier-error' : undefined}
                  autoFocus
                />
              ) : (
                <Input
                  id="identifier"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoFocus
                  aria-invalid={Boolean(errors.identifier)}
                  aria-describedby={errors.identifier ? 'identifier-error' : undefined}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )
            }
          />

          {errors.identifier && (
            <p id="identifier-error" role="alert" className="text-xs text-destructive">
              {errors.identifier.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('login.password')}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="pe-10"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
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
          {errors.password && (
            <p id="password-error" role="alert" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Disabled while in flight: the credential bucket is 20/min/IP and a
            double-submit spends two of them for one sign-in. */}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {t('login.submit')}
        </Button>
      </form>
    </AuthShell>
  );
}
