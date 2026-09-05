// Connect a secondary notification channel.
//
// ─── This dialog was inverted on 2026-08-19, and the inversion is the point ───
//
// It used to MINT something and hand it to the user: a WhatsApp `/link:CODE`
// command, or a Telegram deep-link token. Both flows are deleted (all seven
// endpoints answer 404 — see api-doc/MIGRATION-2026-08.md § 1), and the one that
// replaced them runs the other way:
//
//     1. the user messages the bot with `/connect`
//     2. the BOT replies with a 6-character code
//     3. the user types that code here
//
// So this screen no longer produces a secret for the user to carry into a chat
// window — it consumes one the bot produced. What we render in step 1 comes
// entirely from `howToConnect` on `GET /api/me/connections`; we invent none of
// it, and `deepLink` can legitimately be null when the bot is not configured
// server-side, in which case the command and handle as text are enough.
//
// Email is the exception and is unchanged: it is an auth concern, not a
// messaging connection, and still works by us sending a verification link.
//
// See api-doc/connections/README.md.

import { useCallback, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

import { authService } from '@/services/auth.service';
import { connectionsService } from '@/services/connections.service';
import { copyText } from '@/platform/clipboard';
import { openExternal } from '@/platform/browser';
import { getApiErrorMessage } from '@/lib/errors';
import { tx } from '@/i18n/tx';
import { ApiError } from '@/types/api';
import {
  CODE_SPENDING_ERRORS,
  type ConnectionInstructions,
  type MessagingChannel,
} from '@/types/connection.types';
import type { NotificationChannel } from '@/types/notification.types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

/** The bot code is always six characters. Anything shorter cannot be one. */
const CODE_LENGTH = 6;

type Phase = 'loading' | 'ready' | 'verified';

interface ChannelSetupDialogProps {
  channel: NotificationChannel | null;
  /** Whether `channel` is already verified (controls the success view). */
  verified: boolean;
  agencyEmail?: string | null;
  /** Re-fetch preferences; resolves to whether THIS channel is now verified. */
  onRefresh: () => Promise<boolean>;
  onClose: () => void;
}

function isMessagingChannel(channel: NotificationChannel): channel is MessagingChannel {
  return channel === 'whatsapp' || channel === 'telegram';
}

export function ChannelSetupDialog({
  channel,
  verified,
  agencyEmail,
  onRefresh,
  onClose,
}: ChannelSetupDialogProps) {
  const { t } = useTranslation(['settings', 'common']);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<ConnectionInstructions | null>(null);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Step 1: find out what to tell the user.
   *
   * For a messaging channel this is a plain read — we are asking the backend
   * which bot to name and what command to send, not asking it to mint anything.
   * For email it is still a send, because email verification is an auth flow.
   */
  const prepare = useCallback(async (ch: NotificationChannel) => {
    setPhase('loading');
    setError(null);
    setInstructions(null);
    setCode('');
    try {
      if (ch === 'email') {
        await authService.sendEmailVerification();
        setPhase('ready');
        return;
      }

      const connections = await connectionsService.list();
      const entry = connections.find((c) => c.channel === ch);
      // Already connected on the account but the preferences call had not caught
      // up — the two are computed from the same fact, so trust the newer read.
      if (entry?.connected) {
        setPhase('verified');
        return;
      }
      // `howToConnect` is present only while `connected` is false, so its absence
      // here means the backend gave us nothing to show. The copy below falls back
      // to a generic instruction rather than rendering an empty step.
      setInstructions(entry?.howToConnect ?? null);
      setPhase('ready');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'AUTH_EMAIL_ALREADY_VERIFIED') {
        setPhase('verified');
        return;
      }
      setError(getApiErrorMessage(err));
      setPhase('ready');
    }
  }, []);

  useEffect(() => {
    if (!channel) return;
    if (verified) {
      setPhase('verified');
      return;
    }
    prepare(channel);
  }, [channel, verified, prepare]);

  /**
   * Step 3: redeem.
   *
   * The code is sent **exactly as typed**. The server's matching is broader than
   * anything worth reimplementing here — case-insensitive, punctuation-ignoring,
   * and it reads `O` as `0` and `I`/`L` as `1` — so a client-side "tidy-up" can
   * only ever turn an acceptable code into a rejected one.
   */
  const redeem = useCallback(async () => {
    if (!channel || !isMessagingChannel(channel)) return;
    setRedeeming(true);
    setError(null);
    try {
      await connectionsService.redeem(code);
      // The connection is on the account; the *preferences* view of it is what
      // the settings screen renders, so refresh that before declaring success.
      await onRefresh();
      setPhase('verified');
    } catch (err) {
      setError(getApiErrorMessage(err));
      // A code is single-use even when the redeem FAILS — it is spent by the
      // attempt. So clear the box: retyping the same characters cannot work, and
      // leaving them there invites exactly that.
      if (err instanceof ApiError && CODE_SPENDING_ERRORS.has(err.code)) {
        setCode('');
      }
    } finally {
      setRedeeming(false);
    }
  }, [channel, code, onRefresh]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const nowVerified = await onRefresh();
      if (nowVerified) setPhase('verified');
      else toast.info(t('channelSetup.notVerifiedYet'));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, t]);

  // Through the platform layer (P4.5): `navigator.clipboard` is gated on a
  // secure context and a gesture, and in a WebView it can reject or simply never
  // settle. A refusal is said out loud, because the whole step depends on the
  // user getting this command into the bot.
  const copyCommand = useCallback(async () => {
    if (!instructions?.command) return;
    if (!(await copyText(instructions.command))) {
      toast.error(t('channelSetup.copyFailed'));
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [instructions, t]);

  if (!channel) return null;
  const label = tx(t, `notifications.channels.${channel}`);
  const messaging = isMessagingChannel(channel);
  const canRedeem = code.trim().length >= CODE_LENGTH && !redeeming;

  return (
    <Dialog open={!!channel} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {phase === 'verified'
              ? t('channelSetup.connectedTitle', { channel: label })
              : t('channelSetup.connectTitle', { channel: label })}
          </DialogTitle>
          <DialogDescription>
            {phase === 'verified'
              ? t('channelSetup.connectedDescription', { channel: label })
              : t('channelSetup.connectDescription', { channel: label })}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {phase === 'verified' ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="rounded-full bg-emerald-100 p-3 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t('channelSetup.allSet', { channel: label })}
            </p>
          </div>
        ) : phase === 'loading' ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> {t('channelSetup.preparing')}
          </div>
        ) : channel === 'email' ? (
          <ol className="space-y-3 py-1 text-sm">
            <Step n={1}>
              <Trans
                ns="settings"
                i18nKey="channelSetup.email.step1"
                values={{ email: agencyEmail ?? t('channelSetup.email.yourEmail') }}
                components={{ strong: <span className="font-medium text-foreground" /> }}
              />
            </Step>
            <Step n={2}>{t('channelSetup.email.step2')}</Step>
            <li>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => prepare('email')}>
                <Mail className="h-4 w-4" /> {t('channelSetup.email.resend')}
              </Button>
            </li>
          </ol>
        ) : (
          <div className="space-y-4 py-1 text-sm">
            <ol className="space-y-3">
              {/* Step 1 — go to the bot. `command` and `botHandle` are the
                  backend's words, not ours. */}
              <Step n={1}>
                <Trans
                  ns="settings"
                  i18nKey="channelSetup.connect.step1"
                  values={{
                    command: instructions?.command ?? '/connect',
                    bot: instructions?.botHandle ?? label,
                  }}
                  components={{ strong: <span className="font-medium text-foreground" />, code: <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs" /> }}
                />
              </Step>

              <li className="flex flex-wrap items-center gap-2">
                {/* `deepLink` is null when the bot is not configured server-side.
                    The flow still works — the command and handle above are all a
                    user actually needs — so the button simply is not offered. */}
                {instructions?.deepLink && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => openExternal(instructions.deepLink!)}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('channelSetup.connect.open', { channel: label })}
                  </Button>
                )}
                <code className="flex-1 truncate rounded bg-muted px-2.5 py-1.5 font-mono text-xs">
                  {instructions?.command ?? '/connect'}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={copyCommand}
                  aria-label={t('channelSetup.connect.copyCommand')}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </li>

              {/* Step 2 — the bot answers with the code. Nothing for us to do. */}
              <Step n={2}>{t('channelSetup.connect.step2')}</Step>

              {/* Step 3 — the user types it here. */}
              <Step n={3}>{t('channelSetup.connect.step3')}</Step>
            </ol>

            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (canRedeem) void redeem();
              }}
            >
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                // No `maxLength`, no uppercasing, no stripping: the server reads
                // `A7K9-P2` and `a7k9p2` as the same code, and a client-side
                // normaliser can only narrow what it would have accepted.
                placeholder={t('channelSetup.connect.codePlaceholder')}
                aria-label={t('channelSetup.connect.codeLabel')}
                autoComplete="one-time-code"
                autoFocus
                className="font-mono tracking-widest"
              />
              <Button type="submit" disabled={!canRedeem} className="gap-2">
                {redeeming && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('channelSetup.connect.submit')}
              </Button>
            </form>
          </div>
        )}

        <DialogFooter>
          {phase === 'verified' ? (
            <Button onClick={onClose}>{t('common:actions.done')}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                {t('common:actions.cancel')}
              </Button>
              {/* Email has no code to type, so "check again" is its only way
                  forward. A messaging channel keeps it too, for the case where
                  the connection landed in another tab or on another device. */}
              <Button
                variant={messaging ? 'ghost' : 'default'}
                onClick={handleRefresh}
                disabled={refreshing || phase === 'loading'}
                className="gap-2"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {t('channelSetup.checkAgain')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
