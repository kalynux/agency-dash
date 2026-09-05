import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Fingerprint, Loader2, ScanEye, ScanFace } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { AppLogo } from '@/components/common/AppLogo';
import { Button } from '@/components/ui/button';
import {
  OUTCOME_MESSAGE,
  UNLOCK_LABEL_KEY,
  isBiometricUnlockEnabled,
  relock,
  unlockWithBiometrics,
} from '@/lib/biometricUnlock';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { getBiometryInfo, type BiometryKind } from '@/platform/biometrics';
import { onAppResume } from '@/platform/shell/appState';

/**
 * How long the app has to be in the background before returning to it means
 * unlocking again.
 *
 * Two minutes, not two seconds. Glancing at a notification, copying a code out
 * of an SMS and switching back to check a map are all normal parts of using
 * this app, and a lock screen after each one trains people to turn the feature
 * off. Two minutes is past the point where the phone is plausibly still in the
 * same hand.
 *
 * Excursions the app itself starts — the biometric prompt, the camera, the
 * gallery — do not count at all; they suspend the watch outright
 * (`suspendAppStateWatch`), because the round trip is our doing rather than the
 * user's absence. The in-app browser deliberately does NOT: `Browser.open`
 * resolves when the tab opens rather than when it closes, so there is no
 * honest moment to release the suspension, and the timer is the safer default.
 */
const LOCK_AFTER_MS = 120_000;

const ICON: Record<BiometryKind, LucideIcon> = {
  fingerprint: Fingerprint,
  face: ScanFace,
  iris: ScanEye,
  none: Fingerprint,
};

/**
 * Re-locks a signed-in app after it has been away, and covers it until the user
 * proves who they are.
 *
 * An overlay rather than a route, and that is the whole design. Navigating to a
 * lock screen would unmount whatever the user was doing — a half-filled stock
 * request, a shipment sheet mid-assignment — and hand it back as an empty
 * dashboard, which turns a security feature into data loss. Covering the app
 * leaves every screen exactly where it was.
 *
 * Renders nothing when the feature is off, when nobody is signed in, or on the
 * web, where `onAppResume` never fires.
 */
export function BiometricAppLock() {
  const { t } = useTranslation('auth');
  const { session, logout } = useOnboarding();
  const [locked, setLocked] = useState(false);
  const [kind, setKind] = useState<BiometryKind>('fingerprint');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read inside the resume handler, which is registered once and must see the
  // *current* answer — not the one that was true when it was registered. Kept
  // in step from an effect rather than assigned during render, which is not a
  // safe place to write a ref.
  const signedIn = useRef(false);
  useEffect(() => {
    signedIn.current = session !== null;
  }, [session]);

  useEffect(() => {
    return onAppResume((awayMs) => {
      if (awayMs < LOCK_AFTER_MS) return;
      if (!signedIn.current || !isBiometricUnlockEnabled()) return;
      // Forget the launch unlock too: if the app is re-locked, the next gate
      // has to ask again rather than trust a proof from an hour ago.
      relock();
      setError(null);
      setLocked(true);
    });
  }, []);

  const attemptUnlock = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await unlockWithBiometrics();
      if (outcome === 'ok') {
        setLocked(false);
        return;
      }
      // Notably including `'unavailable'`: unlike the launch gate, this one
      // cannot fail open. The session is already restored and on screen behind
      // the cover, so letting a device that has lost its sensor through would
      // be handing over exactly what the lock exists to withhold. The way out
      // is the sign-out button below.
      const key = OUTCOME_MESSAGE[outcome];
      if (key) setError(t(key));
    } finally {
      setBusy(false);
    }
  }, [t]);

  // Prompt as soon as the cover goes up, so the common case — come back, touch
  // the sensor, carry on — costs no taps at all. The button below is for the
  // second attempt and for anyone who dismissed the first prompt.
  //
  // The ref makes that "once per lock" rather than "once per effect run":
  // `attemptUnlock` is rebuilt whenever `t` changes identity, and a second
  // automatic prompt stacked on the one already on screen is an OS dialog the
  // user cannot dismiss in one go.
  const autoPrompted = useRef(false);
  useEffect(() => {
    if (!locked) {
      autoPrompted.current = false;
      return;
    }
    if (autoPrompted.current) return;
    autoPrompted.current = true;
    void getBiometryInfo().then((info) => setKind(info.kind));
    void attemptUnlock();
  }, [locked, attemptUnlock]);

  if (!locked) return null;

  const Icon = ICON[kind];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('biometric.locked.title')}
      // Above sonner's toasts, which sit at 999999 and would otherwise be the
      // one thing capable of painting app content over the cover. Every other
      // layer in the app tops out at z-50.
      className="fixed inset-0 z-[1000000] flex flex-col items-center justify-center gap-6 bg-background px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <AppLogo size="lg" className="shadow-sm" />

      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold tracking-tight">{t('biometric.locked.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('biometric.locked.subtitle')}</p>
      </div>

      <div className="w-full max-w-xs space-y-3">
        <Button
          type="button"
          className="w-full gap-2"
          onClick={() => void attemptUnlock()}
          disabled={busy}
          autoFocus
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
          {t(UNLOCK_LABEL_KEY[kind])}
        </Button>

        {error && (
          <p role="alert" className="text-center text-xs text-destructive">
            {error}
          </p>
        )}

        {/* The escape hatch, and the only one. It signs out for real — tokens
            destroyed — so it is a way *past* the lock that concedes nothing.
            Without it, a sensor that stops working strands the user in an
            app they cannot leave. */}
        <Button
          type="button"
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={() => {
            setLocked(false);
            void logout();
          }}
        >
          {t('biometric.locked.usePassword')}
        </Button>
      </div>
    </div>
  );
}
