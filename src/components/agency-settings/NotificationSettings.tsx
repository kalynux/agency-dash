import { Mail, BellRing, CheckCircle2, Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AsyncBoundary } from '@/components/common/state-views';
import { TelegramLinkCard } from '@/components/agency-settings/notifications/TelegramLinkCard';
import { WhatsappLinkCard } from '@/components/agency-settings/notifications/WhatsappLinkCard';
import { useResource } from '@/hooks/useResource';
import { useActionRunner } from '@/hooks/useActionRunner';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { notificationsService } from '@/services/notifications.service';
import { authService } from '@/services/auth.service';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import type {
  NotificationEventKey,
  NotificationEventPreferences,
  UpdateNotificationPreferencesPayload,
} from '@/types/notification.types';

const EVENTS: { key: NotificationEventKey; label: string; description: string }[] = [
  { key: 'shipmentAssigned', label: 'New shipments', description: 'When a vendor dispatches an order to your agency.' },
  { key: 'connectionUpdated', label: 'Vendor connections', description: 'Requests, approvals, rejections and reapproval prompts from vendors.' },
  { key: 'payoutUpdates', label: 'Payout updates', description: 'When your payout request is created, paid or rejected.' },
  {
    key: 'codDepositUpdates',
    label: 'COD cash updates',
    description: 'Agent hand-over declarations you must answer, and direct-to-platform payments.',
  },
];

const PUSH_MESSAGE: Record<string, string> = {
  unsupported: 'This browser does not support push notifications.',
  unconfigured: 'Push messaging is not configured for this deployment.',
  denied: 'Notifications are blocked in your browser settings.',
};

export function NotificationSettings() {
  const { session } = useOnboarding();
  const agencyEmail = session?.role_entity.email ?? '';

  const prefs = useResource(() => notificationsService.getPreferences().then((r) => r.data), []);
  const { run, pendingKey } = useActionRunner();
  const push = usePushRegistration();

  const patchPrefs = async (payload: UpdateNotificationPreferencesPayload, key: string) => {
    const result = await run(key, () => notificationsService.updatePreferences(payload), { success: 'Preferences updated.' });
    if (result) prefs.setData(result.data);
  };

  const setChannel = (channel: 'email' | 'telegram' | 'whatsapp', enabled: boolean) => {
    const payload: UpdateNotificationPreferencesPayload =
      channel === 'email'
        ? { emailEnabled: enabled }
        : channel === 'telegram'
          ? { telegramEnabled: enabled }
          : { whatsappEnabled: enabled };
    return patchPrefs(payload, `channel:${channel}`);
  };

  const setEvent = (key: NotificationEventKey, value: boolean) =>
    patchPrefs({ preferences: { [key]: value } as Partial<NotificationEventPreferences> }, `event:${key}`);

  const resendEmailVerification = () =>
    run('email-verify', () => authService.sendEmailVerification(), { success: 'Verification email sent.' });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Choose how you want to be notified and for which events</CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncBoundary isLoading={prefs.isLoading} error={prefs.error} onRetry={prefs.refetch}>
          {prefs.data && (
            <div className="space-y-8">
              {/* Channels */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Delivery channels</h4>
                  <p className="text-sm text-muted-foreground">
                    In-app is always on. At most one secondary channel can be active at a time —
                    enabling one turns the others off.
                  </p>
                </div>

                {/* Email */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-card gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="p-2 bg-primary/10 rounded-full flex-shrink-0">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">Email</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-muted-foreground truncate">{agencyEmail || 'No email on file'}</p>
                        {prefs.data.emailVerified ? (
                          <Badge variant="outline" className="text-green-600 border-green-200 gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </Badge>
                        ) : (
                          agencyEmail && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              disabled={pendingKey === 'email-verify'}
                              onClick={resendEmailVerification}
                            >
                              {pendingKey === 'email-verify' ? 'Sending…' : 'Verify email'}
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={prefs.data.emailEnabled}
                    disabled={!prefs.data.emailVerified || pendingKey === 'channel:email'}
                    onCheckedChange={(v) => setChannel('email', v)}
                  />
                </div>

                <TelegramLinkCard
                  enabled={prefs.data.telegramEnabled}
                  verified={prefs.data.telegramVerified}
                  togglePending={pendingKey === 'channel:telegram'}
                  onToggle={(v) => setChannel('telegram', v)}
                  onLinkChanged={prefs.refetch}
                />

                <WhatsappLinkCard
                  enabled={prefs.data.whatsappEnabled}
                  verified={prefs.data.whatsappVerified}
                  togglePending={pendingKey === 'channel:whatsapp'}
                  onToggle={(v) => setChannel('whatsapp', v)}
                  onLinkChanged={prefs.refetch}
                />
              </div>

              <Separator />

              {/* Push */}
              <div className="space-y-4">
                <h4 className="font-medium">Push notifications</h4>
                <div className="flex items-center justify-between p-4 border rounded-lg bg-card gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="p-2 bg-primary/10 rounded-full flex-shrink-0">
                      <Smartphone className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">This device</p>
                      <p className="text-sm text-muted-foreground">
                        {push.status === 'registered'
                          ? 'Push is enabled on this device.'
                          : PUSH_MESSAGE[push.status] ?? 'Get delivery and cash alerts even when the dashboard is closed.'}
                      </p>
                    </div>
                  </div>
                  {push.status === 'registered' ? (
                    <Button variant="outline" size="sm" disabled={push.isBusy} onClick={push.disable}>
                      {push.isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disable'}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={push.isBusy || push.status === 'unsupported' || push.status === 'unconfigured' || push.status === 'denied'}
                      onClick={push.enable}
                    >
                      {push.isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable'}
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* Events */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <BellRing className="w-4 h-4" /> Notification events
                </h4>
                <div className="space-y-3">
                  {EVENTS.map((event) => (
                    <div key={event.key} className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{event.label}</p>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                        {event.key === 'codDepositUpdates' && (
                          <p className="text-xs text-amber-600 mt-1">
                            Turning this off does not stop the 2-day clock — an unanswered declaration
                            still freezes your rolling-reserve releases.
                          </p>
                        )}
                      </div>
                      <Switch
                        checked={prefs.data!.preferences[event.key]}
                        disabled={pendingKey === `event:${event.key}`}
                        onCheckedChange={(v) => setEvent(event.key, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </AsyncBoundary>
      </CardContent>
    </Card>
  );
}
