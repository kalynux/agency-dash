import { useState } from 'react';
import { Loader2, ExternalLink, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useResource } from '@/hooks/useResource';
import { useActionRunner } from '@/hooks/useActionRunner';
import { whatsappService } from '@/services/channels.service';

const WhatsappIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
  </svg>
);

export interface WhatsappLinkCardProps {
  enabled: boolean;
  verified: boolean;
  onToggle: (enabled: boolean) => void;
  togglePending: boolean;
  onLinkChanged: () => void;
}

export function WhatsappLinkCard({ enabled, verified, onToggle, togglePending, onLinkChanged }: WhatsappLinkCardProps) {
  const status = useResource(() => whatsappService.getStatus().then((r) => r.data), []);
  const { run, pendingKey } = useActionRunner();
  const [waLink, setWaLink] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const linked = status.data?.linked ?? false;

  const startVerify = async () => {
    const result = await run('wa-verify', () => whatsappService.requestVerification(false));
    if (result) {
      setWaLink(result.data.wa_link);
      setCode(result.data.code);
      window.open(result.data.wa_link, '_blank', 'noopener,noreferrer');
    }
  };

  const refreshStatus = async () => {
    await status.refetch();
    onLinkChanged();
  };

  const disconnect = async () => {
    const result = await run('wa-unlink', () => whatsappService.unlink(), { success: 'WhatsApp disconnected.' });
    if (result) {
      setWaLink(null);
      setCode(null);
      await status.refetch();
      onLinkChanged();
    }
  };

  return (
    <div className="flex items-start justify-between p-4 border rounded-lg bg-card gap-4">
      <div className="flex items-start gap-4 min-w-0">
        <div className="p-2 bg-[#25D366]/10 rounded-full flex-shrink-0">
          <WhatsappIcon className="w-5 h-5 text-[#25D366]" />
        </div>
        <div className="min-w-0">
          <p className="font-medium">WhatsApp</p>
          {status.isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Checking…
            </p>
          ) : linked ? (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-green-600 font-medium">{status.data?.name ?? 'Connected'}</p>
              <button
                onClick={disconnect}
                disabled={pendingKey === 'wa-unlink'}
                className="text-muted-foreground hover:text-destructive transition-colors"
                title="Disconnect"
              >
                {pendingKey === 'wa-unlink' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Not connected</p>
              {code && (
                <p className="text-xs text-muted-foreground">
                  Send the pre-filled message (code <span className="font-mono font-medium">{code}</span>) in WhatsApp,
                  then refresh.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {linked ? (
          <Switch checked={enabled} disabled={!verified || togglePending} onCheckedChange={onToggle} />
        ) : waLink ? (
          <>
            <Button variant="ghost" size="sm" onClick={refreshStatus} className="gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={startVerify} disabled={pendingKey === 'wa-verify'} className="gap-1">
              <ExternalLink className="w-3.5 h-3.5" /> Reopen
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={startVerify} disabled={pendingKey === 'wa-verify'}>
            {pendingKey === 'wa-verify' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
          </Button>
        )}
      </div>
    </div>
  );
}
