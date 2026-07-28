import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Mail,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

import { authService } from '@/services/auth.service';
import { telegramService, whatsappService } from '@/services/channels.service';
import { getApiErrorMessage } from '@/lib/errors';
import { ApiError } from '@/types/api';
import type { NotificationChannel } from '@/types/notification.types';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
};

type Phase = 'initiating' | 'ready' | 'verified';

interface ChannelSetupDialogProps {
  channel: NotificationChannel | null;
  /** Whether `channel` is already verified (controls the success view). */
  verified: boolean;
  agencyEmail?: string | null;
  /** Re-fetch preferences; resolves to whether THIS channel is now verified. */
  onRefresh: () => Promise<boolean>;
  onClose: () => void;
}

/**
 * Drives the "Connect" (link/verify) flow for a secondary channel.
 * Step 1 (request link/code) is auto-initiated on open; the agency completes
 * Step 2 outside the app, then refreshes to detect verification.
 */
export function ChannelSetupDialog({
  channel,
  verified,
  agencyEmail,
  onRefresh,
  onClose,
}: ChannelSetupDialogProps) {
  const [phase, setPhase] = useState<Phase>('initiating');
  const [error, setError] = useState<string | null>(null);
  const [actionUrl, setActionUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [waCommand, setWaCommand] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const initiate = useCallback(async (ch: NotificationChannel) => {
    setPhase('initiating');
    setError(null);
    setActionUrl(null);
    setExpiresAt(null);
    setWaCommand(null);
    try {
      if (ch === 'email') {
        await authService.sendEmailVerification();
      } else if (ch === 'telegram') {
        const res = await telegramService.createLinkToken();
        setActionUrl(res.data.bot_url);
        setExpiresAt(res.data.expires_at);
      } else {
        const res = await whatsappService.requestVerification();
        setActionUrl(res.data.wa_link);
        setWaCommand(res.data.command);
      }
      setPhase('ready');
    } catch (err) {
      // "Already verified" isn't a failure — the agency is done.
      if (
        err instanceof ApiError &&
        (err.code === 'AUTH_EMAIL_ALREADY_VERIFIED' || err.code === 'AUTH_WA_ALREADY_VERIFIED')
      ) {
        setPhase('verified');
        return;
      }
      setError(getApiErrorMessage(err));
      setPhase('ready');
    }
  }, []);

  // Auto-start Step 1 when the dialog opens for a channel.
  useEffect(() => {
    if (!channel) return;
    if (verified) {
      setPhase('verified');
      return;
    }
    initiate(channel);
  }, [channel, verified, initiate]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const nowVerified = await onRefresh();
      if (nowVerified) {
        setPhase('verified');
      } else {
        toast.info('Not verified yet — finish the steps, then check again.');
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const copyCommand = useCallback(() => {
    if (!waCommand) return;
    navigator.clipboard.writeText(waCommand).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [waCommand]);

  if (!channel) return null;
  const label = CHANNEL_LABELS[channel];

  return (
    <Dialog open={!!channel} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {phase === 'verified' ? `${label} connected` : `Connect ${label}`}
          </DialogTitle>
          <DialogDescription>
            {phase === 'verified'
              ? `Your ${label} is verified. You can now enable it as your delivery channel.`
              : `Link your ${label} to receive notifications there. This is a one-time setup.`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
            {error}
          </div>
        )}

        {phase === 'verified' ? (
          <div className="flex flex-col items-center text-center py-4 gap-3">
            <div className="p-3 rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-sm text-muted-foreground">All set — close this and choose {label} as your channel.</p>
          </div>
        ) : phase === 'initiating' ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Preparing…
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {channel === 'email' && (
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">1</span>
                  <span>
                    We sent a verification link to{' '}
                    <span className="font-medium text-foreground">{agencyEmail ?? 'your email'}</span>.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">2</span>
                  <span>Open the email and click the link to verify, then refresh below.</span>
                </li>
                <li>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => initiate('email')}>
                    <Mail className="w-4 h-4" /> Resend email
                  </Button>
                </li>
              </ol>
            )}

            {channel === 'telegram' && (
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">1</span>
                  <span>Open our Telegram bot and press <span className="font-medium text-foreground">Start</span>.</span>
                </li>
                {actionUrl && (
                  <li>
                    <Button asChild variant="outline" size="sm" className="gap-2">
                      <a href={actionUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" /> Open Telegram
                      </a>
                    </Button>
                    {expiresAt && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Link expires {new Date(expiresAt).toLocaleTimeString()}.
                      </p>
                    )}
                  </li>
                )}
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">2</span>
                  <span>Once the bot confirms, refresh below.</span>
                </li>
              </ol>
            )}

            {channel === 'whatsapp' && (
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">1</span>
                  <span>Open WhatsApp and send the pre-filled command to our bot.</span>
                </li>
                {actionUrl && (
                  <li>
                    <Button asChild variant="outline" size="sm" className="gap-2">
                      <a href={actionUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" /> Open WhatsApp
                      </a>
                    </Button>
                  </li>
                )}
                {waCommand && (
                  <li className="flex items-center gap-2">
                    <code className="flex-1 px-2.5 py-1.5 rounded bg-muted text-xs font-mono truncate">{waCommand}</code>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={copyCommand} aria-label="Copy command">
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </li>
                )}
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">2</span>
                  <span>After the bot replies, refresh below.</span>
                </li>
              </ol>
            )}
          </div>
        )}

        <DialogFooter>
          {phase === 'verified' ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleRefresh} disabled={refreshing || phase === 'initiating'} className="gap-2">
                {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                I've done this — check
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
