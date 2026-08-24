import { useTranslation } from 'react-i18next';
import { Fingerprint, Loader2, ScanEye, ScanFace } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  OPT_IN_LABEL_KEY,
  SIGN_IN_LABEL_KEY,
  type BiometricSignInStatus,
} from '@/lib/biometricUnlock';
import type { BiometryKind } from '@/platform/biometrics';

/** Kind → icon. Exhaustive, so a new biometry type is a compile error not a blank. */
const ICON: Record<BiometryKind, LucideIcon> = {
  fingerprint: Fingerprint,
  face: ScanFace,
  iris: ScanEye,
  none: Fingerprint,
};

/**
 * The opt-in, offered **on the sign-in form** and nowhere else.
 *
 * It has to be here, and only here, because this is the one screen in the app
 * where the password is in hand — and a credential can only be stored after it
 * has been proven to work against the server. Settings → Security can turn the
 * feature off, but it cannot turn it on: it would be storing a password nobody
 * has typed.
 *
 * Rendered inside the form, between the password field and the submit button,
 * because that is what it modifies: ticking it changes what pressing "Sign in"
 * does. It is not a second way in — that is the button below the form.
 */
export function BiometricOptIn({
  kind,
  checked,
  onCheckedChange,
  disabled,
}: {
  kind: BiometryKind;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('auth');

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-3">
      <Checkbox
        id="biometric-opt-in"
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="space-y-0.5">
        <Label htmlFor="biometric-opt-in" className="cursor-pointer font-medium">
          {t(OPT_IN_LABEL_KEY[kind])}
        </Label>
        {/* Says where the password goes and what releases it. This is the one
            place someone decides to hand a password to the device, and "trust
            us" is not an answer they can weigh. */}
        <p className="text-xs text-muted-foreground">{t('biometric.optInHint')}</p>
      </div>
    </div>
  );
}

/**
 * "Sign in with your fingerprint" — the shortcut past the password form.
 *
 * **After the form, not before it.** It is a shortcut *past* the fields, so it
 * belongs after the thing it is a shortcut past, and on a handset that is also
 * where the thumb already is. Above the form it pushed the phone/email tabs and
 * the password field down the screen for the one case that needs them most: the
 * person whose fingerprint has just been rejected, for whom the form is the only
 * way in.
 *
 * The prompt is never raised automatically on mount. Someone opening the app to
 * sign in as a different person — a shared phone, a staff handover — would have
 * to dismiss an unasked-for dialog first, and an unexplained system prompt on
 * launch reads as something having gone wrong.
 *
 * Presentational: the parent owns the status and the unlock, because the same
 * status also decides whether the opt-in above renders, and one native round
 * trip should answer both.
 */
export function BiometricSignInButton({
  status,
  busy,
  error,
  onUnlock,
}: {
  status: BiometricSignInStatus;
  busy: boolean;
  error: string | null;
  onUnlock: () => void;
}) {
  const { t } = useTranslation('auth');
  const Icon = ICON[status.kind];

  return (
    <div className="mt-5 space-y-3">
      {/* A rule, not a heading: the password form above and the button below are
          alternatives, and a heading would read as two halves of one form that
          both have to be filled in. */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('biometric.or')}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-12 w-full justify-center gap-2 border-primary/30 text-base font-semibold text-primary hover:bg-primary/5 hover:text-primary"
        onClick={onUnlock}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Icon className="size-5" aria-hidden />
        )}
        {t(SIGN_IN_LABEL_KEY[status.kind])}
      </Button>

      {/* Whose account the thumb opens. Absent on the stored-session path, which
          knows a token pair is there but not who it belongs to — and a phone
          more than one person uses is exactly where guessing would be worst. */}
      {status.identifier && (
        <p className="text-center text-xs text-muted-foreground">
          {t('biometric.asAccount', { identifier: status.identifier })}
        </p>
      )}

      {error && (
        <p role="alert" className="text-center text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
