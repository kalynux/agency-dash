import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { registerPushDevice, unregisterPushDevice } from '@/lib/pushDevice';
import {
  getPushPermission,
  pushSupported,
  readCachedPushToken,
  requestPushPermission,
  subscribePushTokenRotation,
} from '@/platform/push';

/**
 * A host that has Firebase Cloud Messaging configured exposes a token provider
 * on the window so this dashboard can register the device without bundling the
 * Firebase SDK or its (deployment-specific) config here. It must resolve to a
 * current FCM registration token, or null.
 *
 * Two providers fill it, never both: `lib/push.ts` on the web build, and
 * `platform/push.ts` on a device (CAPACITOR-PLAN.md → P4.1).
 */
type PushTokenProvider = () => Promise<string | null>;

declare global {
  interface Window {
    wiMallGetPushToken?: PushTokenProvider;
  }
}

export type PushStatus =
  | 'unsupported' // no push capability in this runtime
  | 'unconfigured' // supported, but no FCM token provider on the host
  | 'default' // permission not yet requested
  | 'denied' // user blocked notifications
  | 'granted' // permission granted, not registered on this device
  | 'registered'; // token registered with the backend

/**
 * Manages push permission + FCM device registration
 * (POST/DELETE /api/agency/devices). We never invent a token — registration
 * only happens once the host's provider yields a real one.
 *
 * Permission, support and the token cache are all read from `@/platform/push`
 * rather than from `Notification` and `localStorage` directly: none of those
 * browser APIs exists in an Android WebView, so the inline versions this hook
 * used to carry reported push as unsupported on the one platform Phase 4 is
 * for. The platform module falls back to exactly them on web.
 */
export function usePushRegistration() {
  const { t } = useTranslation('settings');
  const supported = pushSupported;
  const hasProvider = typeof window !== 'undefined' && typeof window.wiMallGetPushToken === 'function';

  const [status, setStatus] = useState<PushStatus>('default');
  const [isBusy, setIsBusy] = useState(false);

  const resolveStatus = useCallback(async (): Promise<PushStatus> => {
    if (!supported) return 'unsupported';
    const permission = await getPushPermission();
    if (permission === 'denied') return 'denied';
    if (permission === 'prompt') return hasProvider ? 'default' : 'unconfigured';
    // granted
    if (!hasProvider) return 'unconfigured';
    return (await readCachedPushToken()) ? 'registered' : 'granted';
  }, [supported, hasProvider]);

  const syncStatus = useCallback(async () => {
    setStatus(await resolveStatus());
  }, [resolveStatus]);

  useEffect(() => {
    void syncStatus();
  }, [syncStatus]);

  const enable = useCallback(async () => {
    if (!supported || !window.wiMallGetPushToken) {
      void syncStatus();
      return;
    }
    setIsBusy(true);
    try {
      // Prompting happens here and nowhere else — a permission sheet at startup,
      // before the user has seen what the app does, is how an app gets a
      // permanent "Don't allow".
      const permission = await requestPushPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'default');
        return;
      }
      const token = await window.wiMallGetPushToken();
      if (!token) {
        toast.error(t('notifications.push.toastTokenFailed'));
        setStatus('granted');
        return;
      }
      await registerPushDevice(token);
      setStatus('registered');
      toast.success(t('notifications.push.toastEnabled'));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  }, [supported, syncStatus, t]);

  const disable = useCallback(async () => {
    setIsBusy(true);
    try {
      await unregisterPushDevice();
      await syncStatus();
      toast.success(t('notifications.push.toastDisabled'));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  }, [syncStatus, t]);

  // FCM rotates tokens on its own schedule — a restore onto a new device, a
  // data clear, sometimes an update — and announces the new one whenever the app
  // is running, including shortly after a launch that follows a rotation. Left
  // unhandled the backend keeps sending to the old token, which accepts every
  // send and delivers nothing: push looks enabled and silently is not.
  //
  // Only a device that is actually registered re-registers. A null cache means
  // push is off here, and quietly turning it back on is not this hook's call.
  useEffect(
    () =>
      subscribePushTokenRotation((token) => {
        void (async () => {
          const registered = await readCachedPushToken();
          if (!registered || registered === token) return;
          try {
            await registerPushDevice(token);
          } catch (err) {
            console.error('[push] could not re-register a rotated token', err);
          }
        })();
      }),
    [],
  );

  return { supported, hasProvider, status, isBusy, enable, disable };
}
