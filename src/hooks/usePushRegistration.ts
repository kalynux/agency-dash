import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { notificationsService } from '@/services/notifications.service';
import { getApiErrorMessage } from '@/lib/errors';

const TOKEN_STORAGE_KEY = 'agency:pushToken';

/**
 * A host that has Firebase Cloud Messaging configured exposes a token provider
 * on the window so this dashboard can register the device without bundling the
 * Firebase SDK or its (deployment-specific) config here. It must resolve to a
 * current FCM registration token, or null.
 */
type PushTokenProvider = () => Promise<string | null>;

declare global {
  interface Window {
    joviGetPushToken?: PushTokenProvider;
  }
}

export type PushStatus =
  | 'unsupported' // no Notification API in this browser
  | 'unconfigured' // supported, but no FCM token provider on the host
  | 'default' // permission not yet requested
  | 'denied' // user blocked notifications
  | 'granted' // permission granted, not registered on this device
  | 'registered'; // token registered with the backend

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Manages browser push permission + FCM device registration
 * (POST/DELETE /api/agency/devices). We never invent a token — registration
 * only happens once the host's provider yields a real one.
 */
export function usePushRegistration() {
  const { t } = useTranslation('settings');
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const hasProvider = typeof window !== 'undefined' && typeof window.joviGetPushToken === 'function';

  const [status, setStatus] = useState<PushStatus>('default');
  const [isBusy, setIsBusy] = useState(false);

  const resolveStatus = useCallback((): PushStatus => {
    if (!supported) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission === 'default') return hasProvider ? 'default' : 'unconfigured';
    // granted
    if (!hasProvider) return 'unconfigured';
    return readStoredToken() ? 'registered' : 'granted';
  }, [supported, hasProvider]);

  useEffect(() => {
    setStatus(resolveStatus());
  }, [resolveStatus]);

  const enable = useCallback(async () => {
    if (!supported || !window.joviGetPushToken) {
      setStatus(resolveStatus());
      return;
    }
    setIsBusy(true);
    try {
      const permission =
        Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'default');
        return;
      }
      const token = await window.joviGetPushToken();
      if (!token) {
        toast.error(t('notifications.push.toastTokenFailed'));
        setStatus('granted');
        return;
      }
      await notificationsService.registerDevice({
        token,
        platform: 'web',
        userAgent: navigator.userAgent,
      });
      try {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } catch {
        /* ignore */
      }
      setStatus('registered');
      toast.success(t('notifications.push.toastEnabled'));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  }, [supported, resolveStatus, t]);

  const disable = useCallback(async () => {
    const token = readStoredToken();
    setIsBusy(true);
    try {
      if (token) await notificationsService.unregisterDevice(token);
      try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setStatus(resolveStatus());
      toast.success(t('notifications.push.toastDisabled'));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  }, [resolveStatus, t]);

  return { supported, hasProvider, status, isBusy, enable, disable };
}
