import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  Boxes,
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
import { tx } from '@/i18n/tx';
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
import { InfoHint } from '@/components/common/InfoHint';
import { UnsavedChangesBar } from '@/components/agency-settings/UnsavedChangesBar';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { cn } from '@/lib/utils';

// ─── Static config ──────────────────────────────────────────────────────────

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
  Icon: (props: { className?: string }) => React.JSX.Element;
  iconWrap: string;
  verifyKey: 'emailVerified' | 'telegramVerified' | 'whatsappVerified';
  /** Whether the link can be removed in-app (email can't be un-verified). */
  unlinkable: boolean;
};

// Labels resolve at render from `settings:notifications.channels.<value>` —
// module-scope data can't hold a translated string.
const SECONDARY_CHANNELS: ChannelMeta[] = [
  {
    value: 'telegram',
    Icon: TelegramIcon,
    iconWrap: 'bg-[#0088cc]/10 text-[#0088cc]',
    verifyKey: 'telegramVerified',
    unlinkable: true,
  },
  {
    value: 'email',
    Icon: ({ className }) => <Mail className={className} />,
    iconWrap: 'bg-primary/10 text-primary',
    verifyKey: 'emailVerified',
    unlinkable: false,
  },
  {
    value: 'whatsapp',
    Icon: WhatsappIcon,
    iconWrap: 'bg-[#25D366]/10 text-[#25D366]',
    verifyKey: 'whatsappVerified',
    unlinkable: true,
  },
];

/**
 * `storageAlert`, `contractUpdated` and `stockRequestUpdates` are newer than some
 * deployed backends. Default them to the documented `true` so their switches are
 * never uncontrolled — applied on every read so the dirty-check snapshot and the
 * editable copy always agree.
 *
 * Miss one here and its Switch goes uncontrolled the moment it meets a backend
 * that predates the field: React logs a controlled→uncontrolled warning and the
 * toggle silently stops saving.
 */
function withEventDefaults(data: NotificationPreferences): NotificationPreferences {
  // All three are declared required, so leading literal defaults would be dead
  // code to the compiler. Destructure instead: at runtime an older backend omits
  // the keys entirely, and `?? true` is what actually fills them in.
  const { storageAlert, contractUpdated, stockRequestUpdates, ...rest } = data.preferences;
  return {
    ...data,
    preferences: {
      ...rest,
      storageAlert: storageAlert ?? true,
      contractUpdated: contractUpdated ?? true,
      stockRequestUpdates: stockRequestUpdates ?? true,
    },
  };
}

type EventMeta = {
  key: NotificationEventKey;
  /** True when this event has an extra warning under its description. */
  hasCaveat?: boolean;
  Icon: LucideIcon;
};

/**
 * The event rows, in display order. Label, description and caveat all resolve
 * at render from `settings:notifications.events.<key>*` — the key IS the copy
 * key, so a new event needs one entry here and three strings per locale.
 */
const EVENTS: EventMeta[] = [
  { key: 'shipmentAssigned', Icon: Truck },
  { key: 'connectionUpdated', Icon: Handshake },
  { key: 'contractUpdated', hasCaveat: true, Icon: UserCheck },
  { key: 'payoutUpdates', Icon: Wallet },
  { key: 'codDepositUpdates', hasCaveat: true, Icon: Banknote },
  { key: 'planUpdates', Icon: CalendarClock },
  // Deliberately adjacent to `storageAlert`, and deliberately first: the two
  // share the word "storage" and nothing else — one is the media-file quota, the
  // other is physical goods on our shelves. Sitting side by side is what makes
  // the labels get read against each other instead of one being switched off in
  // mistake for the other.
  { key: 'stockRequestUpdates', hasCaveat: true, Icon: Boxes },
  { key: 'storageAlert', Icon: HardDrive },
];

// Language names are always written in their own language, never translated.
const LANGUAGES: { value: PreferredLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'pt', label: 'Português' },
  { value: 'es', label: 'Español' },
  { value: 'ar', label: 'العربية' },
];

const ALLOWED_LANGS = LANGUAGES.map((l) => l.value);

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
  const { t } = useTranslation(['settings', 'common']);
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
        toast.success(
          t('notifications.disconnected', { channel: tx(t, `notifications.channels.${ch}`) }),
        );
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setUnlinking(null);
      }
    },
    [t],
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

      toast.success(t('notifications.saved'));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DELIVERY_AGENCY_NOTIFICATION_CHANNEL_NOT_VERIFIED') {
        toast.error(t('notifications.notVerified'));
        load();
      } else {
        toast.error(getApiErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }, [prefs, events, channel, channelDirty, eventsDirty, languageDirty, language, updateAgencyProfile, load, t]);

  // ─── Render ──────────────────────────────────────────────────────────────

  // No section heading in any of the three states: this tab is a single block,
  // so the page header above it already names it.
  if (loading) {
    return (
      <Card className={sectionSurfaceClass}>
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
        <CardContent className="space-y-4 max-md:px-0">
          <div role="alert" className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
            {loadError ?? t('notifications.loadFailed')}
          </div>
          <Button variant="outline" onClick={load}>{t('common:actions.retry')}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className={sectionSurfaceClass}>
      <CardContent className="space-y-8 max-md:px-0">
        {/* Delivery channel */}
        <div className="space-y-4">
          <div>
            <h4 className="flex items-center gap-2 font-medium">
              {t('notifications.channels.title')}
              <InfoHint className="md:hidden" label={t('notifications.channels.aboutLabel')}>
                {t('notifications.channels.description')}
              </InfoHint>
            </h4>
            <p className="text-sm text-muted-foreground max-md:hidden">
              {t('notifications.channels.description')}
            </p>
            <p className="text-sm text-muted-foreground md:hidden">
              {t('notifications.channels.short')}
            </p>
          </div>

          <div className="space-y-3" role="radiogroup" aria-label={t('notifications.channels.groupLabel')}>
            {/* In-app — always on, locked */}
            <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/30">
              <div className="p-2 rounded-full flex-shrink-0 bg-primary/10 text-primary">
                <Bell className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{t('notifications.channels.inApp')}</p>
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Lock className="w-3 h-3" /> {t('notifications.channels.alwaysOn')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('notifications.channels.inAppHint')}
                </p>
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
              const channelLabel = tx(t, `notifications.channels.${c.value}`);
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
                    aria-label={t('notifications.channels.use', { channel: channelLabel })}
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
                        <span className="font-medium">{channelLabel}</span>
                        {verified ? (
                          <Badge variant="secondary" className="gap-1 text-xs text-emerald-600">
                            <ShieldCheck className="w-3 h-3" /> {t('notifications.channels.connected')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                            <ShieldAlert className="w-3 h-3" /> {t('notifications.channels.notConnected')}
                          </Badge>
                        )}
                      </span>
                      {c.value === 'email' && verified && agencyEmail ? (
                        <span className="block text-sm text-muted-foreground truncate">{agencyEmail}</span>
                      ) : !verified ? (
                        <span className="block text-sm text-muted-foreground">
                          {t('notifications.channels.connectHint')}
                        </span>
                      ) : selected ? (
                        <span className="block text-sm text-muted-foreground">
                          {t('notifications.channels.selectedHint')}
                        </span>
                      ) : (
                        <span className="block text-sm text-muted-foreground">
                          {t('notifications.channels.tapToUse')}
                        </span>
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
                        {t('notifications.channels.connect')}
                      </Button>
                    ) : c.unlinkable ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={busy}
                        onClick={() => handleUnlink(c.value)}
                      >
                        {busy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          t('notifications.channels.disconnect')
                        )}
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
              {t('notifications.language.title')}
            </h4>
            <p className="text-sm text-muted-foreground">{t('notifications.language.description')}</p>
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
            <Smartphone className="w-4 h-4 text-muted-foreground" /> {t('notifications.push.title')}
          </h4>
          <div className="flex items-center justify-between p-4 border rounded-lg bg-card gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="p-2 bg-primary/10 rounded-full flex-shrink-0">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">{t('notifications.push.thisDevice')}</p>
                <p className="text-sm text-muted-foreground">
                  {push.status === 'registered'
                    ? t('notifications.push.enabled')
                    : push.status === 'unsupported' ||
                        push.status === 'unconfigured' ||
                        push.status === 'denied'
                      ? tx(t, `notifications.push.${push.status}`)
                      : t('notifications.push.idle')}
                </p>
              </div>
            </div>
            {push.status === 'registered' ? (
              <Button variant="outline" size="sm" disabled={push.isBusy} onClick={push.disable}>
                {push.isBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t('notifications.push.disable')
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={push.isBusy || push.status === 'unsupported' || push.status === 'unconfigured' || push.status === 'denied'}
                onClick={push.enable}
              >
                {push.isBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t('notifications.push.enable')
                )}
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Events */}
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">{t('notifications.events.title')}</h4>
            <p className="text-sm text-muted-foreground">{t('notifications.events.description')}</p>
          </div>
          <div className="space-y-1">
            {EVENTS.map((e) => {
              const label = tx(t, `notifications.events.${e.key}`);
              return (
                <div key={e.key} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
                      <e.Icon className="w-4 h-4" />
                    </div>
                    {/* One line per event: the explanation lives behind the ⓘ, so six
                        events stay scannable instead of filling the viewport. */}
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-medium truncate">{label}</p>
                      <InfoHint label={t('notifications.events.aboutLabel', { event: label })}>
                        {tx(t, `notifications.events.${e.key}Description`)}
                        {e.hasCaveat && (
                          <span className="mt-2 block text-amber-600">
                            {tx(t, `notifications.events.${e.key}Caveat`)}
                          </span>
                        )}
                      </InfoHint>
                    </div>
                  </div>
                  <Switch
                    checked={events[e.key]}
                    onCheckedChange={() => toggleEvent(e.key)}
                    aria-label={label}
                  />
                </div>
              );
            })}
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
