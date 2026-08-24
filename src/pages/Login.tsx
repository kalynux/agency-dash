import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { AuthError, AuthLink, AuthShell } from '@/components/auth/AuthShell';
import { FieldLabel, FieldMessage, PasswordField } from '@/components/auth/AuthFields';
import { BiometricOptIn, BiometricSignInButton } from '@/components/auth/BiometricSignIn';
import { PhoneInput } from '@/components/common/PhoneInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authService } from '@/services/auth.service';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { getApiErrorMessage } from '@/lib/errors';
import {
  OUTCOME_MESSAGE,
  biometricSignInStatus,
  enableBiometricSignIn,
  forgetBiometricSignIn,
  unlockForSignIn,
  type BiometricSignInStatus,
} from '@/lib/biometricUnlock';
import { buildLoginSchema, type LoginFormValues } from '@/lib/validation-schemas';
import { ApiError, type AgencyAuthSession } from '@/types/api';

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
 *
 * ── Fingerprint sign-in ──────────────────────────────────────────────────────
 *
 * Two surfaces, both absent unless the device actually has enrolled biometry
 * (`biometricSignInStatus`, which answers "no" on the web):
 *
 *   - a **button below the form** once there is something to unlock — the fast
 *     path, and the reason the feature exists;
 *   - an **opt-in checkbox inside the form** when there is not — offered here,
 *     on the one screen where the password is in hand, because a credential can
 *     only be stored after it has been proven to work against the server.
 *
 * Never both at once: the checkbox asks to turn on the thing the button already
 * is. `biometricSignInStatus()` resolves which, in one native round trip, and
 * this screen owns that state because both controls read it.
 */
export function Login() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const { session, adoptSession } = useOnboarding();
  const [apiError, setApiError] = useState<string | null>(null);

  /** `null` until the native round trip answers — neither control renders yet. */
  const [biometry, setBiometry] = useState<BiometricSignInStatus | null>(null);
  /** The opt-in on *this* sign-in. Only meaningful while `canOptIn` is true. */
  const [remember, setRemember] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  // Rebuilt on a language switch so field errors follow the UI.
  const schema = useMemo(() => buildLoginSchema(t), [t]);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier_type: 'phone', identifier: '', password: '' },
  });

  // `useWatch`, not `watch()` — the latter returns a fresh function every render
  // and the React Compiler refuses to memoize a component that calls it.
  const identifierType = useWatch({ control, name: 'identifier_type' });

  // Resolved once on mount and never re-polled: a control that appears and then
  // vanishes mid-form is worse than one that arrives a frame late.
  useEffect(() => {
    let cancelled = false;
    void biometricSignInStatus().then((status) => {
      if (!cancelled) setBiometry(status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Install a session and go wherever it belongs. Shared by the password form
   * and the biometric button — both arrive holding the same envelope, and the
   * routing rule below is the part that must not diverge between them.
   */
  const enterWith = (session: AgencyAuthSession) => {
    const step = session.role_entity.onboarding_step;
    adoptSession(session);

    // A guard that bounced someone here stashed where they were going. Honour
    // it only once onboarding is finished — an unfinished agency has exactly
    // one legal destination and it is not their bookmark.
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    const target =
      step === 0 ? (from && !from.startsWith('/login') ? from : '/dashboard') : '/onboarding';
    navigate(target, { replace: true });
  };

  const onSubmit = async (values: LoginFormValues) => {
    setApiError(null);
    // Built explicitly rather than by rest-spread, so `identifier_type` — a UI
    // concern — cannot leak onto the wire or into the Keystore.
    const credential = { identifier: values.identifier, password: values.password };

    try {
      const res = await authService.login(credential);

      // A *different* account just signed in on this phone. The biometric gate
      // proves "someone enrolled on this device", not "the person who saved
      // this credential" — so on a handset with more than one finger enrolled,
      // leaving the previous credential behind would let whoever holds the
      // phone next open an account that is not theirs.
      if (biometry?.identifier && biometry.identifier !== credential.identifier) {
        await forgetBiometricSignIn();
      }

      // Only after the server has accepted it. Storing an unverified password
      // would leave someone unable to tell a wrong password from a broken
      // sensor on every future launch.
      if (remember && biometry?.canOptIn) {
        const outcome = await enableBiometricSignIn(credential);
        if (outcome === 'ok') toast.success(t('biometric.optInDone'));
        // A cancel is a decision, not a fault — they dismissed the dialog and
        // know they did. Anything else means the switch did not flip and they
        // would otherwise find out on the next launch.
        else if (outcome !== 'cancelled') toast.error(t('biometric.optInFailed'));
      }

      enterWith(res.data);
    } catch (err) {
      // Covers the 429 too: the credential bucket is 20/min/IP, and
      // `getApiErrorMessage` interpolates `Retry-After` into the copy. A 429 is
      // NOT a sign-out — see api.ts → classifyAuthError.
      setApiError(getApiErrorMessage(err));
    }
  };

  const onBiometricSignIn = async () => {
    setBiometricError(null);
    setUnlocking(true);
    try {
      const unlock = await unlockForSignIn();

      if (!unlock.ok) {
        const key = OUTCOME_MESSAGE[unlock.outcome];
        if (key) setBiometricError(t(key));
        // Biometry is gone from the device — `unlockForSignIn` has already
        // dropped the credential, so retire the button rather than leave one
        // that can only fail.
        if (unlock.outcome === 'unavailable') {
          setBiometry((prev) => (prev ? { ...prev, offer: false, canOptIn: false } : prev));
        }
        return;
      }

      try {
        // A stored credential signs in from scratch; without one there is a
        // token pair in the Keystore that the gate bounced us off, and
        // `getAuthMeAgency` is the same call the cold-start path makes — which
        // also re-issues both tokens at full lifetime, sliding the 30-day
        // window forward instead of living off the token that was already there.
        const res = unlock.credential
          ? await authService.login(unlock.credential)
          : await authService.getAuthMeAgency();
        enterWith(res.data);
      } catch (err) {
        // The stored credential is stale — a password changed on another device
        // revokes it — or the saved session is simply older than 30 days.
        // Nothing a fingerprint can fix, so the feature retires itself and says
        // why; re-prompting a thumb against a dead credential is a loop.
        if (err instanceof ApiError && err.isUnauthorized) {
          await forgetBiometricSignIn();
          setBiometry((prev) => (prev ? { ...prev, offer: false, canOptIn: true } : prev));
          setBiometricError(t('biometric.error.expired'));

          // Half the form is already known — carry it over so only the part
          // that actually changed has to be typed. The tab has to follow it: an
          // email dropped into the phone field would fail validation for a
          // reason that has nothing to do with why they are back here.
          if (unlock.credential) {
            const mode = unlock.credential.identifier.includes('@') ? 'email' : 'phone';
            setValue('identifier_type', mode);
            setValue('identifier', unlock.credential.identifier);
            setFocus('password');
          }
          return;
        }
        setBiometricError(getApiErrorMessage(err));
      }
    } finally {
      setUnlocking(false);
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

  const isPhone = identifierType === 'phone';
  const busy = isSubmitting || unlocking;

  return (
    <AuthShell
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      footer={
        <>
          {t('login.noAccount')} <AuthLink to="/register">{t('login.createAccount')}</AuthLink>
        </>
      }
    >
      <AuthError message={apiError} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Phone or email — the server takes either in one field, but the two
            need different inputs, so the form asks rather than guesses. Phone
            leads because it is the identifier every agency has: registration
            requires a number and leaves email optional. */}
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
              {/* Height on the list, not the triggers: they are `h-full` by
                  default and sit inside the list's own 1-unit padding. Matched
                  to the 44px fields below it. */}
              <TabsList className="grid h-11 w-full grid-cols-2">
                <TabsTrigger value="phone">{t('login.usePhone')}</TabsTrigger>
                <TabsTrigger value="email">{t('login.useEmail')}</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        />

        <div className="space-y-1.5">
          <FieldLabel htmlFor="identifier" required>
            {isPhone ? t('login.phone') : t('login.email')}
          </FieldLabel>

          <Controller
            control={control}
            name="identifier"
            render={({ field }) =>
              isPhone ? (
                // Emits E.164 directly, so nothing downstream re-normalises.
                <PhoneInput
                  id="identifier"
                  className="h-11"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  hasError={Boolean(errors.identifier)}
                  describedBy="identifier-message"
                />
              ) : (
                <Input
                  id="identifier"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t('login.emailPlaceholder')}
                  className="h-11"
                  aria-invalid={Boolean(errors.identifier)}
                  aria-describedby="identifier-message"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )
            }
          />

          <FieldMessage
            id="identifier-message"
            error={errors.identifier?.message}
            hint={isPhone ? t('login.phoneHint') : t('login.emailHint')}
          />
        </div>

        <PasswordField
          id="password"
          label={t('login.password')}
          placeholder={t('login.passwordPlaceholder')}
          autoComplete="current-password"
          error={errors.password?.message}
          registration={register('password')}
        />

        {/* In the card, under the field it is about, rather than down in the
            page footer beside "create an account": it is a recovery path for the
            form already on screen, not a second destination. */}
        <div className="flex justify-end">
          <AuthLink to="/forgot-password">{t('login.forgotPassword')}</AuthLink>
        </div>

        {biometry?.canOptIn && (
          <BiometricOptIn
            kind={biometry.kind}
            checked={remember}
            onCheckedChange={setRemember}
            disabled={busy}
          />
        )}

        {/* Disabled while in flight: the credential bucket is 20/min/IP and a
            double-submit spends two of them for one sign-in. */}
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {t('login.submit')}
        </Button>
      </form>

      {biometry?.offer && (
        <BiometricSignInButton
          status={biometry}
          busy={busy}
          error={biometricError}
          onUnlock={() => void onBiometricSignIn()}
        />
      )}
    </AuthShell>
  );
}
