import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Mail,
  Loader2,
  Lock,
  Smartphone,
  Truck,
  Handshake,
  UserCheck,
  Wallet,
  Banknote,
  CalendarClock,
  HardDrive,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { notificationsService } from '@/services/notifications.service';
import { telegramService, whatsappService } from '@/services/channels.service';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { ChannelSetupDialog } from '@/components/agency-settings/notifications/ChannelSetupDialog';
import { getApiErrorMessage } from '@/lib/errors';
import { ApiError } from '@/types/api';
import type {
  NotificationPreferences,
  NotificationEventKey,
  NotificationEventPreferences,
  DeliveryChannelChoice,
  NotificationChannel,
  PreferredLanguage,
} from '@/types/notification.types';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { InfoHint, SectionHeading } from '@/components/common/InfoHint';
import { UnsavedChangesBar } from '@/components/agency-settings/UnsavedChangesBar';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { cn } from '@/lib/utils';

// ─── Static config ──────────────────────────────────────────────────────────

/** Same heading in all three render states, so loading/error/loaded don't shift. */
const HEADING = (
  <SectionHeading
    title="Notification Preferences"
    description="Choose how, where, and for which events you are notified"
    short="How you're notified"
  />
);

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

const WhatsappIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
  </svg>
);

type ChannelMeta = {
  value: NotificationChannel;
  label: string;
  Icon: (props: { className?: string }) => React.JSX.Element;
  iconWrap: string;
  verifyKey: 'emailVerified' | 'telegramVerified' | 'whatsappVerified';
  /** Whether the link can be removed in-app (email can't be un-verified). */
  unlinkable: boolean;
};

const SECONDARY_CHANNELS: ChannelMeta[] = [
  {
    value: 'telegram',
    label: 'Telegram',
    Icon: TelegramIcon,
    iconWrap: 'bg-[#0088cc]/10 text-[#0088cc]',
    verifyKey: 'telegramVerified',
    unlinkable: true,
  },
  {
    value: 'email',
    label: 'Email',
    Icon: ({ className }) => <Mail className={className} />,
    iconWrap: 'bg-primary/10 text-primary',
    verifyKey: 'emailVerified',
    unlinkable: false,
  },
  {
    value: 'whatsapp',
    label: 'WhatsApp',
    Icon: WhatsappIcon,
    iconWrap: 'bg-[#25D366]/10 text-[#25D366]',
    verifyKey: 'whatsappVerified',
    unlinkable: true,
  },
];

/**
 * `storageAlert` and `contractUpdated` are newer than some deployed backends.
 * Default them to the documented `true` so their switches are never
 * uncontrolled — applied on every read so the dirty-check snapshot and the
 * editable copy always agree.
 */
function withEventDefaults(data: NotificationPreferences): NotificationPreferences {
  // Both are declared required, so leading literal defaults would be dead code
  // to the compiler. Destructure instead: at runtime an older backend omits the
  // keys entirely, and `?? true` is what actually fills them in.
  const { storageAlert, contractUpdated, ...rest } = data.preferences;
  return {
    ...data,
    preferences: {
      ...rest,
      storageAlert: storageAlert ?? true,
      contractUpdated: contractUpdated ?? true,
    },
  };
}

type EventMeta = {
  key: NotificationEventKey;
  label: string;
  description: string;
  /** Extra warning shown under the description, inside the same ⓘ popover. */
  caveat?: string;
  Icon: LucideIcon;
};

const EVENTS: EventMeta[] = [
  { key: 'shipmentAssigned', label: 'New shipments', description: 'When a vendor dispatches an order to your agency.', Icon: Truck },
  { key: 'connectionUpdated', label: 'Vendor connections', description: 'Requests, approvals, rejections and reapproval prompts from vendors.', Icon: Handshake },
  {
    key: 'contractUpdated',
    label: 'Agent contracts',
    description: 'When an agent applies to deliver for you, or accepts or declines a request you sent.',
    Icon: UserCheck,
  },
  { key: 'payoutUpdates', label: 'Payout updates', description: 'When your payout request is created, paid or rejected.', Icon: Wallet },
  {
    key: 'codDepositUpdates',
    label: 'COD cash updates',
    description: 'Agent hand-over declarations you must answer, and direct-to-platform payments.',
    caveat: 'Turning this off does not stop the 2-day clock — an unanswered declaration still freezes your rolling-reserve releases.',
    Icon: Banknote,
  },
  { key: 'planUpdates', label: 'Plan updates', description: 'When your subscription plan is nearing expiry, has expired, or you cross your shipment cap.', Icon: CalendarClock },
  { key: 'storageAlert', label: 'Storage alerts', description: 'When your media storage passes 80%, 90% or 100% of your plan’s limit.', Icon: HardDrive },
];

const LANGUAGES: { value: PreferredLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'pt', label: 'Português' },
  { value: 'es', label: 'Español' },
  { value: 'ar', label: 'العربية' },
];

const ALLOWED_LANGS = LANGUAGES.map((l) => l.value);

const PUSH_MESSAGE: Record<string, string> = {
  unsupported: 'This browser does not support push notifications.',
  unconfigured: 'Push messaging is not configured for this deployment.',
  denied: 'Notifications are blocked in your browser settings.',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** The single active secondary channel, in backend priority order, else in-app. */
function deriveChannel(p: NotificationPreferences): DeliveryChannelChoice {
  if (p.telegramEnabled) return 'telegram';
  if (p.emailEnabled) return 'email';
  if (p.whatsappEnabled) return 'whatsapp';
  return 'in-app';
}

function isVerified(p: NotificationPreferences, channel: NotificationChannel): boolean {
  if (channel === 'telegram') return p.telegramVerified;
  if (channel === 'email') return p.emailVerified;
  return p.whatsappVerified;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function NotificationSettings() {
  const { session, updateAgencyProfile } = useOnboarding();
  const roleEntity = session?.role_entity;
  const agencyEmail = roleEntity?.email ?? '';

  const push = usePushRegistration();

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable local state
  const [channel, setChannel] = useState<DeliveryChannelChoice>('in-app');
  const [events, setEvents] = useState<NotificationEventPreferences | null>(null);
  const [language, setLanguage] = useState<PreferredLanguage>('en');

  // Server snapshots used for dirty-checking
  const [savedChannel, setSavedChannel] = useState<DeliveryChannelChoice>('in-app');
  const [savedLanguage, setSavedLanguage] = useState<PreferredLanguage>('en');

  // Channel setup / management
  const [setupChannel, setSetupChannel] = useState<NotificationChannel | null>(null);
  const [unlinking, setUnlinking] = useState<NotificationChannel | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await notificationsService.getPreferences();
      const normalized = withEventDefaults(data);
      setPrefs(normalized);
      const ch = deriveChannel(data);
      setChannel(ch);
      setSavedChannel(ch);
      setEvents({ ...normalized.preferences });
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Seed language from the agency profile session.
  useEffect(() => {
    const raw = roleEntity?.preferred_language;
    const lang = (raw && ALLOWED_LANGS.includes(raw as PreferredLanguage) ? raw : 'en') as PreferredLanguage;
    setLanguage(lang);
    setSavedLanguage(lang);
  }, [roleEntity?.preferred_language]);

  const eventsDirty = useMemo(() => {
    if (!prefs || !events) return false;
    return EVENTS.some((e) => events[e.key] !== prefs.preferences[e.key]);
  }, [events, prefs]);

  const channelDirty = channel !== savedChannel;
  const languageDirty = language !== savedLanguage;
  const dirty = eventsDirty || channelDirty || languageDirty;

  const toggleEvent = useCallback((key: NotificationEventKey) => {
    setEvents((prev) => (prev ? { ...prev, [key]: !prev[key] } : prev));
  }, []);

  /**
   * Back to the last saved state. `prefs` is the server snapshot the dirty
   * check reads, so restoring from it is exactly what makes the bar disappear —
   * as does toggling an event switch back by hand, which is the same comparison.
   */
  const handleDiscard = useCallback(() => {
    if (prefs) setEvents({ ...prefs.preferences });
    setChannel(savedChannel);
    setLanguage(savedLanguage);
  }, [prefs, savedChannel, savedLanguage]);

  // Pick a secondary channel as active (or unpick → back to in-app only).
  const selectChannel = useCallback((next: DeliveryChannelChoice) => {
    setChannel((cur) => (cur === next ? 'in-app' : next));
  }, []);

  /** Re-fetch preferences; return whether `ch` is now verified (for the dialog). */
  const refreshForChannel = useCallback(
    async (ch: NotificationChannel): Promise<boolean> => {
      const { data } = await notificationsService.getPreferences();
      setPrefs(withEventDefaults(data));
      setSavedChannel(deriveChannel(data));
      return isVerified(data, ch);
    },
    [],
  );

  const handleUnlink = useCallback(
    async (ch: NotificationChannel) => {
      setUnlinking(ch);
      try {
        if (ch === 'telegram') await telegramService.disconnect();
        else if (ch === 'whatsapp') await whatsappService.unlink();
        const { data } = await notificationsService.getPreferences();
        setPrefs(withEventDefaults(data));
        const derived = deriveChannel(data);
        setSavedChannel(derived);
        // If the unlinked channel was the active selection, fall back to in-app.
        setChannel((cur) => (cur === ch ? derived : cur));
        toast.success(`${ch === 'telegram' ? 'Telegram' : 'WhatsApp'} disconnected`);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setUnlinking(null);
      }
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!prefs || !events) return;
    setSaving(true);
    try {
      if (channelDirty || eventsDirty) {
        const { data: updated } = await notificationsService.updatePreferences({
          ...(channelDirty
            ? {
                emailEnabled: channel === 'email',
                telegramEnabled: channel === 'telegram',
                whatsappEnabled: channel === 'whatsapp',
              }
            : {}),
          ...(eventsDirty ? { preferences: events } : {}),
        });
        const normalized = withEventDefaults(updated);
        setPrefs(normalized);
        const ch = deriveChannel(updated);
        setChannel(ch);
        setSavedChannel(ch);
        setEvents({ ...normalized.preferences });
      }

      if (languageDirty) {
        await updateAgencyProfile({ preferred_language: language });
        setSavedLanguage(language);
      }

      toast.success('Notification settings saved');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DELIVERY_AGENCY_NOTIFICATION_CHANNEL_NOT_VERIFIED') {
        toast.error('That channel must be verified before it can be enabled.');
        load();
      } else {
        toast.error(getApiErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }, [prefs, events, channel, channelDirty, eventsDirty, languageDirty, language, updateAgencyProfile, load]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card className={sectionSurfaceClass}>
        {HEADING}
        <CardContent className="space-y-4 max-md:px-0">
          <Skeleton className="h-5 w-40" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (loadError || !prefs || !events) {
    return (
      <Card className={sectionSurfaceClass}>
        {HEADING}
        <CardContent className="space-y-4 max-md:px-0">
          <div role="alert" className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
            {loadError ?? 'Could not load notification settings.'}
          </div>
          <Button variant="outline" onClick={load}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className={sectionSurfaceClass}>
      {HEADING}
      <CardContent className="space-y-8 max-md:px-0">
        {/* Delivery channel */}
        <div className="space-y-4">
          <div>
            <h4 className="flex items-center gap-2 font-medium">
              Delivery channel
              <InfoHint className="md:hidden" label="About delivery channels">
                In-app is always on. Optionally pick one additional channel — connect it first,
                then select it.
              </InfoHint>
            </h4>
            <p className="text-sm text-muted-foreground max-md:hidden">
              In-app is always on. Optionally pick one additional channel — connect it first, then select it.
            </p>
            <p className="text-sm text-muted-foreground md:hidden">In-app is always on.</p>
          </div>

          <div className="space-y-3" role="radiogroup" aria-label="Delivery channel">
            {/* In-app — always on, locked */}
            <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/30">
              <div className="p-2 rounded-full flex-shrink-0 bg-primary/10 text-primary">
                <Bell className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">In-app</p>
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Lock className="w-3 h-3" /> Always on
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Delivered to your dashboard. Cannot be turned off.</p>
              </div>
              <span
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                aria-hidden
              >
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>

            {/* Secondary channels — verify, then select (single choice) */}
            {SECONDARY_CHANNELS.map((c) => {
              const verified = prefs[c.verifyKey];
              const selected = channel === c.value;
              const busy = unlinking === c.value;
              return (
                <div
                  key={c.value}
                  className={cn(
                    'flex items-start gap-3 p-4 border rounded-lg transition-colors',
                    selected && 'border-primary ring-1 ring-primary',
                    !verified && 'bg-muted/20',
                  )}
                >
                  {/* The whole icon + text block is the radio: the dot moved to the
                      corner, so the hit area has to be the card, not the dot. */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`Use ${c.label}`}
                    disabled={!verified}
                    onClick={() => selectChannel(c.value)}
                    className={cn(
                      'flex min-w-0 flex-1 items-start gap-4 rounded-md text-left',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      verified ? 'cursor-pointer' : 'cursor-not-allowed',
                    )}
                  >
                    <span className={cn('p-2 rounded-full flex-shrink-0', c.iconWrap)}>
                      <c.Icon className="w-5 h-5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{c.label}</span>
                        {verified ? (
                          <Badge variant="secondary" className="gap-1 text-xs text-emerald-600">
                            <ShieldCheck className="w-3 h-3" /> Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                            <ShieldAlert className="w-3 h-3" /> Not connected
                          </Badge>
                        )}
                      </span>
                      {c.value === 'email' && verified && agencyEmail ? (
                        <span className="block text-sm text-muted-foreground truncate">{agencyEmail}</span>
                      ) : !verified ? (
                        <span className="block text-sm text-muted-foreground">Connect this channel to use it.</span>
                      ) : selected ? (
                        <span className="block text-sm text-muted-foreground">Selected as your delivery channel.</span>
                      ) : (
                        <span className="block text-sm text-muted-foreground">Tap to use this channel.</span>
                      )}
                    </span>
                  </button>

                  {/* Active indicator (top right) over the connect/disconnect action */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span
                      aria-hidden
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full border transition-colors',
                        selected ? 'border-primary' : 'border-input',
                        !verified && 'opacity-50',
                      )}
                    >
                      {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                    </span>

                    {!verified ? (
                      <Button variant="outline" size="sm" onClick={() => setSetupChannel(c.value)}>
                        Connect
                      </Button>
                    ) : c.unlinkable ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={busy}
                        onClick={() => handleUnlink(c.value)}
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disconnect'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Language */}
        {/* <div className="space-y-3">
          <div>
            <h4 className="font-medium flex items-center gap-2">
              <Languages className="w-4 h-4 text-muted-foreground" />
              Language
            </h4>
            <p className="text-sm text-muted-foreground">The language every notification is rendered in.</p>
          </div>
          <Select value={language} onValueChange={(v) => setLanguage(v as PreferredLanguage)}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator /> */}

        {/* Push */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-muted-foreground" /> Push notifications
          </h4>
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
          <div>
            <h4 className="font-medium">Events</h4>
            <p className="text-sm text-muted-foreground">Pick which events trigger a notification.</p>
          </div>
          <div className="space-y-1">
            {EVENTS.map((e) => (
              <div key={e.key} className="flex items-center justify-between gap-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
                    <e.Icon className="w-4 h-4" />
                  </div>
                  {/* One line per event: the explanation lives behind the ⓘ, so six
                      events stay scannable instead of filling the viewport. */}
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-medium truncate">{e.label}</p>
                    <InfoHint label={`About ${e.label}`}>
                      {e.description}
                      {e.caveat && <span className="mt-2 block text-amber-600">{e.caveat}</span>}
                    </InfoHint>
                  </div>
                </div>
                <Switch
                  checked={events[e.key]}
                  onCheckedChange={() => toggleEvent(e.key)}
                  aria-label={e.label}
                />
              </div>
            ))}
          </div>
        </div>

      </CardContent>

      <ChannelSetupDialog
        channel={setupChannel}
        verified={setupChannel ? isVerified(prefs, setupChannel) : false}
        agencyEmail={agencyEmail}
        onRefresh={() => (setupChannel ? refreshForChannel(setupChannel) : Promise.resolve(false))}
        onClose={() => setSetupChannel(null)}
      />
    </Card>

    <UnsavedChangesBar
      visible={dirty || saving}
      saving={saving}
      onDiscard={handleDiscard}
      onSave={handleSave}
    />
    </>
  );
}
