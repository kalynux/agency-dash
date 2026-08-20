import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Fingerprint, Loader2, ScanEye, ScanFace } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  OUTCOME_MESSAGE,
  SIGN_IN_LABEL_KEY,
  canOfferBiometricSignIn,
  unlockWithBiometrics,
} from '@/lib/biometricUnlock';
import { getBiometryInfo, type BiometryKind } from '@/platform/biometrics';
import { authService } from '@/services/auth.service';
import { ApiError, type AgencyAuthSession } from '@/types/api';
import { getApiErrorMessage } from '@/lib/errors';

/** Kind → icon. Exhaustive, so a new biometry type is a compile error not a blank. */
const ICON: Record<BiometryKind, LucideIcon> = {
  fingerprint: Fingerprint,
  face: ScanFace,
  iris: ScanEye,
  none: Fingerprint,
};

interface BiometricSignInButtonProps {
  /** Called with the restored session. The caller owns where to navigate next. */
  onSession: (session: AgencyAuthSession) => void;
}

/**
 * "Sign in with fingerprint" — shown on the sign-in screen only when there is
 * actually something for it to unlock.
 *
 * That condition is doing real work. On the bearer transport a returning user's
 * tokens are already in the Keystore, so this button is not a second way to
 * authenticate; it is the way past the biometric gate that `passesLaunchGate()`
 * put in front of them (see `lib/biometricUnlock.ts`). After an explicit
 * sign-out there are no tokens, `canOfferBiometricSignIn()` is false, and the
 * screen is a plain password form again — which is exactly what a sign-out
 * should mean.
 *
 * Renders nothing at all when unavailable, rather than a disabled button: on
 * every desktop browser and on every device with no enrolled finger this is not
 * a feature that is temporarily off, it is one that does not exist.
 */
export function BiometricSignInButton({ onSession }: BiometricSignInButtonProps) {
  const { t } = useTranslation('auth');
  const [kind, setKind] = useState<BiometryKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Availability is a native round trip, so it is resolved once on mount and
  // the button stays absent until the answer is in — a button that appears and
  // then vanishes is worse than one that arrives a frame late.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!(await canOfferBiometricSignIn())) return;
      const info = await getBiometryInfo();
      if (!cancelled) setKind(info.kind);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing to unlock and nothing to explain — the whole feature is absent.
  if (kind === null && error === null) return null;

  const onClick = async () => {
    setError(null);
    setBusy(true);
    try {
      const outcome = await unlockWithBiometrics();
      if (outcome !== 'ok') {
        const key = OUTCOME_MESSAGE[outcome];
        if (key) setError(t(key));
        return;
      }

      // The same call the cold-start path makes, and the one that re-issues
      // both tokens at full lifetime — so unlocking also slides the 30-day
      // window forward instead of living off the token that was already there.
      const res = await authService.getAuthMeAgency();
      onSession(res.data);
    } catch (err) {
      // The saved session died while it sat there — revoked by a password
      // change on another device, or simply older than 30 days. Nothing a
      // fingerprint can fix, so retire the button and point at the form below.
      if (err instanceof ApiError && err.isUnauthorized) {
        setKind(null);
        setError(t('biometric.error.expired'));
        return;
      }
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const Icon = kind === null ? Fingerprint : ICON[kind];

  return (
    <div className="mb-4 space-y-3">
      {kind !== null && (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => void onClick()}
          disabled={busy}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
          {t(SIGN_IN_LABEL_KEY[kind])}
        </Button>
      )}

      {error && (
        <p role="alert" className="text-center text-xs text-destructive">
          {error}
        </p>
      )}

      {kind !== null && (
        // A labelled rule rather than a bare one: the form below is the
        // fallback, and saying so is cheaper than making people infer it.
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t('biometric.or')}
          <span className="h-px flex-1 bg-border" />
        </div>
      )}
    </div>
  );
}
