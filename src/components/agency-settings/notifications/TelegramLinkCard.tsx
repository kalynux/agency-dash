import { useState } from 'react';
import { Loader2, ExternalLink, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useResource } from '@/hooks/useResource';
import { useActionRunner } from '@/hooks/useActionRunner';
import { telegramService } from '@/services/channels.service';

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

export interface TelegramLinkCardProps {
  enabled: boolean;
  verified: boolean;
  onToggle: (enabled: boolean) => void;
  togglePending: boolean;
  onLinkChanged: () => void;
}

export function TelegramLinkCard({ enabled, verified, onToggle, togglePending, onLinkChanged }: TelegramLinkCardProps) {
  const status = useResource(() => telegramService.getStatus().then((r) => r.data), []);
  const { run, pendingKey } = useActionRunner();
  const [botUrl, setBotUrl] = useState<string | null>(null);

  const linked = status.data?.linked ?? false;

  const startLink = async () => {
    const result = await run('tg-link', () => telegramService.createLinkToken());
    if (result) {
      setBotUrl(result.data.bot_url);
      window.open(result.data.bot_url, '_blank', 'noopener,noreferrer');
    }
  };

  const refreshStatus = async () => {
    await status.refetch();
    onLinkChanged();
  };

  const disconnect = async () => {
    const result = await run('tg-disconnect', () => telegramService.disconnect(), { success: 'Telegram disconnected.' });
    if (result) {
      setBotUrl(null);
      await status.refetch();
      onLinkChanged();
    }
  };

  return (
    <div className="flex items-start justify-between p-4 border rounded-lg bg-card gap-4">
      <div className="flex items-start gap-4 min-w-0">
        <div className="p-2 bg-[#0088cc]/10 rounded-full flex-shrink-0">
          <TelegramIcon className="w-5 h-5 text-[#0088cc]" />
        </div>
        <div className="min-w-0">
          <p className="font-medium">Telegram</p>
          {status.isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Checking…
            </p>
          ) : linked ? (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-green-600 font-medium">
                {status.data?.username ? `@${status.data.username}` : status.data?.firstName ?? 'Connected'}
              </p>
              <button
                onClick={disconnect}
                disabled={pendingKey === 'tg-disconnect'}
                className="text-muted-foreground hover:text-destructive transition-colors"
                title="Disconnect"
              >
                {pendingKey === 'tg-disconnect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Not connected</p>
              {botUrl && (
                <p className="text-xs text-muted-foreground">
                  Tap “Start” in Telegram, then refresh the status.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {linked ? (
          <Switch checked={enabled} disabled={!verified || togglePending} onCheckedChange={onToggle} />
        ) : botUrl ? (
          <>
            <Button variant="ghost" size="sm" onClick={refreshStatus} className="gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={startLink} disabled={pendingKey === 'tg-link'} className="gap-1">
              <ExternalLink className="w-3.5 h-3.5" /> Reopen
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={startLink} disabled={pendingKey === 'tg-link'}>
            {pendingKey === 'tg-link' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
          </Button>
        )}
      </div>
    </div>
  );
}
