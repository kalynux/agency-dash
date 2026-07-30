import { formatDate as fmtDate } from '@/lib/format';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, Send, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAgentActions } from '@/hooks/useAgentActions';
import { agentsService } from '@/services/agents.service';
import { AgentInviteStatusBadge } from '@/components/agents/AgentInviteStatusBadge';
import { ApiError } from '@/types/api';
import type { AgentInvite } from '@/types/agent.types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InvitesTab() {
  const [invites, setInvites] = useState<AgentInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await agentsService.listInvites();
      setInvites(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load your invites.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const actions = useAgentActions({
    onInviteChanged: (invite) => {
      setInvites((prev) => {
        const idx = prev.findIndex((i) => i.id === invite.id);
        if (idx === -1) return [invite, ...prev];
        const next = [...prev];
        next[idx] = invite;
        return next;
      });
    },
  });

  const handleInvite = async () => {
    if (!emailPattern.test(email)) return;
    const result = await actions.invite(email);
    if (result) setEmail('');
  };

  const sorted = [...invites].sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1));

  const formatDate = (dateStr: string) => fmtDate(dateStr);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-2">Invite a delivery agent</p>
          <p className="text-xs text-muted-foreground mb-3">
            The agent must already have (or create) an account on the platform — they'll see your invite and can
            accept it from their own app.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="agent@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                className="pl-10"
              />
            </div>
            <Button
              className="gap-2"
              disabled={!emailPattern.test(email) || actions.pendingKey === 'invite'}
              onClick={handleInvite}
            >
              {actions.pendingKey === 'invite' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Invite
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading invites…
            </div>
          ) : loadError ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
              <Button variant="outline" onClick={load}>Retry</Button>
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-12 text-center">
              <UserPlus className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No invites sent yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {sorted.map((inv) => (
                <div key={inv.id} className="flex items-center gap-4 p-4">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{inv.email}</p>
                      <AgentInviteStatusBadge status={inv.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Invited {formatDate(inv.createdAt)}
                      {inv.respondedAt && ` · Responded ${formatDate(inv.respondedAt)}`}
                    </p>
                  </div>
                  {inv.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 flex-shrink-0"
                      disabled={actions.pendingKey === `revoke:${inv.id}`}
                      onClick={() => actions.revokeInvite(inv.id)}
                    >
                      {actions.pendingKey === `revoke:${inv.id}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
