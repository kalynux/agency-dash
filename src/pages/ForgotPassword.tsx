import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MailCheck } from 'lucide-react';

import { AuthError, AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/auth.service';
import { getApiErrorMessage } from '@/lib/errors';
import {
  buildForgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '@/lib/validation-schemas';

/**
 * Request a password-reset link.
 *
 * Two properties of this screen are load-bearing:
 *
 * 1. **The response is never branched on.** `POST /auth/forgot-password` answers
 *    200 whether or not the account exists, deliberately. Showing a different
 *    screen for "no such account" would rebuild the account-enumeration oracle
 *    the backend went out of its way not to be — so there is one confirmation,
 *    shown every time.
 * 2. **The reset itself finishes in a browser, not here.** The emailed link
 *    lands on the web app. Bringing it in-app needs deep links (Phase 4), and
 *    the flow works without them: reset, then come back and sign in.
 *
 * Worth knowing when the copy is revisited: a completed reset signs out every
 * other device. That is intended, and it is the kind of thing a user would
 * rather read before it happens than discover after.
 */
export function ForgotPassword() {
  const { t } = useTranslation('auth');
  const [apiError, setApiError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const schema = useMemo(() => buildForgotPasswordSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '' },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setApiError(null);
    try {
      await authService.forgotPassword(values.identifier);
      setSent(true);
    } catch (err) {
      // Only transport-level and malformed-input failures land here — a 400
      // says the identifier is not a well-formed address or number, which the
      // caller can see for themselves and which reveals nothing about accounts.
      setApiError(getApiErrorMessage(err));
    }
  };

  const backToSignIn = (
    <Link to="/login" className="font-medium text-primary hover:underline">
      {t('forgot.backToSignIn')}
    </Link>
  );

  if (sent) {
    return (
      <AuthShell title={t('forgot.sentTitle')} footer={backToSignIn}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <MailCheck className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">{t('forgot.sentDescription')}</p>
          <p className="text-xs text-muted-foreground">{t('forgot.sentHint')}</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('forgot.title')} subtitle={t('forgot.subtitle')} footer={backToSignIn}>
      <AuthError message={apiError} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="identifier">{t('forgot.identifier')}</Label>
          {/* Plain text, not `type="email"`: a phone number is equally valid
              here and the browser would mark one of them invalid. */}
          <Input
            id="identifier"
            type="text"
            autoComplete="username"
            autoFocus
            aria-invalid={Boolean(errors.identifier)}
            aria-describedby={errors.identifier ? 'identifier-error' : 'identifier-hint'}
            {...register('identifier')}
          />
          {errors.identifier ? (
            <p id="identifier-error" role="alert" className="text-xs text-destructive">
              {errors.identifier.message}
            </p>
          ) : (
            <p id="identifier-hint" className="text-xs text-muted-foreground">
              {t('forgot.identifierHint')}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {t('forgot.submit')}
        </Button>
      </form>
    </AuthShell>
  );
}
