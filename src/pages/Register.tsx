import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { AuthError, AuthLink, AuthShell } from '@/components/auth/AuthShell';
import { FieldLabel, FieldMessage, PasswordField } from '@/components/auth/AuthFields';
import { PhoneInput } from '@/components/common/PhoneInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
 * Field order is the person, then the business, then how to reach them, and it
 * matches Wi-Vendor's sign-up field for field. Someone who runs both apps sets
 * up the second one from muscle memory.
 *
 * Phone and WhatsApp **verification is deliberately absent**. Connecting a
 * messaging channel already exists in-app under agency settings
 * (`ChannelSetupDialog` → `POST /api/me/connections`), and putting a
 * verification wall between "create account" and "start onboarding" would be a
 * second place to maintain it and a step to abandon sign-up on. It could not
 * live here in any case: the code is minted by the bot and redeemed by an
 * **authenticated** caller, so there is no session to redeem it with until this
 * form has already succeeded.
 */
export function Register() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { session, adoptSession } = useOnboarding();
  const [apiError, setApiError] = useState<string | null>(null);

  // Rebuilt on a language switch so field errors follow the UI.
  const schema = useMemo(() => buildRegisterSchema(t), [t]);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      agency_name: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setApiError(null);
    try {
      // Built field by field rather than spread: `confirmPassword` is a form
      // concern and has no business on the wire.
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
      subtitle={t('register.subtitle')}
      footer={
        <>
          {t('register.haveAccount')} <AuthLink to="/login">{t('register.signIn')}</AuthLink>
        </>
      }
    >
      <AuthError message={apiError} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* The person. Lands on the role profile as display_name. */}
        <div className="space-y-1.5">
          <FieldLabel htmlFor="name" required>
            {t('register.name')}
          </FieldLabel>
          <Input
            id="name"
            autoComplete="name"
            placeholder={t('register.namePlaceholder')}
            className="h-11"
            autoFocus
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-message' : undefined}
            {...register('name')}
          />
          <FieldMessage id="name-message" error={errors.name?.message} />
        </div>

        {/* The business. Seeds Magazin.name on a separate document — which is
            why it is not simply the account's display name. */}
        <div className="space-y-1.5">
          <FieldLabel htmlFor="agency_name" required>
            {t('register.agencyName')}
          </FieldLabel>
          <Input
            id="agency_name"
            autoComplete="organization"
            maxLength={AGENCY_NAME_MAX}
            placeholder={t('register.agencyNamePlaceholder')}
            className="h-11"
            aria-invalid={Boolean(errors.agency_name)}
            aria-describedby="agency_name-message"
            {...register('agency_name')}
          />
          <FieldMessage
            id="agency_name-message"
            error={errors.agency_name?.message}
            hint={t('register.agencyNameHint')}
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="phone" required>
            {t('register.phone')}
          </FieldLabel>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              // Emits E.164 and validates against the selected country's
              // numbering plan, so the account's unique key is well-formed
              // before it is ever sent.
              <PhoneInput
                id="phone"
                className="h-11"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                hasError={Boolean(errors.phone)}
                describedBy="phone-message"
              />
            )}
          />
          <FieldMessage
            id="phone-message"
            error={errors.phone?.message}
            hint={t('register.phoneHint')}
          />
        </div>

        {/* Optional, and said so by the hint rather than by a marker on the
            label: every other field here carries a required asterisk, so the
            one without it is already the odd one out. The hint spends its line
            on *why* you would fill it in instead. */}
        <div className="space-y-1.5">
          <FieldLabel htmlFor="email">{t('register.email')}</FieldLabel>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t('register.emailPlaceholder')}
            className="h-11"
            aria-invalid={Boolean(errors.email)}
            aria-describedby="email-message"
            {...register('email')}
          />
          <FieldMessage
            id="email-message"
            error={errors.email?.message}
            hint={t('register.emailHint')}
          />
        </div>

        <PasswordField
          id="password"
          label={t('register.password')}
          hint={t('register.passwordHint')}
          autoComplete="new-password"
          error={errors.password?.message}
          registration={register('password')}
        />

        {/* A typo in a password nobody can see is only discovered at the next
            sign-in, by which point the account exists and the only way back in
            is a reset. Cheaper to ask twice. */}
        <PasswordField
          id="confirmPassword"
          label={t('register.confirmPassword')}
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          registration={register('confirmPassword')}
        />

        {/* Disabled in flight: registration shares the 20/min/IP credential
            bucket, and a double-submit spends two of them — or races two
            accounts onto one phone number. */}
        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {t('register.submit')}
        </Button>

        <p className="text-center text-xs text-muted-foreground">{t('register.terms')}</p>
      </form>
    </AuthShell>
  );
}
