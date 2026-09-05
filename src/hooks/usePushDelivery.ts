import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ensureNotificationChannel, subscribeForegroundPush } from '@/platform/push';
import { routeFromPushData } from '@/platform/shell/deepLinks';
import { useNotifications } from '@/store/notifications.store';

/**
 * What has to happen, while the app is running, for a push to be worth sending
 * (CAPACITOR-PLAN.md → P4.1).
 *
 * `usePushRegistration` gets the device a token and `deepLinks.ts` routes a tap.
 * Between those two sits everything that decides whether the notification is
 * seen at all:
 *
 *  1. **The channel exists.** Android delivers into channels, the backend names
 *     one by id on every send, and a channel the device has never heard of is a
 *     silent downgrade rather than an error.
 *  2. **A foreground push is not swallowed.** The OS draws notifications only
 *     for an app that is backgrounded or killed. With the app open, FCM hands
 *     the message to the app and nothing is drawn by anyone — so without this
 *     the first thing anyone tries, phone in hand, is the one case that looks
 *     completely dead.
 *
 * Mounted inside `NotificationsProvider` because it refreshes the list the push
 * is about, and inside the Router because tapping the toast navigates. Both are
 * true only on the dashboard, which is also the only place push can be turned
 * on, so nothing is lost by scoping it there.
 *
 * A no-op in the browser: the platform layer's two entry points both short
 * -circuit off native, and web push is drawn by the service worker in
 * `public/firebase-messaging-sw.js`.
 */
export function usePushDelivery(): void {
  const { t } = useTranslation(['settings', 'common']);
  const navigate = useNavigate();
  const { refetch } = useNotifications();

  // Read through refs so the subscription below is attached exactly once. A
  // resubscribe on every render of a provider this high in the tree is a window
  // in which a push can arrive with nobody listening.
  const latest = useRef({ t, navigate, refetch });
  useEffect(() => {
    latest.current = { t, navigate, refetch };
  });

  // Re-run on a language change: Android renames an existing channel in place,
  // so the agency sees the channel in the language they just picked rather than
  // the one they had when they installed the app.
  useEffect(() => {
    void ensureNotificationChannel(
      t('settings:notifications.push.channelName'),
      t('settings:notifications.push.channelDescription'),
    );
  }, [t]);

  useEffect(
    () =>
      subscribeForegroundPush((push) => {
        // The badge and the list first, and unconditionally — it is the part
        // that still helps if the copy below turns out to be unusable.
        void latest.current.refetch();

        // The `notification` block on a normal send; `data` on a data-only one,
        // where the backend moves the copy there because nothing else would
        // carry it. Handling both means a change of send mode server-side
        // cannot silently blank the toast.
        const payload = (push.data ?? {}) as Record<string, unknown>;
        const text = (value: unknown): string | null =>
          typeof value === 'string' && value.trim() ? value.trim() : null;

        const title = text(push.title) ?? text(payload.title);
        if (!title) return; // nothing to say; the refresh above already happened

        const route = routeFromPushData(push.data);

        toast(title, {
          description: text(push.body) ?? text(payload.body) ?? undefined,
          // Notification copy is rendered by the backend in the agency's
          // `preferred_language`, so only this label is ours to translate.
          action: route
            ? {
                label: latest.current.t('common:actions.view'),
                onClick: () => latest.current.navigate(route),
              }
            : undefined,
        });
      }),
    [],
  );
}
